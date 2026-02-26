import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ImportJob {
  id: string;
  status: JobStatus;
  file_path: string;
  total_rows: number;
  processed_rows: number;
  error_message?: string;
  created_at: string;
}

interface JobError {
  line: number;
  message: string;
}

export default function ImportsPage() {
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchJobs = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
      return;
    }
    setJobs(data || []);
    setLoadingJobs(false);
  }, [companyId]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const processFile = useCallback(async (file: File) => {
    if (!companyId || !user?.id) {
      toast.error('Faça login antes de importar.');
      return;
    }

    setUploading(true);
    try {
      const filePath = `${companyId}/${uuidv4()}.csv`;

      const { error: uploadError } = await supabase.storage
        .from('imports')
        .upload(filePath, file, { contentType: 'text/csv' });

      if (uploadError) throw new Error('Falha no upload do arquivo');

      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          company_id: companyId,
          file_path: filePath,
          status: 'queued',
        })
        .select()
        .single();

      if (jobError || !job) throw new Error('Falha ao criar import job');

      toast.success('Upload concluído. Iniciando processamento em lote...', { id: 'import-toast' });
      fetchJobs();

      // Trigger Edge Function directly
      const { error: invokeError } = await supabase.functions.invoke('start_import', {
        body: { job_id: job.id }
      });

      if (invokeError) {
        console.error('start_import trigger error:', invokeError);
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message, { id: 'import-toast' });
    } finally {
      setUploading(false);
    }
  }, [companyId, user, fetchJobs]);

  const handleResumeJob = async (jobId: string) => {
    try {
      toast.success('Retomando job...');
      await supabase.from('import_jobs').update({ status: 'running' }).eq('id', jobId);
      fetchJobs();
      await supabase.functions.invoke('resume_import', { body: { job_id: jobId } });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao retomar job');
    }
  };

  const handleSelectFileClick = useCallback(async () => {
    if (isTauri) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const selected = await open({
          multiple: false,
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        });
        if (typeof selected === 'string') {
          const bytes = await readFile(selected);
          const name = selected.split(/[/\\]/).pop() || 'import.csv';
          const file = new File([bytes], name, { type: 'text/csv' });
          processFile(file);
        }
      } catch {
        toast.error('Erro ao ler arquivo local.');
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [processFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        toast.error('Apenas arquivos .csv são aceitos.');
      }
    },
    [processFile]
  );

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Importação Escalável</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Suporta 2.000+ pedidos utilizando banco de staging e upload assíncrono.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleSelectFileClick}
        className={cn(
          'border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200',
          uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground hover:bg-muted/30'
        )}
      >
        {uploading ? (
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        ) : (
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        )}
        <p className="text-foreground font-medium text-lg">
          {uploading ? 'Enviando arquivo...' : 'Arraste o CSV aqui'}
        </p>
        <p className="text-muted-foreground text-sm mt-1">ou clique para selecionar</p>
        <p className="text-muted-foreground/60 text-xs mt-3">Qualquer marketplace com as colunas corretas</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Minhas Importações</h3>
        {loadingJobs ? (
          <div className="text-sm text-muted-foreground">Carregando jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">Nenhuma importação encontrada.</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const fileName = job.file_path.split('/').pop() || job.file_path;
              const progress = job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;

              return (
                <div key={job.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-medium text-sm truncate max-w-[200px]">{fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border text-green-400 bg-green-500/10 border-green-500/20">
                          Concluído
                        </span>
                      ) : job.status === 'failed' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border text-red-400 bg-red-500/10 border-red-500/20">
                          Falhou
                        </span>
                      ) : job.status === 'queued' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
                          Na Fila
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border text-blue-400 bg-blue-500/10 border-blue-500/20 flex gap-1 items-center">
                          <Loader2 className="w-3 h-3 animate-spin" /> {progress}%
                        </span>
                      )}
                    </div>
                  </div>

                  {(job.status === 'running' || job.status === 'queued') && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <div className="flex justify-between mb-1">
                        <span>{job.processed_rows} de {job.total_rows} linhas</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {job.status === 'completed' && job.total_rows > 0 && job.processed_rows < job.total_rows && (
                    <div className="mt-2 text-xs text-red-400">
                      Algumas linhas falharam. Verifique os erros no banco.
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {(job.status === 'queued' || (job.status === 'running' && progress === 0)) && (
                      <Button variant="secondary" size="sm" onClick={() => handleResumeJob(job.id)}>
                        <Play className="w-3 h-3 mr-1" />
                        Forçar Início
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

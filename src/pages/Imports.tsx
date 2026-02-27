import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, Play, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ImportJob {
  id: string;
  status: JobStatus;
  file_path: string;
  marketplace: string | null;
  total_rows: number;
  processed_rows: number;
  error_message?: string;
  created_at: string;
}

interface JobError {
  id: string;
  row_number: number;
  message: string;
}

export default function ImportsPage() {
  const { companyId, user } = useAuth();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobErrors, setJobErrors] = useState<Record<string, JobError[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchJobs = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setJobs((data || []) as ImportJob[]);
    setLoadingJobs(false);
  }, [companyId]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const fetchErrors = async (jobId: string) => {
    if (jobErrors[jobId]) {
      setExpandedJob(expandedJob === jobId ? null : jobId);
      return;
    }
    const { data } = await supabase
      .from('import_job_errors')
      .select('id, row_number, message')
      .eq('job_id', jobId)
      .order('row_number', { ascending: true })
      .limit(50);
    setJobErrors(prev => ({ ...prev, [jobId]: (data || []) as JobError[] }));
    setExpandedJob(jobId);
  };

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
      if (uploadError) throw new Error('Falha no upload: ' + uploadError.message);

      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({ company_id: companyId, file_path: filePath, status: 'queued' })
        .select()
        .single();
      if (jobError || !job) throw new Error('Falha ao criar job');

      toast.success('Upload concluído. Processando...', { id: 'import-toast' });
      fetchJobs();

      await supabase.functions.invoke('start_import', { body: { job_id: job.id } });
    } catch (err: any) {
      toast.error('Erro: ' + err.message, { id: 'import-toast' });
    } finally {
      setUploading(false);
    }
  }, [companyId, user, fetchJobs]);

  const handleResumeJob = async (jobId: string) => {
    toast.success('Retomando...');
    await supabase.from('import_jobs').update({ status: 'running' }).eq('id', jobId);
    fetchJobs();
    await supabase.functions.invoke('resume_import', { body: { job_id: jobId } });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
    else toast.error('Apenas arquivos .csv são aceitos.');
  }, [processFile]);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Importação de Pedidos</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Importe CSVs oficiais da Shopee, AliExpress ou SHEIN. Detecção automática do marketplace.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200',
          uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground hover:bg-muted/30'
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
        <p className="text-muted-foreground/60 text-xs mt-3">Shopee · AliExpress · SHEIN</p>
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
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">Nenhuma importação.</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const fileName = job.file_path.split('/').pop() || job.file_path;
              const progress = job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;
              const errors = jobErrors[job.id] || [];

              return (
                <div key={job.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-medium text-sm truncate max-w-[200px]">{fileName}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          <span>{new Date(job.created_at).toLocaleString()}</span>
                          {job.marketplace && <span className="uppercase font-semibold text-primary">{job.marketplace}</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      {job.status === 'completed' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Concluído
                        </span>
                      )}
                      {job.status === 'failed' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
                          Falhou
                        </span>
                      )}
                      {job.status === 'queued' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-muted-foreground/20 bg-muted text-muted-foreground">
                          Na Fila
                        </span>
                      )}
                      {job.status === 'running' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary flex gap-1 items-center">
                          <Loader2 className="w-3 h-3 animate-spin" /> {progress}%
                        </span>
                      )}
                    </div>
                  </div>

                  {(job.status === 'running' || (job.status === 'queued' && job.total_rows > 0)) && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <div className="flex justify-between mb-1">
                        <span>{job.processed_rows} de {job.total_rows} linhas</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {job.status === 'completed' && job.total_rows > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {job.processed_rows} linhas processadas de {job.total_rows}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {(job.status === 'queued' || (job.status === 'running' && progress === 0)) && (
                      <Button variant="secondary" size="sm" onClick={() => handleResumeJob(job.id)}>
                        <Play className="w-3 h-3 mr-1" /> Forçar Início
                      </Button>
                    )}
                    {job.status === 'completed' && (
                      <Button variant="ghost" size="sm" onClick={() => fetchErrors(job.id)}>
                        <AlertTriangle className="w-3 h-3 mr-1" /> {expandedJob === job.id ? 'Ocultar Erros' : 'Ver Erros'}
                      </Button>
                    )}
                  </div>

                  {expandedJob === job.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      {errors.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum erro registrado.</p>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {errors.map(err => (
                            <div key={err.id} className="text-xs text-destructive">
                              Linha {err.row_number}: {err.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

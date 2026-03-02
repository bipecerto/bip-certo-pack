import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, Play, AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronUp, Package, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type JobStatus = 'queued' | 'running' | 'success' | 'completed' | 'failed';

interface ImportJob {
  id: string;
  status: JobStatus;
  file_path: string;
  marketplace: string | null;
  total_rows: number;
  processed_rows: number;
  error_message?: string;
  stats: Record<string, number> | null;
  created_at: string;
}

interface JobError {
  id: string;
  row_number: number | null;
  message: string | null;
  raw_row: Record<string, unknown> | null;
}

export default function ImportsPage() {
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [expandedRawRow, setExpandedRawRow] = useState<string | null>(null);
  const [jobErrors, setJobErrors] = useState<Record<string, JobError[]>>({});
  const [deletingJob, setDeletingJob] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (data) {
      setJobs(data.map(j => ({
        ...j,
        total_rows: j.total_rows ?? 0,
        processed_rows: j.processed_rows ?? 0,
        stats: j.stats as Record<string, number> | null,
      })) as ImportJob[]);
    }
    setLoadingJobs(false);
  }, [companyId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'running');
    if (hasActive) {
      if (!pollingRef.current) pollingRef.current = setInterval(fetchJobs, 2000);
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [jobs, fetchJobs]);

  const fetchErrors = async (jobId: string) => {
    if (jobErrors[jobId]) { setExpandedJob(expandedJob === jobId ? null : jobId); return; }
    const { data } = await supabase.from('import_job_errors').select('id, row_number, message, raw_row').eq('job_id', jobId).order('row_number', { ascending: true }).limit(200);
    setJobErrors(prev => ({ ...prev, [jobId]: (data || []) as JobError[] }));
    setExpandedJob(jobId);
  };

  const processFile = useCallback(async (file: File) => {
    if (!companyId || !user?.id) { toast.error('Faça login antes de importar.'); return; }
    setUploading(true);
    try {
      const filePath = `${companyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('imports').upload(filePath, file, { upsert: false, contentType: 'text/csv' });
      if (uploadError) throw new Error('Falha no upload: ' + uploadError.message);
      const { data: job, error: jobError } = await supabase.from('import_jobs').insert({ company_id: companyId, file_path: filePath, status: 'queued', marketplace: 'unknown' }).select().single();
      if (jobError || !job) throw new Error('Falha ao criar job: ' + (jobError?.message || ''));
      toast.success('Upload concluído. Processando em background...', { id: 'import-toast' });
      fetchJobs();
      const { error: fnError } = await supabase.functions.invoke('start_import', { body: { job_id: job.id } });
      if (fnError) toast.error('Erro ao iniciar processamento: ' + fnError.message);
    } catch (err: any) {
      toast.error('Erro: ' + err.message, { id: 'import-toast' });
    } finally { setUploading(false); }
  }, [companyId, user, fetchJobs]);

  const handleResumeJob = async (jobId: string) => {
    toast.info('Retomando processamento...');
    await supabase.from('import_jobs').update({ status: 'running' }).eq('id', jobId);
    fetchJobs();
    await supabase.functions.invoke('resume_import', { body: { job_id: jobId } });
  };

  const handleReimport = async (job: ImportJob) => {
    if (!companyId) return;
    toast.info('Reimportando arquivo...');
    const { data: newJob, error } = await supabase.from('import_jobs').insert({ company_id: companyId, file_path: job.file_path, status: 'queued', marketplace: 'unknown' }).select().single();
    if (error || !newJob) { toast.error('Falha ao criar job: ' + (error?.message || '')); return; }
    fetchJobs();
    await supabase.functions.invoke('start_import', { body: { job_id: newJob.id } });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
    else toast.error('Apenas arquivos .csv são aceitos.');
  }, [processFile]);

  const isTerminal = (s: JobStatus) => s === 'success' || s === 'completed' || s === 'failed';

  const handleDeleteJob = async (jobId: string) => {
    setDeletingJob(jobId);
    try {
      await supabase.from('import_job_errors').delete().eq('job_id', jobId);
      await supabase.from('marketplace_order_lines_staging').delete().eq('job_id', jobId);
      const { error } = await supabase.from('import_jobs').delete().eq('id', jobId);
      if (error) throw error;
      toast.success('Importação removida.');
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    } finally {
      setDeletingJob(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Importação de Pedidos</h2>
        <p className="text-muted-foreground text-sm mt-1">Importe CSVs oficiais da Shopee, Mercado Livre ou SHEIN.</p>
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
        {uploading ? <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /> : <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />}
        <p className="text-foreground font-medium text-lg">{uploading ? 'Enviando arquivo...' : 'Arraste o CSV aqui'}</p>
        <p className="text-muted-foreground text-sm mt-1">ou clique para selecionar</p>
        <p className="text-muted-foreground/60 text-xs mt-3">Shopee · Mercado Livre · SHEIN</p>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Minhas Importações</h3>
        {loadingJobs ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : jobs.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">Nenhuma importação ainda.</div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const fileName = job.file_path.split('/').pop() || job.file_path;
              const progress = job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0;
              const errors = jobErrors[job.id] || [];
              const done = job.status === 'success' || job.status === 'completed';

              return (
                <div key={job.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{fileName}</div>
                        <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                          <span>{new Date(job.created_at).toLocaleString()}</span>
                          {job.marketplace && job.marketplace !== 'unknown' && <span className="uppercase font-semibold text-primary">{job.marketplace === 'aliexpress' ? 'Mercado Livre' : job.marketplace === 'mercadolivre' ? 'Mercado Livre' : job.marketplace}</span>}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={job.status} progress={progress} />
                  </div>

                  {(job.status === 'running' || job.status === 'queued') && job.total_rows > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <div className="flex justify-between mb-1"><span>{job.processed_rows} de {job.total_rows} linhas</span><span>{progress}%</span></div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} /></div>
                    </div>
                  )}

                  {done && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>{job.processed_rows} linhas processadas de {job.total_rows}</div>
                      {job.stats && Object.keys(job.stats).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {Object.entries(job.stats).map(([k, v]) => (<span key={k} className="bg-muted px-2 py-0.5 rounded text-xs">{k}: <strong>{v}</strong></span>))}
                        </div>
                      )}
                    </div>
                  )}

                  {job.status === 'failed' && job.error_message && (
                    <div className="mt-2 text-xs text-destructive bg-destructive/5 rounded p-2">{job.error_message}</div>
                  )}

                  <div className="mt-3 flex gap-2 flex-wrap">
                    {(job.status === 'failed' || (job.status === 'running' && progress === 0)) && (
                      <Button variant="secondary" size="sm" onClick={() => handleResumeJob(job.id)}><Play className="w-3 h-3 mr-1" /> Retomar</Button>
                    )}
                    {isTerminal(job.status) && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => fetchErrors(job.id)}>
                          <AlertTriangle className="w-3 h-3 mr-1" />{expandedJob === job.id ? 'Ocultar Erros' : 'Ver Erros'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleReimport(job)}><RefreshCw className="w-3 h-3 mr-1" /> Reimportar</Button>
                      </>
                    )}
                    {done && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/packages')}><Package className="w-3 h-3 mr-1" /> Ver Pacotes</Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/find')}><Search className="w-3 h-3 mr-1" /> Buscar</Button>
                      </>
                    )}
                    {isTerminal(job.status) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-3 h-3 mr-1" /> Remover
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover importação?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso removerá o registro da importação e seus erros. Os pedidos e produtos já criados NÃO serão afetados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteJob(job.id)} disabled={deletingJob === job.id} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {deletingJob === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar remoção'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  {expandedJob === job.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      {errors.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum erro registrado.</p>
                      ) : (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {errors.map(err => (
                            <div key={err.id} className="text-xs border-b border-border/50 pb-1">
                              <div className="flex items-start gap-2">
                                <span className="text-destructive font-mono shrink-0">{err.row_number != null ? `L${err.row_number}` : '—'}</span>
                                <span className="text-destructive">{err.message || 'Erro desconhecido'}</span>
                                {err.raw_row && (
                                  <button className="text-muted-foreground hover:text-foreground ml-auto shrink-0" onClick={() => setExpandedRawRow(expandedRawRow === err.id ? null : err.id)}>
                                    {expandedRawRow === err.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                              {expandedRawRow === err.id && err.raw_row && (
                                <pre className="text-[10px] text-muted-foreground bg-muted rounded p-2 mt-1 overflow-x-auto">{JSON.stringify(err.raw_row, null, 2)}</pre>
                              )}
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

function StatusBadge({ status, progress }: { status: JobStatus; progress: number }) {
  if (status === 'success' || status === 'completed') {
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Concluído</span>;
  }
  if (status === 'failed') {
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-destructive/20 bg-destructive/10 text-destructive">Falhou</span>;
  }
  if (status === 'queued') {
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-muted-foreground/20 bg-muted text-muted-foreground">Na Fila</span>;
  }
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary flex gap-1 items-center"><Loader2 className="w-3 h-3 animate-spin" /> {progress}%</span>;
}

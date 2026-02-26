import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readFileWithEncoding, parseCsvText } from '@/lib/csv/parse';
import { detectMarketplace } from '@/lib/csv/detect';
import { mapShopeeRow } from '@/lib/csv/shopee';
import { mapAliExpressRow } from '@/lib/csv/aliexpress';
import { mapSheinRow } from '@/lib/csv/shein';
import { upsertRows } from '@/lib/csv/upsert';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type Step = 'idle' | 'reading' | 'detecting' | 'parsing' | 'upserting' | 'done' | 'error';

interface Stats {
  ordersCreated: number;
  ordersUpdated: number;
  productsCreated: number;
  variantsCreated: number;
  packagesCreated: number;
  itemsUpserted: number;
  errors: { line: number; message: string }[];
}

const MARKETPLACE_LABELS: Record<string, string> = {
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
  shein: 'SHEIN',
  unknown: 'Desconhecido',
};

const MARKETPLACE_COLORS: Record<string, string> = {
  shopee: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  aliexpress: 'text-red-400 bg-red-500/10 border-red-500/20',
  shein: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  unknown: 'text-muted-foreground bg-muted border-border',
};

export default function ImportsPage() {
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('idle');
  const [marketplace, setMarketplace] = useState<string>('unknown');
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filename, setFilename] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!companyId || !user?.id) {
      toast.error('Faça login antes de importar.');
      return;
    }

    setFilename(file.name);
    setStep('reading');
    setProgress(0);
    setStats(null);

    try {
      const text = await readFileWithEncoding(file);

      setStep('detecting');
      const { headers, rows } = parseCsvText(text);
      const mkt = detectMarketplace(headers);
      setMarketplace(mkt);
      setTotalRows(rows.length);

      if (mkt === 'unknown') {
        toast.error('Arquivo não reconhecido como exportação oficial de marketplace.');
        setStep('error');
        return;
      }

      setStep('parsing');
      const mapper =
        mkt === 'shopee' ? mapShopeeRow
        : mkt === 'aliexpress' ? mapAliExpressRow
        : mapSheinRow;

      const normalizedRows = rows
        .map((row) => mapper(row, headers))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      setStep('upserting');
      const result = await upsertRows(
        normalizedRows,
        mkt,
        companyId,
        (done, total) => setProgress(Math.round((done / total) * 100))
      );

      setStats(result);
      setStep('done');
      toast.success(`Importação concluída! ${result.ordersCreated + result.ordersUpdated} pedidos processados.`);
    } catch (err) {
      setStep('error');
      toast.error('Erro na importação: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [companyId, user]);

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

  const steps = [
    { id: 'reading', label: 'Lendo arquivo' },
    { id: 'detecting', label: 'Detectando marketplace' },
    { id: 'parsing', label: 'Processando linhas' },
    { id: 'upserting', label: 'Salvando no banco' },
    { id: 'done', label: 'Concluído' },
  ];
  const stepIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Importar CSV</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Suporta exportações originais da Shopee, AliExpress e SHEIN.
        </p>
      </div>

      {step === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleSelectFileClick}
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground hover:bg-muted/30'
          )}
        >
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium text-lg">Arraste o CSV aqui</p>
          <p className="text-muted-foreground text-sm mt-1">ou clique para selecionar</p>
          <p className="text-muted-foreground/60 text-xs mt-3">Shopee · AliExpress · SHEIN — UTF-8 ou Latin1</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
          />
        </div>
      )}

      {step !== 'idle' && step !== 'done' && step !== 'error' && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-foreground font-medium truncate">{filename}</span>
            {marketplace !== 'unknown' && (
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MARKETPLACE_COLORS[marketplace])}>
                {MARKETPLACE_LABELS[marketplace]}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {steps.slice(0, -1).map((s, idx) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                  idx < stepIdx ? 'bg-green-500' :
                    idx === stepIdx ? 'bg-primary animate-pulse' :
                      'bg-muted'
                )}>
                  {idx < stepIdx && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <span className={cn(
                  'text-sm',
                  idx < stepIdx ? 'text-green-400' :
                    idx === stepIdx ? 'text-foreground font-medium' :
                      'text-muted-foreground'
                )}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {step === 'upserting' && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Processando linha {Math.round((progress / 100) * totalRows)} de {totalRows}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'done' && stats && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-foreground">Importação Concluída</h3>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MARKETPLACE_COLORS[marketplace])}>
              {MARKETPLACE_LABELS[marketplace]}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Pedidos criados', value: stats.ordersCreated, color: 'text-green-400' },
              { label: 'Pedidos atualizados', value: stats.ordersUpdated, color: 'text-blue-400' },
              { label: 'Produtos', value: stats.productsCreated, color: 'text-violet-400' },
              { label: 'Variantes', value: stats.variantsCreated, color: 'text-purple-400' },
              { label: 'Pacotes', value: stats.packagesCreated, color: 'text-primary' },
              { label: 'Erros', value: stats.errors.length, color: stats.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
            ].map((item) => (
              <div key={item.label} className="bg-muted rounded-xl p-3">
                <div className={cn('text-2xl font-bold', item.color)}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {stats.errors.length > 0 && (
            <div>
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="flex items-center gap-2 text-sm text-yellow-400 hover:text-yellow-300"
              >
                <AlertTriangle className="w-4 h-4" />
                {stats.errors.length} erro(s) na importação
                {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showErrors && (
                <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5 bg-muted rounded-lg p-3">
                  {stats.errors.map((err, i) => (
                    <div key={i} className="text-xs text-destructive font-mono">
                      Linha {err.line}: {err.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => { setStep('idle'); setStats(null); }}
              variant="outline"
            >
              Importar outro CSV
            </Button>
            <Button onClick={() => navigate('/packages')}>
              Ver Pacotes
            </Button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 text-center">
          <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">Erro na importação</p>
          <p className="text-muted-foreground text-sm mt-1">Verifique o arquivo e tente novamente.</p>
          <Button
            onClick={() => { setStep('idle'); setProgress(0); }}
            variant="outline"
            className="mt-4"
          >
            Tentar Novamente
          </Button>
        </div>
      )}
    </div>
  );
}

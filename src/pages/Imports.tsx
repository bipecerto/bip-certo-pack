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
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  unknown: 'text-slate-400 bg-slate-700/50 border-slate-700',
};

export default function ImportsPage() {
  const { profile } = useApp();
  const { user } = useAuth();
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
  const importIdRef = useRef<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!profile?.company_id || !user?.id) {
      toast.error('Faça login e configure o Supabase antes de importar.');
      navigate('/login');
      return;
    }

    setFilename(file.name);
    setStep('reading');
    setProgress(0);
    setStats(null);

    // Criar registro de import no Supabase
    const db = supabase();
    const { data: importRow } = await db
      .from('imports')
      .insert({
        company_id: profile.company_id,
        user_id: user.id,
        filename: file.name,
        status: 'running',
      })
      .select('id')
      .single();
    importIdRef.current = importRow?.id ?? null;

    try {
      // 1. Ler arquivo
      setStep('reading');
      const text = await readFileWithEncoding(file);

      // 2. Detectar marketplace
      setStep('detecting');
      const { headers, rows } = parseCsvText(text);
      const mkt = detectMarketplace(headers);
      setMarketplace(mkt);
      setTotalRows(rows.length);

      if (mkt === 'unknown') {
        toast.error('Formato de CSV não reconhecido. Verifique se é Shopee, AliExpress ou SHEIN.');
        setStep('error');
        return;
      }

      // 3. Parse
      setStep('parsing');
      const mapper =
        mkt === 'shopee'
          ? mapShopeeRow
          : mkt === 'aliexpress'
            ? mapAliExpressRow
            : mapSheinRow;

      const normalizedRows = rows
        .map((row) => mapper(row, headers))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // 4. UPSERT
      setStep('upserting');
      const result = await upsertRows(
        normalizedRows,
        mkt,
        profile.company_id,
        (done, total) => setProgress(Math.round((done / total) * 100))
      );

      setStats(result);
      setStep('done');

      // Atualizar registro de import
      if (importIdRef.current) {
        await db
          .from('imports')
          .update({
            finished_at: new Date().toISOString(),
            marketplace: mkt,
            status: result.errors.length > 0 ? 'success' : 'success',
            stats: {
              ordersCreated: result.ordersCreated,
              ordersUpdated: result.ordersUpdated,
              productsCreated: result.productsCreated,
              variantsCreated: result.variantsCreated,
              packagesCreated: result.packagesCreated,
              itemsUpserted: result.itemsUpserted,
              totalRows: rows.length,
            },
            errors: result.errors,
          })
          .eq('id', importIdRef.current);
      }

      toast.success(`Importação concluída! ${result.ordersCreated + result.ordersUpdated} pedidos processados.`);
    } catch (err) {
      setStep('error');
      toast.error('Erro na importação: ' + (err instanceof Error ? err.message : String(err)));
      if (importIdRef.current) {
        await db
          .from('imports')
          .update({ status: 'failed', finished_at: new Date().toISOString() })
          .eq('id', importIdRef.current);
      }
    }
  }, [profile, user, navigate]);

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
        <h2 className="text-xl font-semibold text-white">Importar CSV</h2>
        <p className="text-slate-400 text-sm mt-1">
          Suporta exportações originais da Shopee, AliExpress e SHEIN.
        </p>
      </div>

      {/* Drop Zone */}
      {step === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-indigo-500 bg-indigo-500/5'
              : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'
          )}
        >
          <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-white font-medium text-lg">Arraste o CSV aqui</p>
          <p className="text-slate-400 text-sm mt-1">ou clique para selecionar</p>
          <p className="text-slate-600 text-xs mt-3">Shopee · AliExpress · SHEIN — UTF-8 ou Latin1</p>
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

      {/* Progress */}
      {step !== 'idle' && step !== 'done' && step !== 'error' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span className="text-white font-medium truncate">{filename}</span>
            {marketplace !== 'unknown' && (
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MARKETPLACE_COLORS[marketplace])}>
                {MARKETPLACE_LABELS[marketplace]}
              </span>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {steps.slice(0, -1).map((s, idx) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                  idx < stepIdx ? 'bg-emerald-500' :
                    idx === stepIdx ? 'bg-indigo-500 animate-pulse' :
                      'bg-slate-700'
                )}>
                  {idx < stepIdx && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <span className={cn(
                  'text-sm',
                  idx < stepIdx ? 'text-emerald-400' :
                    idx === stepIdx ? 'text-white font-medium' :
                      'text-slate-600'
                )}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {step === 'upserting' && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Processando linha {Math.round((progress / 100) * totalRows)} de {totalRows}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {step === 'done' && stats && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Importação Concluída</h3>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MARKETPLACE_COLORS[marketplace])}>
              {MARKETPLACE_LABELS[marketplace]}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Pedidos criados', value: stats.ordersCreated, color: 'text-emerald-400' },
              { label: 'Pedidos atualizados', value: stats.ordersUpdated, color: 'text-blue-400' },
              { label: 'Produtos', value: stats.productsCreated, color: 'text-violet-400' },
              { label: 'Variantes', value: stats.variantsCreated, color: 'text-purple-400' },
              { label: 'Pacotes', value: stats.packagesCreated, color: 'text-indigo-400' },
              { label: 'Erros', value: stats.errors.length, color: stats.errors.length > 0 ? 'text-red-400' : 'text-slate-400' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-800 rounded-xl p-3">
                <div className={cn('text-2xl font-bold', item.color)}>{item.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Errors */}
          {stats.errors.length > 0 && (
            <div>
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
              >
                <AlertTriangle className="w-4 h-4" />
                {stats.errors.length} erro(s) na importação
                {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showErrors && (
                <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-800 rounded-lg p-3">
                  {stats.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-400 font-mono">
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
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Importar outro CSV
            </Button>
            <Button
              onClick={() => navigate('/packages')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Ver Pacotes
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-medium">Erro na importação</p>
          <p className="text-slate-400 text-sm mt-1">Verifique o arquivo e tente novamente.</p>
          <Button
            onClick={() => { setStep('idle'); setProgress(0); }}
            variant="outline"
            className="mt-4 border-slate-700 text-slate-300"
          >
            Tentar Novamente
          </Button>
        </div>
      )}
    </div>
  );
}

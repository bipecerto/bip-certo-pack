import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, History, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

interface ScanHistoryEntry {
  value: string;
  found: boolean;
  packageId?: string;
  timestamp: Date;
}

function playBeep(type: 'success' | 'error') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = type === 'success' ? 880 : 300;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Sem áudio disponível
  }
}

export default function ScannerPage() {
  const { profile, packagesTick } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>();

  // Manter autofocus permanente
  const refocus = useCallback(() => {
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    refocus();
    return () => clearTimeout(focusTimer.current);
  }, [refocus]);

  // Resetar para idle e voltar o foco após success/notfound
  useEffect(() => {
    if (status === 'found' || status === 'notfound') {
      const t = setTimeout(() => {
        setStatus('idle');
        refocus();
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [status, refocus]);

  const search = useCallback(async (raw: string) => {
    if (!raw.trim() || !profile?.company_id) return;
    const term = raw.trim();
    setStatus('searching');

    try {
      const db = supabase();

      // 1) Buscar por scan_code
      let { data: pkg } = await db
        .from('packages')
        .select('id,scan_code')
        .eq('company_id', profile.company_id)
        .eq('scan_code', term)
        .maybeSingle();

      // 2) Fallback tracking_code
      if (!pkg) {
        const { data } = await db
          .from('packages')
          .select('id,scan_code')
          .eq('company_id', profile.company_id)
          .eq('tracking_code', term)
          .maybeSingle();
        pkg = data;
      }

      // 3) Fallback external_order_id → pegar o primeiro pacote do pedido
      if (!pkg) {
        const { data: order } = await db
          .from('orders')
          .select('id')
          .eq('company_id', profile.company_id)
          .eq('external_order_id', term)
          .maybeSingle();

        if (order) {
          const { data } = await db
            .from('packages')
            .select('id,scan_code')
            .eq('company_id', profile.company_id)
            .eq('order_id', order.id)
            .limit(1)
            .maybeSingle();
          pkg = data;
        }
      }

      if (pkg) {
        playBeep('success');
        setStatus('found');

        // Atualizar cache
        const cached = getCache<Record<string, unknown>[]>(CACHE_KEYS.PACKAGES) || [];
        setCache(CACHE_KEYS.PACKAGES, cached);

        setHistory((h) => [
          { value: term, found: true, packageId: pkg!.id, timestamp: new Date() },
          ...h.slice(0, 9),
        ]);
        await new Promise((r) => setTimeout(r, 400));
        navigate(`/package/${pkg.id}`);
      } else {
        // Tentar cache offline
        const cached = getCache<{ id: string; scan_code: string; tracking_code?: string }[]>(CACHE_KEYS.PACKAGES);
        const fromCache = cached?.find(
          (p) => p.scan_code === term || p.tracking_code === term
        );
        if (fromCache) {
          playBeep('success');
          setStatus('found');
          setHistory((h) => [
            { value: term, found: true, packageId: fromCache.id, timestamp: new Date() },
            ...h.slice(0, 9),
          ]);
          await new Promise((r) => setTimeout(r, 400));
          navigate(`/package/${fromCache.id}`);
        } else {
          playBeep('error');
          setStatus('notfound');
          setHistory((h) => [
            { value: term, found: false, timestamp: new Date() },
            ...h.slice(0, 9),
          ]);
        }
      }
    } catch {
      // Erro de rede: tentar cache
      const cached = getCache<{ id: string; scan_code: string; tracking_code?: string }[]>(CACHE_KEYS.PACKAGES);
      const fromCache = cached?.find((p) => p.scan_code === term || p.tracking_code === term);
      if (fromCache) {
        playBeep('success');
        setStatus('found');
        navigate(`/package/${fromCache.id}`);
      } else {
        playBeep('error');
        setStatus('notfound');
      }
    } finally {
      setValue('');
    }
  }, [profile?.company_id, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      search(value);
    }
  };

  const bgColor = {
    idle: 'bg-slate-950',
    searching: 'bg-slate-900',
    found: 'bg-emerald-950',
    notfound: 'bg-red-950',
  }[status];

  return (
    <div className={cn('flex flex-col h-full transition-colors duration-300', bgColor)}>
      {/* Main scan area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {/* Status icon */}
        <div className={cn(
          'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300',
          status === 'idle' ? 'bg-indigo-600/20 border-2 border-indigo-600/30' :
            status === 'searching' ? 'bg-slate-700/50 border-2 border-slate-600' :
              status === 'found' ? 'bg-emerald-500/20 border-2 border-emerald-500/30' :
                'bg-red-500/20 border-2 border-red-500/30'
        )}>
          {status === 'found' ? (
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          ) : status === 'notfound' ? (
            <XCircle className="w-12 h-12 text-red-400" />
          ) : (
            <Scan className={cn(
              'w-12 h-12',
              status === 'searching' ? 'text-slate-400 animate-pulse' : 'text-indigo-400'
            )} />
          )}
        </div>

        {/* Status message */}
        <div className="text-center">
          <p className={cn(
            'text-2xl font-bold transition-colors duration-300',
            status === 'found' ? 'text-emerald-300' :
              status === 'notfound' ? 'text-red-300' :
                status === 'searching' ? 'text-slate-300' :
                  'text-white'
          )}>
            {status === 'idle' ? 'Pronto para bipe' :
              status === 'searching' ? 'Buscando...' :
                status === 'found' ? 'Pacote encontrado!' :
                  'Não encontrado'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {status === 'idle' ? 'Bipe ou cole o código e pressione ENTER' :
              status === 'notfound' ? 'Verifique o código e tente novamente' : ''}
          </p>
        </div>

        {/* Input gigante */}
        <div className="w-full max-w-xl">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={refocus}
            placeholder="Bipe aqui..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={cn(
              'w-full text-center text-3xl font-mono font-bold py-6 px-6 rounded-2xl border-2 outline-none transition-all duration-200 bg-transparent',
              status === 'idle' ? 'border-indigo-500/40 text-white placeholder:text-slate-700 focus:border-indigo-500' :
                status === 'found' ? 'border-emerald-500/40 text-emerald-300' :
                  status === 'notfound' ? 'border-red-500/40 text-red-300' :
                    'border-slate-700 text-slate-400'
            )}
          />
          <p className="text-center text-xs text-slate-600 mt-2">
            Pesquisa: scan_code → tracking_code → número do pedido
          </p>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
            <History className="w-3.5 h-3.5" />
            Histórico desta sessão
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => entry.packageId && navigate(`/package/${entry.packageId}`)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                  entry.found
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-red-500/10 border-red-500/20 text-red-400 cursor-default'
                )}
              >
                {entry.found ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {entry.value.length > 20 ? entry.value.slice(0, 20) + '…' : entry.value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

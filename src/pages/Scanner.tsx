import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, History, CheckCircle, XCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCache, setCache, CACHE_KEYS } from '@/lib/cache';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileScanner } from '@/components/scanner/MobileScanner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ScanHistoryEntry {
  value: string;
  found: boolean;
  packageId?: string;
  timestamp: Date;
}

const HISTORY_KEY = 'bipcerto_scan_history';

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));
  } catch { return []; }
}

function saveHistory(h: ScanHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
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
  } catch { /* no audio */ }
}

export default function ScannerPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  const [history, setHistory] = useState<ScanHistoryEntry[]>(loadHistory);
  const [cameraActive, setCameraActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const lockRef = useRef(false);
  const lastCodeRef = useRef<string>('');
  const lastScanTsRef = useRef<number>(0);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState('');
  const focusTimer = useRef<ReturnType<typeof setTimeout>>();

  const refocus = useCallback(() => {
    if (cameraActive) return;
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => inputRef.current?.focus(), 100);
  }, [cameraActive]);

  useEffect(() => { refocus(); return () => clearTimeout(focusTimer.current); }, [refocus]);

  useEffect(() => {
    lockRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    if (status === 'found') {
      const t = setTimeout(() => { setStatus('idle'); }, 1800);
      return () => clearTimeout(t);
    }
  }, [status]);

  const lookup = useCallback(async (term: string) => {
    if (!term.trim() || !profile?.company_id) return;
    setStatus('searching');

    try {
      let pkg: { id: string; scan_code: string | null } | null = null;

      const { data: byScan } = await supabase
        .from('packages').select('id,scan_code')
        .eq('company_id', profile.company_id).eq('scan_code', term).maybeSingle();
      pkg = byScan;

      if (!pkg) {
        const { data } = await supabase
          .from('packages').select('id,scan_code')
          .eq('company_id', profile.company_id).eq('tracking_code', term).maybeSingle();
        pkg = data;
      }

      if (!pkg) {
        const { data: order } = await supabase
          .from('orders').select('id')
          .eq('company_id', profile.company_id).eq('external_order_id', term).maybeSingle();
        if (order) {
          const { data } = await supabase
            .from('packages').select('id,scan_code')
            .eq('company_id', profile.company_id).eq('order_id', order.id).limit(1).maybeSingle();
          pkg = data;
        }
      }

      if (!pkg) {
        // Try cache
        const cached = getCache<{ id: string; scan_code: string; tracking_code?: string }[]>(CACHE_KEYS.PACKAGES);
        const fromCache = cached?.find((p) => p.scan_code === term || p.tracking_code === term);
        if (fromCache) pkg = { id: fromCache.id, scan_code: fromCache.scan_code };
      }

      if (pkg) {
        playBeep('success');
        if (navigator.vibrate) navigator.vibrate(100);
        setCameraActive(false);
        setStatus('found');
        const newH = [{ value: term, found: true, packageId: pkg.id, timestamp: new Date() }, ...history.slice(0, 9)];
        setHistory(newH);
        saveHistory(newH);
        await new Promise((r) => setTimeout(r, 400));
        navigate(`/package/${pkg.id}`);
      } else {
        playBeep('error');
        if (navigator.vibrate) navigator.vibrate(200);
        setStatus('notfound');
        const newH = [{ value: term, found: false, timestamp: new Date() }, ...history.slice(0, 9)];
        setHistory(newH);
        saveHistory(newH);
        setNotFoundCode(term);
        setNotFoundOpen(true);
      }
    } catch {
      const cached = getCache<{ id: string; scan_code: string; tracking_code?: string }[]>(CACHE_KEYS.PACKAGES);
      const fromCache = cached?.find((p) => p.scan_code === term || p.tracking_code === term);
      if (fromCache) {
        playBeep('success');
        setStatus('found');
        navigate(`/package/${fromCache.id}`);
      } else {
        playBeep('error');
        setStatus('notfound');
        setNotFoundCode(term);
        setNotFoundOpen(true);
      }
    } finally {
      setValue('');
    }
  }, [profile?.company_id, navigate, history]);

  const handleCameraScan = useCallback((code: string) => {
    const now = Date.now();
    if (lockRef.current) return;
    if (code === lastCodeRef.current && now - lastScanTsRef.current < 3000) return;

    lockRef.current = true;
    lastCodeRef.current = code;
    lastScanTsRef.current = now;
    setIsLocked(true);
    setCameraActive(false);
    setValue(code);
    lookup(code);
  }, [lookup]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); lookup(value); }
  };

  const unlockAndRescan = () => {
    setNotFoundOpen(false);
    lockRef.current = false;
    setIsLocked(false);
    setCameraActive(true);
    setStatus('idle');
    lastCodeRef.current = '';
    lastScanTsRef.current = 0;
    setValue('');
    refocus();
  };

  const handleNotFoundOk = () => {
    setNotFoundOpen(false);
    setCameraActive(false);
    setStatus('idle');
  };

  const handleGoToImports = () => {
    setNotFoundOpen(false);
    setCameraActive(false);
    navigate('/imports');
  };

  const statusIcon = {
    idle: <Scan className="w-10 h-10 text-primary" />,
    searching: <Scan className="w-10 h-10 text-muted-foreground animate-pulse" />,
    found: <CheckCircle className="w-10 h-10 text-success" />,
    notfound: <XCircle className="w-10 h-10 text-destructive" />,
  }[status];

  const statusMsg = {
    idle: 'Pronto para bipe',
    searching: 'Buscando...',
    found: 'Pacote encontrado!',
    notfound: 'Não encontrado',
  }[status];

  const statusColor = {
    idle: 'text-foreground',
    searching: 'text-muted-foreground',
    found: 'text-success',
    notfound: 'text-destructive',
  }[status];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {/* Status */}
        <div className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300',
          status === 'idle' ? 'border-primary/30 bg-primary/5' :
            status === 'found' ? 'border-success/30 bg-success/5' :
              status === 'notfound' ? 'border-destructive/30 bg-destructive/5' :
                'border-border bg-muted'
        )}>
          {statusIcon}
        </div>

        <div className="text-center">
          <p className={cn('text-xl font-bold transition-colors duration-300', statusColor)}>
            {statusMsg}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {status === 'idle' ? 'Bipe, escaneie ou cole o código' :
              status === 'notfound' ? 'Verifique o código e tente novamente' : ''}
          </p>
        </div>

        {/* Camera scanner */}
        <div className="w-full max-w-xl">
          <MobileScanner
            onScan={handleCameraScan}
            active={cameraActive}
            onToggle={setCameraActive}
            locked={isLocked}
          />
        </div>

        {/* Manual input */}
        <div className="w-full max-w-xl">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={refocus}
              placeholder="Bipe ou cole o código aqui..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono text-lg text-center h-14"
            />
            <Button
              onClick={() => lookup(value)}
              disabled={!value.trim() || status === 'searching'}
              className="h-14 px-5"
            >
              <Search className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Pesquisa: scan_code → tracking_code → número do pedido
          </p>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <History className="w-3.5 h-3.5" />
            Histórico de scans
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => entry.packageId && navigate(`/package/${entry.packageId}`)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                  entry.found
                    ? 'bg-success/10 border-success/20 text-success hover:bg-success/20'
                    : 'bg-destructive/10 border-destructive/20 text-destructive cursor-default'
                )}
              >
                {entry.found ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {entry.value.length > 20 ? entry.value.slice(0, 20) + '…' : entry.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Not Found Dialog */}
      <Dialog open={notFoundOpen} onOpenChange={setNotFoundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código não encontrado</DialogTitle>
            <DialogDescription>
              Não encontramos esse código no sistema. Verifique se os pedidos já foram importados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleNotFoundOk}>OK</Button>
            <Button variant="secondary" onClick={unlockAndRescan}>Escanear novamente</Button>
            <Button onClick={handleGoToImports}>Ir para Imports</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

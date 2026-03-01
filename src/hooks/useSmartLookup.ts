import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { getCache, CACHE_KEYS } from '@/lib/cache';

export type LookupStatus = 'idle' | 'searching' | 'found' | 'notfound';

interface SmartLookupResult {
  status: LookupStatus;
  lookup: (raw: string) => Promise<void>;
  notFoundCode: string;
  notFoundOpen: boolean;
  setNotFoundOpen: (v: boolean) => void;
  unlockAndReset: () => void;
  handleNotFoundOk: () => void;
  handleGoToImports: () => void;
  isLocked: boolean;
  setIsLocked: (v: boolean) => void;
  setStatus: (s: LookupStatus) => void;
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

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function useSmartLookup(): SmartLookupResult {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const busyRef = useRef(false);

  const lookup = useCallback(async (raw: string) => {
    const code = normalize(raw);
    if (!code || !profile?.company_id) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus('searching');

    try {
      let pkg: { id: string } | null = null;

      // 1) Tracking code priority (e.g. BR2670513802187)
      const { data: byTracking } = await supabase
        .from('packages').select('id')
        .eq('company_id', profile.company_id)
        .eq('tracking_code', code)
        .maybeSingle();
      pkg = byTracking;

      // 2) Scan code
      if (!pkg) {
        const { data: byScan } = await supabase
          .from('packages').select('id')
          .eq('company_id', profile.company_id)
          .eq('scan_code', code)
          .maybeSingle();
        pkg = byScan;
      }

      // 3) Order external_order_id
      if (!pkg) {
        const { data: order } = await supabase
          .from('orders').select('id')
          .eq('company_id', profile.company_id)
          .eq('external_order_id', code)
          .maybeSingle();
        if (order) {
          const { data: orderPkg } = await supabase
            .from('packages').select('id')
            .eq('company_id', profile.company_id)
            .eq('order_id', order.id)
            .limit(1)
            .maybeSingle();
          pkg = orderPkg;
          if (!pkg) {
            // Has order but no package
            playBeep('success');
            if (navigator.vibrate) navigator.vibrate(100);
            setStatus('found');
            await new Promise(r => setTimeout(r, 300));
            navigate(`/orders`);
            return;
          }
        }
      }

      // 4) Cache fallback
      if (!pkg) {
        const cached = getCache<{ id: string; scan_code: string; tracking_code?: string }[]>(CACHE_KEYS.PACKAGES);
        const fromCache = cached?.find(p =>
          p.tracking_code === code || p.scan_code === code
        );
        if (fromCache) pkg = { id: fromCache.id };
      }

      if (pkg) {
        playBeep('success');
        if (navigator.vibrate) navigator.vibrate(100);
        setStatus('found');
        await new Promise(r => setTimeout(r, 300));
        navigate(`/package/${pkg.id}`);
      } else {
        playBeep('error');
        if (navigator.vibrate) navigator.vibrate(200);
        setStatus('notfound');
        setNotFoundCode(code);
        setNotFoundOpen(true);
      }
    } catch {
      // Offline fallback
      const cached = getCache<{ id: string; scan_code: string; tracking_code?: string }[]>(CACHE_KEYS.PACKAGES);
      const fromCache = cached?.find(p =>
        p.tracking_code === normalize(raw) || p.scan_code === normalize(raw)
      );
      if (fromCache) {
        playBeep('success');
        setStatus('found');
        navigate(`/package/${fromCache.id}`);
      } else {
        playBeep('error');
        setStatus('notfound');
        setNotFoundCode(normalize(raw));
        setNotFoundOpen(true);
      }
    } finally {
      busyRef.current = false;
    }
  }, [profile?.company_id, navigate]);

  const unlockAndReset = useCallback(() => {
    setNotFoundOpen(false);
    setIsLocked(false);
    setStatus('idle');
    setNotFoundCode('');
  }, []);

  const handleNotFoundOk = useCallback(() => {
    setNotFoundOpen(false);
    setStatus('idle');
  }, []);

  const handleGoToImports = useCallback(() => {
    setNotFoundOpen(false);
    setIsLocked(false);
    navigate('/imports');
  }, [navigate]);

  return {
    status, lookup, notFoundCode, notFoundOpen, setNotFoundOpen,
    unlockAndReset, handleNotFoundOk, handleGoToImports,
    isLocked, setIsLocked, setStatus,
  };
}

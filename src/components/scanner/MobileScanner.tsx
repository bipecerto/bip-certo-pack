import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileScannerProps {
  onScan: (code: string) => void;
  active: boolean;
  onToggle: (active: boolean) => void;
  locked?: boolean;
}

export function MobileScanner({ onScan, active, onToggle, locked }: MobileScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {
      // ignore
    }
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;
    setError(null);
    setStarting(true);

    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setError('A câmera requer HTTPS. Acesse o app via HTTPS.');
        setStarting(false);
        return;
      }

      await stopScanner();

      const scanner = new Html5Qrcode('mobile-scanner-region');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 16 / 9,
        },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Permissão de câmera negada. Habilite nas configurações do navegador.');
      } else if (msg.includes('NotFound') || msg.includes('device')) {
        setError('Nenhuma câmera encontrada neste dispositivo.');
      } else {
        setError('Erro ao iniciar câmera: ' + msg);
      }
      onToggle(false);
    } finally {
      setStarting(false);
    }
  }, [onScan, onToggle, stopScanner]);

  useEffect(() => {
    if (active) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
  }, [active, startScanner, stopScanner]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant={active ? 'destructive' : 'default'}
          size="sm"
          onClick={() => onToggle(!active)}
          disabled={starting}
          className="gap-2"
        >
          {active ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {starting ? 'Iniciando...' : active ? 'Desativar Câmera' : 'Ativar Câmera'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={active ? 'block relative' : 'hidden'}
      >
        <div
          id="mobile-scanner-region"
          className="rounded-xl overflow-hidden border border-border bg-muted"
          style={{ width: '100%', minHeight: active ? 280 : 0 }}
        />
        {locked && (
          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
            <span className="text-white font-semibold text-lg">Leitura capturada</span>
          </div>
        )}
      </div>
    </div>
  );
}

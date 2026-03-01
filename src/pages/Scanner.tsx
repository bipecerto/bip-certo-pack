import { useState, useCallback, useRef } from 'react';
import { Camera, ScanBarcode, Keyboard } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MobileScanner } from '@/components/scanner/MobileScanner';
import { ReaderMode } from '@/components/scanner/ReaderMode';
import { ManualMode } from '@/components/scanner/ManualMode';
import { StatusIndicator } from '@/components/scanner/StatusIndicator';
import { ScanHistory, loadHistory, saveHistory, type ScanHistoryEntry } from '@/components/scanner/ScanHistory';
import { NotFoundDialog } from '@/components/scanner/NotFoundDialog';
import { useSmartLookup } from '@/hooks/useSmartLookup';

export default function ScannerPage() {
  const [mode, setMode] = useState<'camera' | 'reader' | 'manual'>('reader');
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<ScanHistoryEntry[]>(loadHistory);
  const [cameraActive, setCameraActive] = useState(false);

  const lastCodeRef = useRef('');
  const lastScanTsRef = useRef(0);

  const {
    status, lookup, notFoundCode, notFoundOpen, setNotFoundOpen,
    unlockAndReset, handleNotFoundOk, handleGoToImports,
    isLocked, setIsLocked, setStatus,
  } = useSmartLookup();

  const addHistory = useCallback((code: string, found: boolean, packageId?: string) => {
    const entry: ScanHistoryEntry = { value: code, found, packageId, timestamp: new Date() };
    const newH = [entry, ...history.filter(h => h.value !== code).slice(0, 9)];
    setHistory(newH);
    saveHistory(newH);
  }, [history]);

  const handleLookup = useCallback(async (code: string) => {
    const now = Date.now();
    if (isLocked) return;
    if (code === lastCodeRef.current && now - lastScanTsRef.current < 2000) return;

    lastCodeRef.current = code;
    lastScanTsRef.current = now;
    setIsLocked(true);
    setValue(code);

    await lookup(code);

    // After lookup, check status to record history
    // We read from the latest status via a small delay
    setTimeout(() => {
      const found = document.querySelector('[data-status="found"]') !== null;
      addHistory(code, found);
    }, 500);
  }, [isLocked, lookup, setIsLocked, addHistory]);

  // Camera scan handler
  const handleCameraScan = useCallback((code: string) => {
    setCameraActive(false);
    handleLookup(code);
  }, [handleLookup]);

  // Rescan: unlock and restart current mode
  const handleUnlockRescan = useCallback(() => {
    unlockAndReset();
    setValue('');
    lastCodeRef.current = '';
    lastScanTsRef.current = 0;
    if (mode === 'camera') setCameraActive(true);
  }, [unlockAndReset, mode]);

  // Tab change
  const handleModeChange = (v: string) => {
    const m = v as 'camera' | 'reader' | 'manual';
    setCameraActive(false);
    setMode(m);
    setIsLocked(false);
    setStatus('idle');
    setValue('');
    lastCodeRef.current = '';
  };

  // History rescan
  const handleHistoryRescan = (code: string) => {
    setIsLocked(false);
    setStatus('idle');
    lastCodeRef.current = '';
    lastScanTsRef.current = 0;
    setValue(code);
    handleLookup(code);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center p-4 sm:p-6 gap-5">
        {/* Card container */}
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-foreground">Scanner</h1>
            <p className="text-sm text-muted-foreground">Bipe por câmera, leitor ou manualmente</p>
          </div>

          {/* Status */}
          <div className="mb-5" data-status={status}>
            <StatusIndicator status={status} />
          </div>

          {/* Tabs */}
          <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-11 mb-5">
              <TabsTrigger value="camera" className="gap-1.5 text-sm">
                <Camera className="w-4 h-4" />
                Câmera
              </TabsTrigger>
              <TabsTrigger value="reader" className="gap-1.5 text-sm">
                <ScanBarcode className="w-4 h-4" />
                Leitor
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5 text-sm">
                <Keyboard className="w-4 h-4" />
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera">
              <MobileScanner
                onScan={handleCameraScan}
                active={cameraActive}
                onToggle={setCameraActive}
                locked={isLocked}
              />
            </TabsContent>

            <TabsContent value="reader">
              <ReaderMode
                active={mode === 'reader'}
                value={value}
                onChange={setValue}
                onSubmit={(code) => handleLookup(code)}
                isLocked={isLocked}
                onClear={() => { setValue(''); setIsLocked(false); setStatus('idle'); lastCodeRef.current = ''; }}
                onUnlock={handleUnlockRescan}
              />
            </TabsContent>

            <TabsContent value="manual">
              <ManualMode
                active={mode === 'manual'}
                value={value}
                onChange={setValue}
                onSubmit={(code) => handleLookup(code)}
                isSearching={status === 'searching'}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* History */}
      <ScanHistory history={history} onRescan={handleHistoryRescan} />

      {/* Not Found Dialog */}
      <NotFoundDialog
        open={notFoundOpen}
        code={notFoundCode}
        onOpenChange={setNotFoundOpen}
        onOk={handleNotFoundOk}
        onRescan={handleUnlockRescan}
        onGoImports={handleGoToImports}
      />
    </div>
  );
}

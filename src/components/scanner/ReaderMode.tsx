import { useEffect, useRef, useCallback } from 'react';
import { ScanBarcode, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  active: boolean;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (code: string) => void;
  isLocked: boolean;
  onClear: () => void;
  onUnlock: () => void;
}

export function ReaderMode({ active, value, onChange, onSubmit, isLocked, onClear, onUnlock }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const focus = useCallback(() => {
    if (!active) return;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [active]);

  // Auto-focus when active
  useEffect(() => {
    if (active && !isLocked) focus();
  }, [active, isLocked, focus]);

  // Re-focus on click anywhere
  useEffect(() => {
    if (!active || isLocked) return;
    const handler = () => focus();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [active, isLocked, focus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timeoutRef.current);
      if (value.trim() && !isLocked) {
        onSubmit(value.trim());
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);

    // Timeout fallback: if no Enter received, submit after 300ms of inactivity
    clearTimeout(timeoutRef.current);
    if (v.trim().length >= 4) {
      timeoutRef.current = setTimeout(() => {
        if (!isLocked && v.trim()) {
          onSubmit(v.trim());
        }
      }, 300);
    }
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  if (!active) return null;

  return (
    <div className="space-y-5">
      {/* Visual panel */}
      <div className={cn(
        'rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-4 transition-all',
        isLocked
          ? 'border-green-300 bg-green-50/50'
          : 'border-primary/20 bg-muted/30'
      )}>
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center transition-all',
          isLocked ? 'bg-green-100' : 'bg-primary/10'
        )}>
          <ScanBarcode className={cn('w-8 h-8', isLocked ? 'text-green-600' : 'text-primary')} />
        </div>

        <div className="text-center">
          <p className="font-semibold text-foreground">
            {isLocked ? 'Leitura capturada' : 'Aguardando leitura do leitor...'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dica: configure o leitor para enviar ENTER no final.
          </p>
        </div>

        {/* Display field */}
        <div className="w-full max-w-md relative">
          <input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={focus}
            readOnly={isLocked}
            placeholder="Código aparecerá aqui..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className={cn(
              'w-full h-14 rounded-lg border bg-background px-4 font-mono text-lg text-center',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all',
              isLocked ? 'border-green-300 bg-green-50 text-green-800' : 'border-input'
            )}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClear} className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </Button>
          {isLocked && (
            <Button size="sm" onClick={onUnlock} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Escanear novamente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

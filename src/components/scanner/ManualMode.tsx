import { useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  active: boolean;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (code: string) => void;
  isSearching: boolean;
}

export function ManualMode({ active, value, onChange, onSubmit, isSearching }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 100);
  }, [active]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) onSubmit(value.trim());
    }
  };

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cole ou digite o código aqui..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono text-lg text-center h-14"
        />
        <Button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim() || isSearching}
          className="h-14 px-5"
        >
          <Search className="w-5 h-5" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Pesquisa: tracking_code → scan_code → pedido
      </p>
    </div>
  );
}

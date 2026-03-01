import { Scan, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LookupStatus } from '@/hooks/useSmartLookup';

const config: Record<LookupStatus, { icon: React.ReactNode; label: string; sub: string; color: string; border: string; bg: string }> = {
  idle: {
    icon: <Scan className="w-8 h-8 text-primary" />,
    label: 'Pronto para bipar',
    sub: 'Bipe, escaneie ou cole o código',
    color: 'text-foreground',
    border: 'border-primary/30',
    bg: 'bg-primary/5',
  },
  searching: {
    icon: <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />,
    label: 'Buscando...',
    sub: '',
    color: 'text-muted-foreground',
    border: 'border-border',
    bg: 'bg-muted',
  },
  found: {
    icon: <CheckCircle className="w-8 h-8 text-green-600" />,
    label: 'Pacote encontrado!',
    sub: 'Redirecionando...',
    color: 'text-green-700',
    border: 'border-green-300',
    bg: 'bg-green-50',
  },
  notfound: {
    icon: <XCircle className="w-8 h-8 text-destructive" />,
    label: 'Não encontrado',
    sub: 'Verifique o código e tente novamente',
    color: 'text-destructive',
    border: 'border-destructive/30',
    bg: 'bg-destructive/5',
  },
};

export function StatusIndicator({ status }: { status: LookupStatus }) {
  const c = config[status];
  return (
    <div className="flex items-center gap-4">
      <div className={cn('w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 shrink-0', c.border, c.bg)}>
        {c.icon}
      </div>
      <div>
        <p className={cn('text-lg font-bold transition-colors duration-300', c.color)}>{c.label}</p>
        {c.sub && <p className="text-muted-foreground text-xs mt-0.5">{c.sub}</p>}
      </div>
    </div>
  );
}

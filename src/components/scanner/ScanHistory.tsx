import { History, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScanHistoryEntry {
  value: string;
  found: boolean;
  packageId?: string;
  timestamp: Date;
}

const HISTORY_KEY = 'bipcerto_scan_history';

export function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }));
  } catch { return []; }
}

export function saveHistory(h: ScanHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
}

interface Props {
  history: ScanHistoryEntry[];
  onRescan: (code: string) => void;
}

export function ScanHistory({ history, onRescan }: Props) {
  if (!history.length) return null;
  return (
    <div className="border-t border-border p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <History className="w-3.5 h-3.5" />
        Últimos scans
      </div>
      <div className="flex flex-wrap gap-1.5">
        {history.map((entry, i) => (
          <button
            key={i}
            onClick={() => onRescan(entry.value)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-colors',
              entry.found
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                : 'bg-destructive/5 border-destructive/20 text-destructive hover:bg-destructive/10'
            )}
          >
            {entry.found ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {entry.value.length > 22 ? entry.value.slice(0, 22) + '…' : entry.value}
          </button>
        ))}
      </div>
    </div>
  );
}

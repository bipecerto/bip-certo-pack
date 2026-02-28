import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { setCache, getCache, CACHE_KEYS } from '@/lib/cache';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'packed' | 'checking' | 'verified' | 'shipped' | 'cancelled';

const STATUS_CONFIG = {
  all: { label: 'Todos', color: 'bg-muted text-muted-foreground border-border' },
  packed: { label: 'Embalado', color: 'bg-info/10 text-info border-info/20' },
  checking: { label: 'Em Conferência', color: 'bg-warning/10 text-warning border-warning/20' },
  verified: { label: 'Verificado', color: 'bg-green-100 text-green-800 border-green-200' },
  shipped: { label: 'Enviado', color: 'bg-success/10 text-success border-success/20' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface PkgRow {
  id: string;
  scan_code: string | null;
  tracking_code: string | null;
  status: string;
  package_number: number;
  last_scanned_at: string | null;
  created_at: string;
  order: { external_order_id: string; customer_name: string | null; marketplace: string } | null;
}

export default function PackagesPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PkgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('packages')
        .select('id, scan_code, tracking_code, status, package_number, last_scanned_at, created_at, order:orders(external_order_id, customer_name, marketplace)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (search.trim()) {
        q = q.or(`scan_code.ilike.%${search.trim()}%,tracking_code.ilike.%${search.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      const rows = data as unknown as PkgRow[];
      setPackages(rows);
      setCache(CACHE_KEYS.PACKAGES, rows, 5 * 60 * 1000);
    } catch {
      const cached = getCache<PkgRow[]>(CACHE_KEYS.PACKAGES);
      if (cached) { setPackages(cached); toast.warning('Exibindo dados em cache.'); }
      else toast.error('Erro ao carregar pacotes.');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pacotes</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{packages.length} pacote(s)</p>
        </div>
        <Button onClick={load} variant="ghost" size="sm">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar por scan_code ou tracking..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_CONFIG) as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                statusFilter === s
                  ? STATUS_CONFIG[s].color + ' ring-1 ring-current'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum pacote encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg) => {
            const cfg = STATUS_CONFIG[pkg.status as StatusFilter] || STATUS_CONFIG.packed;
            return (
              <button
                key={pkg.id}
                onClick={() => navigate(`/package/${pkg.id}`)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all flex items-center gap-4"
              >
                <Package className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-foreground truncate">
                      {pkg.scan_code || pkg.tracking_code || 'Sem código'}
                    </span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pkg.order?.customer_name && <span>{pkg.order.customer_name} • </span>}
                    {pkg.order?.external_order_id && <span className="font-mono">{pkg.order.external_order_id}</span>}
                    {pkg.last_scanned_at && (
                      <span> • {new Date(pkg.last_scanned_at).toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

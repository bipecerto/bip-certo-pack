import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { setCache, getCache, CACHE_KEYS } from '@/lib/cache';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'packed' | 'checking' | 'shipped' | 'cancelled';

const STATUS_CONFIG = {
  all: { label: 'Todos', color: 'bg-slate-700 text-slate-300 border-slate-600' },
  packed: { label: 'Embalado', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  checking: { label: 'Em Conferência', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  shipped: { label: 'Enviado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
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
  const { profile, packagesTick } = useApp();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PkgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const db = supabase();
      let q = db
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
      if (cached) { setPackages(cached); toast.warning('Exibindo dados em cache (offline).'); }
      else toast.error('Erro ao carregar pacotes.');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, statusFilter, search, packagesTick]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Pacotes</h2>
          <p className="text-slate-400 text-sm mt-0.5">{packages.length} pacote(s)</p>
        </div>
        <Button onClick={load} variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar por scan_code ou tracking..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
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
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum pacote encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg) => {
            const cfg = STATUS_CONFIG[pkg.status as StatusFilter] || STATUS_CONFIG.packed;
            return (
              <button
                key={pkg.id}
                onClick={() => navigate(`/package/${pkg.id}`)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-left hover:border-indigo-500/40 hover:bg-slate-800/50 transition-all flex items-center gap-4"
              >
                <Package className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-white truncate">
                      {pkg.scan_code || pkg.tracking_code || 'Sem código'}
                    </span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {pkg.order?.customer_name && <span>{pkg.order.customer_name} • </span>}
                    {pkg.order?.external_order_id && <span className="font-mono">{pkg.order.external_order_id}</span>}
                    {pkg.last_scanned_at && (
                      <span> • {new Date(pkg.last_scanned_at).toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

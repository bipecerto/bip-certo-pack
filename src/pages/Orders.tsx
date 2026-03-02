import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, RefreshCw, ChevronRight, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OrderRow {
  id: string;
  external_order_id: string;
  marketplace: string;
  customer_name: string | null;
  address_summary: string | null;
  status: string;
  created_at: string;
  packages: { id: string; scan_code: string | null; status: string }[];
}

const MKT_COLOR: Record<string, string> = {
  shopee: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  mercadolivre: 'bg-green-500/10 text-green-600 border-green-500/20',
  aliexpress: 'bg-green-500/10 text-green-600 border-green-500/20',
  shein: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
};

const MKT_LABEL: Record<string, string> = {
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
  aliexpress: 'Mercado Livre',
  shein: 'SHEIN',
};

const MARKETPLACE_FILTERS = ['all', 'shopee', 'mercadolivre', 'shein'];

export default function OrdersPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mktFilter, setMktFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('orders')
        .select(`id, external_order_id, marketplace, customer_name, address_summary, status, created_at, packages(id, scan_code, status)`)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (mktFilter !== 'all') {
        if (mktFilter === 'mercadolivre') {
          q = q.in('marketplace', ['mercadolivre', 'aliexpress']);
        } else {
          q = q.eq('marketplace', mktFilter);
        }
      }
      if (search.trim()) q = q.or(`external_order_id.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      setOrders(data as unknown as OrderRow[]);
    } catch {
      toast.error('Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, mktFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteOrder = async () => {
    if (!deleteTarget || confirmText !== 'EXCLUIR') return;
    setDeleting(true);
    try {
      // Delete package_items for packages of this order
      const { data: pkgs } = await supabase.from('packages').select('id').eq('order_id', deleteTarget.id);
      if (pkgs && pkgs.length > 0) {
        const pkgIds = pkgs.map(p => p.id);
        await supabase.from('package_items').delete().in('package_id', pkgIds);
        await supabase.from('scans').delete().in('package_id', pkgIds);
      }
      await supabase.from('packages').delete().eq('order_id', deleteTarget.id);
      await supabase.from('order_items').delete().eq('order_id', deleteTarget.id);
      const { error } = await supabase.from('orders').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Pedido excluído.');
      setOrders(prev => prev.filter(o => o.id !== deleteTarget.id));
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setConfirmText('');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Pedidos</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} pedido(s)</p>
        </div>
        <Button onClick={load} variant="ghost" size="sm"><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /></Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Buscar por ID do pedido ou cliente..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          {MARKETPLACE_FILTERS.map((m) => (
            <button key={m} onClick={() => setMktFilter(m)} className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border transition-all capitalize', mktFilter === m ? (m === 'all' ? 'bg-primary border-primary text-primary-foreground' : MKT_COLOR[m] + ' ring-1 ring-current') : 'bg-muted border-border text-muted-foreground hover:text-foreground')}>
              {m === 'all' ? 'Todos' : (MKT_LABEL[m] || m)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16"><ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum pedido encontrado.</p></div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const expanded = expandedId === order.id;
            return (
              <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(expanded ? null : order.id)} className="w-full p-4 text-left flex items-center gap-3 hover:bg-accent/50 transition-colors">
                  <ShoppingCart className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-foreground">{order.external_order_id}</span>
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MKT_COLOR[order.marketplace] || 'bg-muted text-muted-foreground')}>{MKT_LABEL[order.marketplace] || order.marketplace.toUpperCase()}</span>
                      {order.packages?.length > 0 && <span className="text-xs text-muted-foreground">{order.packages.length} pacote(s)</span>}
                    </div>
                    {order.customer_name && <p className="text-xs text-muted-foreground mt-0.5">{order.customer_name}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {order.address_summary && <p className="text-xs text-muted-foreground">📍 {order.address_summary}</p>}
                    {order.packages?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Pacotes:</p>
                        <div className="space-y-1">
                          {order.packages.map((pkg) => (
                            <button key={pkg.id} onClick={() => navigate(`/package/${pkg.id}`)} className="w-full flex items-center justify-between px-3 py-2 bg-muted rounded-lg hover:bg-accent transition-colors">
                              <span className="font-mono text-xs text-foreground">{pkg.scan_code || 'Sem código'}</span>
                              <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{pkg.status}</span><ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /></div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(order)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir pedido
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido {deleteTarget?.external_order_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá o pedido, seus itens e pacotes permanentemente. Digite <strong>EXCLUIR</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Digite EXCLUIR" className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} disabled={confirmText !== 'EXCLUIR' || deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

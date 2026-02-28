import { useState, useEffect, useCallback } from 'react';
import { Box, Search, RefreshCw, ChevronDown, ChevronUp, Trash2, Archive, Loader2 } from 'lucide-react';
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

interface VariantRow {
  id: string;
  variant_name: string | null;
  sku: string | null;
  attributes: Record<string, string>;
}

interface ProductRow {
  id: string;
  name: string;
  base_sku: string | null;
  created_at: string;
  is_archived: boolean;
  product_variants: VariantRow[];
}

export default function ProductsPage() {
  const { profile } = useApp();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleteAction, setDeleteAction] = useState<'delete' | 'archive'>('delete');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('products')
        .select('id, name, base_sku, created_at, is_archived, product_variants(id, variant_name, sku, attributes)')
        .eq('company_id', profile.company_id)
        .order('name', { ascending: true })
        .limit(300);

      if (!showArchived) q = q.eq('is_archived', false);
      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);

      const { data, error } = await q;
      if (error) throw error;
      setProducts(data as unknown as ProductRow[]);
    } catch {
      toast.error('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, search, showArchived]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteAction === 'archive') {
        await supabase.from('products').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', deleteTarget.id);
        toast.success('Produto arquivado.');
      } else {
        // Check if variants are in use
        const variantIds = deleteTarget.product_variants.map(v => v.id);
        if (variantIds.length > 0) {
          const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).in('variant_id', variantIds);
          if (count && count > 0) {
            toast.error('Produto em uso em pedidos. Use "Arquivar" em vez de excluir.');
            setDeleting(false);
            return;
          }
        }
        // Delete variants first, then product
        if (variantIds.length > 0) {
          await supabase.from('product_variants').delete().in('id', variantIds);
        }
        const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
        if (error) throw error;
        toast.success('Produto excluído.');
      }
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleUnarchive = async (productId: string) => {
    await supabase.from('products').update({ is_archived: false, archived_at: null }).eq('id', productId);
    toast.success('Produto restaurado.');
    load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Produtos</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{products.length} produto(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowArchived(!showArchived)} variant={showArchived ? 'secondary' : 'ghost'} size="sm">
            <Archive className="w-4 h-4 mr-1" /> {showArchived ? 'Ocultar arquivados' : 'Ver arquivados'}
          </Button>
          <Button onClick={load} variant="ghost" size="sm"><RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /></Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Buscar produto por nome..." className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16"><Box className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum produto encontrado.</p></div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const expanded = expandedId === product.id;
            return (
              <div key={product.id} className={cn('bg-card border border-border rounded-xl overflow-hidden', product.is_archived && 'opacity-60')}>
                <button onClick={() => setExpandedId(expanded ? null : product.id)} className="w-full p-4 text-left flex items-center gap-3 hover:bg-accent/50 transition-colors">
                  <Box className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.product_variants.length} variante(s)</span>
                      {product.is_archived && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Arquivado</span>}
                    </div>
                    {product.base_sku && <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.base_sku}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {product.product_variants.length > 0 && (
                      <div className="space-y-1.5">
                        {product.product_variants.map((v) => (
                          <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
                            <div>
                              <span className="text-sm text-foreground">{v.variant_name || v.sku || 'Sem nome'}</span>
                              {(v.attributes as any)?.size && <span className="ml-2 text-xs font-bold text-primary">TAM {(v.attributes as any).size}</span>}
                            </div>
                            {v.sku && <span className="text-xs text-muted-foreground font-mono">{v.sku}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {product.is_archived ? (
                        <Button variant="outline" size="sm" onClick={() => handleUnarchive(product.id)}>
                          <Archive className="w-3 h-3 mr-1" /> Restaurar
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(product); setDeleteAction('delete'); }}>
                            <Trash2 className="w-3 h-3 mr-1" /> Excluir
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(product); setDeleteAction('archive'); }}>
                            <Archive className="w-3 h-3 mr-1" /> Arquivar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteAction === 'archive' ? 'Arquivar' : 'Excluir'} "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAction === 'archive'
                ? 'O produto será ocultado das listagens mas poderá ser restaurado depois.'
                : 'Se o produto estiver em uso em pedidos, a exclusão será bloqueada. Nesse caso, use "Arquivar".'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} disabled={deleting} className={deleteAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : deleteAction === 'archive' ? 'Arquivar' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

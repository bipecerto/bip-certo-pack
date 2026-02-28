import { useState, useEffect, useCallback } from 'react';
import { Box, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  product_variants: VariantRow[];
}

export default function ProductsPage() {
  const { profile } = useApp();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('products')
        .select('id, name, base_sku, created_at, product_variants(id, variant_name, sku, attributes)')
        .eq('company_id', profile.company_id)
        .order('name', { ascending: true })
        .limit(300);

      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);

      const { data, error } = await q;
      if (error) throw error;
      setProducts(data as unknown as ProductRow[]);
    } catch {
      toast.error('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Produtos</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{products.length} produto(s)</p>
        </div>
        <Button onClick={load} variant="ghost" size="sm">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar produto por nome..."
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Box className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const expanded = expandedId === product.id;
            return (
              <div key={product.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : product.id)}
                  className="w-full p-4 text-left flex items-center gap-3 hover:bg-accent/50 transition-colors"
                >
                  <Box className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.product_variants.length} variante(s)</span>
                    </div>
                    {product.base_sku && <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.base_sku}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {expanded && product.product_variants.length > 0 && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-1.5">
                    {product.product_variants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
                        <div>
                          <span className="text-sm text-foreground">{v.variant_name || v.sku || 'Sem nome'}</span>
                          {(v.attributes as any)?.size && (
                            <span className="ml-2 text-xs font-bold text-primary">TAM {(v.attributes as any).size}</span>
                          )}
                        </div>
                        {v.sku && <span className="text-xs text-muted-foreground font-mono">{v.sku}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

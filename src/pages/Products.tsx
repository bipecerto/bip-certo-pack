import { useState, useEffect, useCallback } from 'react';
import { Box, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
      const db = supabase();
      let q = db
        .from('products')
        .select('id, name, base_sku, created_at, product_variants(id, variant_name, sku, attributes)')
        .eq('company_id', profile.company_id)
        .order('name', { ascending: true })
        .limit(300);

      if (search.trim()) {
        q = q.ilike('name', `%${search.trim()}%`);
      }

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
          <h2 className="text-xl font-semibold text-white">Produtos</h2>
          <p className="text-slate-400 text-sm mt-0.5">{products.length} produto(s)</p>
        </div>
        <Button onClick={load} variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar produto por nome..."
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Box className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const expanded = expandedId === product.id;
            return (
              <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : product.id)}
                  className="w-full p-4 text-left flex items-center gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <Box className="w-5 h-5 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{product.name}</span>
                      <span className="text-xs text-slate-500">
                        {product.product_variants.length} variante(s)
                      </span>
                    </div>
                    {product.base_sku && (
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{product.base_sku}</p>
                    )}
                  </div>
                  {expanded
                    ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />}
                </button>

                {expanded && product.product_variants.length > 0 && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-1.5">
                    {product.product_variants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-lg">
                        <div>
                          <span className="text-sm text-white">{v.variant_name || v.sku || 'Sem nome'}</span>
                          {(v.attributes as any)?.size && (
                            <span className="ml-2 text-xs font-bold text-indigo-400">
                              TAM {(v.attributes as any).size}
                            </span>
                          )}
                        </div>
                        {v.sku && (
                          <span className="text-xs text-slate-500 font-mono">{v.sku}</span>
                        )}
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

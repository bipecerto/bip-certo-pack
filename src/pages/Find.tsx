import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Tag, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Size = 'PP' | 'P' | 'M' | 'G' | 'GG' | 'GGG' | 'UN';
const SIZES: Size[] = ['PP', 'P', 'M', 'G', 'GG', 'GGG', 'UN'];

interface ResultRow {
  variantId: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  size: string | null;
  qty: number;
  packageId: string;
  scanCode: string | null;
  trackingCode: string | null;
  packageStatus: string;
  orderId: string;
  externalOrderId: string;
  customerName: string | null;
  marketplace: string;
}

const STATUS_COLOR: Record<string, string> = {
  packed: 'bg-info/10 text-info border-info/20',
  checking: 'bg-warning/10 text-warning border-warning/20',
  shipped: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function FindPage() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!profile?.company_id) return;
    if (!term.trim() && !selectedSize) {
      toast.error('Digite um termo ou selecione um tamanho.');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      let variantQuery = supabase
        .from('product_variants')
        .select('id, variant_name, sku, attributes, product:products(name)')
        .eq('company_id', profile.company_id);

      if (term.trim()) {
        variantQuery = variantQuery.or(`variant_name.ilike.%${term.trim()}%,sku.ilike.%${term.trim()}%`);
      }
      if (selectedSize) {
        variantQuery = variantQuery.contains('attributes', { size: selectedSize });
      }

      const { data: variants, error: vErr } = await variantQuery.limit(100);
      if (vErr) throw vErr;
      if (!variants || variants.length === 0) { setResults([]); return; }

      const variantIds = variants.map((v) => v.id);
      const { data: pkgItems, error: piErr } = await supabase
        .from('package_items')
        .select(`qty, variant_id, package:packages(id, scan_code, tracking_code, status, order:orders(id, external_order_id, customer_name, marketplace))`)
        .eq('company_id', profile.company_id)
        .in('variant_id', variantIds);

      if (piErr) throw piErr;
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      const rows: ResultRow[] = (pkgItems || [])
        .filter((pi: any) => pi.package)
        .map((pi: any) => {
          const v = variantMap.get(pi.variant_id);
          const pkg = pi.package;
          const order = pkg.order;
          return {
            variantId: pi.variant_id,
            productName: (v?.product as any)?.name || 'Produto desconhecido',
            variantName: v?.variant_name || null,
            sku: v?.sku || null,
            size: (v?.attributes as any)?.size || null,
            qty: pi.qty,
            packageId: pkg.id,
            scanCode: pkg.scan_code,
            trackingCode: pkg.tracking_code,
            packageStatus: pkg.status,
            orderId: order?.id || '',
            externalOrderId: order?.external_order_id || '',
            customerName: order?.customer_name || null,
            marketplace: order?.marketplace || '',
          };
        });

      setResults(rows);
    } catch (err) {
      toast.error('Erro na busca: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, term, selectedSize]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Pesquisar Item</h2>
        <p className="text-muted-foreground text-sm mt-1">Encontre em qual pacote está um produto.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nome do produto, variante ou SKU..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading} className="px-6">
            {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Filter className="w-3.5 h-3.5" /> Filtrar por tamanho
          </div>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-bold border transition-all',
                  selectedSize === size
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {searched && !loading && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {results.length === 0 ? 'Nenhum resultado encontrado.' : `${results.length} resultado(s)`}
          </p>
          <div className="space-y-2">
            {results.map((row, i) => (
              <button
                key={i}
                onClick={() => navigate(`/package/${row.packageId}`)}
                className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground font-medium">{row.productName}</span>
                      {row.variantName && <span className="text-muted-foreground text-sm">{row.variantName}</span>}
                      {row.size && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          TAM {row.size}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">×{row.qty}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Package className="w-3.5 h-3.5" />
                        <span className="font-mono">{row.scanCode || row.trackingCode || 'Sem código'}</span>
                      </div>
                      {row.customerName && <span className="text-xs text-muted-foreground">• {row.customerName}</span>}
                      <span className="text-xs font-medium text-muted-foreground uppercase">{row.marketplace}</span>
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-mono">{row.externalOrderId}</span>
                      </div>
                    </div>
                  </div>
                  <span className={cn('shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border', STATUS_COLOR[row.packageStatus] || STATUS_COLOR['packed'])}>
                    {row.packageStatus}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

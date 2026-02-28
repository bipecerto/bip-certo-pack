import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Tag, Filter, Loader2 } from 'lucide-react';
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
  verified: 'bg-green-100 text-green-800 border-green-200',
  shipped: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABEL: Record<string, string> = {
  packed: 'Embalado',
  checking: 'Em Conferência',
  verified: 'Verificado',
  shipped: 'Enviado',
  cancelled: 'Cancelado',
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
      const companyId = profile.company_id;
      const query = term.trim();
      const rows: ResultRow[] = [];

      // Strategy: query order_items as base, join variants+products, then for each match get packages
      // Step 1: Find matching variant IDs
      let variantQuery = supabase
        .from('product_variants')
        .select('id, variant_name, sku, attributes, product:products!inner(name)')
        .eq('company_id', companyId);

      if (query) {
        // Search product name via inner join, or variant_name/sku
        variantQuery = variantQuery.or(`variant_name.ilike.%${query}%,sku.ilike.%${query}%,product.name.ilike.%${query}%`);
      }
      if (selectedSize) {
        variantQuery = variantQuery.filter('attributes->>size', 'eq', selectedSize);
      }

      const { data: variants, error: vErr } = await variantQuery.limit(200);
      if (vErr) throw vErr;

      // Step 2: Also search by tracking/scan_code/external_order_id directly
      let directPackages: any[] = [];
      if (query) {
        const { data: pkgDirect } = await supabase
          .from('packages')
          .select('id, scan_code, tracking_code, status, order:orders!inner(id, external_order_id, customer_name, marketplace)')
          .eq('company_id', companyId)
          .or(`scan_code.eq.${query},tracking_code.eq.${query},order.external_order_id.eq.${query}`)
          .limit(50);
        directPackages = pkgDirect || [];
      }

      // Step 3: For variant matches, get order_items -> packages
      if (variants && variants.length > 0) {
        const variantIds = variants.map((v) => v.id);
        // Get order_items for these variants
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('qty, variant_id, order:orders!inner(id, external_order_id, customer_name, marketplace)')
          .eq('company_id', companyId)
          .in('variant_id', variantIds);

        if (orderItems && orderItems.length > 0) {
          const orderIds = [...new Set(orderItems.map((oi: any) => oi.order.id))];
          // Get packages for these orders
          const { data: pkgs } = await supabase
            .from('packages')
            .select('id, scan_code, tracking_code, status, order_id')
            .eq('company_id', companyId)
            .in('order_id', orderIds);

          const pkgMap = new Map<string, any[]>();
          (pkgs || []).forEach((p: any) => {
            if (!pkgMap.has(p.order_id)) pkgMap.set(p.order_id, []);
            pkgMap.get(p.order_id)!.push(p);
          });

          const variantMap = new Map(variants.map((v) => [v.id, v]));

          for (const oi of orderItems as any[]) {
            const v = variantMap.get(oi.variant_id);
            const order = oi.order;
            const packages = pkgMap.get(order.id) || [];
            
            if (packages.length === 0) {
              // Show even without package
              rows.push({
                variantId: oi.variant_id,
                productName: (v?.product as any)?.name || 'Produto desconhecido',
                variantName: v?.variant_name || null,
                sku: v?.sku || null,
                size: (v?.attributes as any)?.size || null,
                qty: oi.qty,
                packageId: '',
                scanCode: null,
                trackingCode: null,
                packageStatus: 'packed',
                orderId: order.id,
                externalOrderId: order.external_order_id || '',
                customerName: order.customer_name || null,
                marketplace: order.marketplace || '',
              });
            } else {
              for (const pkg of packages) {
                rows.push({
                  variantId: oi.variant_id,
                  productName: (v?.product as any)?.name || 'Produto desconhecido',
                  variantName: v?.variant_name || null,
                  sku: v?.sku || null,
                  size: (v?.attributes as any)?.size || null,
                  qty: oi.qty,
                  packageId: pkg.id,
                  scanCode: pkg.scan_code,
                  trackingCode: pkg.tracking_code,
                  packageStatus: pkg.status,
                  orderId: order.id,
                  externalOrderId: order.external_order_id || '',
                  customerName: order.customer_name || null,
                  marketplace: order.marketplace || '',
                });
              }
            }
          }
        }
      }

      // Step 4: Add direct package matches (not already included)
      const existingPkgIds = new Set(rows.map((r) => r.packageId));
      for (const pkg of directPackages) {
        if (existingPkgIds.has(pkg.id)) continue;
        const order = pkg.order;
        rows.push({
          variantId: '',
          productName: '—',
          variantName: null,
          sku: null,
          size: null,
          qty: 0,
          packageId: pkg.id,
          scanCode: pkg.scan_code,
          trackingCode: pkg.tracking_code,
          packageStatus: pkg.status,
          orderId: order?.id || '',
          externalOrderId: order?.external_order_id || '',
          customerName: order?.customer_name || null,
          marketplace: order?.marketplace || '',
        });
      }

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
        <p className="text-muted-foreground text-sm mt-1">Encontre em qual pacote está um produto, ou busque por código de rastreio.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Produto, SKU, tracking, scan code ou ID do pedido..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading} className="px-6">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
            {results.length === 0 ? 'Nenhum item encontrado. Verifique se os pedidos já foram importados.' : `${results.length} resultado(s)`}
          </p>
          <div className="space-y-2">
            {results.map((row, i) => (
              <button
                key={`${row.packageId || row.orderId}-${row.variantId}-${i}`}
                onClick={() => row.packageId ? navigate(`/package/${row.packageId}`) : null}
                disabled={!row.packageId}
                className={cn(
                  'w-full bg-card border border-border rounded-2xl p-4 text-left transition-all',
                  row.packageId ? 'hover:border-primary/40 hover:shadow-sm cursor-pointer' : 'opacity-70 cursor-default'
                )}
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
                      {row.qty > 0 && <span className="text-xs text-muted-foreground">×{row.qty}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Package className="w-3.5 h-3.5" />
                        <span className="font-mono">{row.scanCode || row.trackingCode || 'Sem pacote'}</span>
                      </div>
                      {row.customerName && <span className="text-xs text-muted-foreground">• {row.customerName}</span>}
                      {row.marketplace && <span className="text-xs font-medium text-muted-foreground uppercase">{row.marketplace}</span>}
                      {row.externalOrderId && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-mono">{row.externalOrderId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={cn('shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border', STATUS_COLOR[row.packageStatus] || STATUS_COLOR['packed'])}>
                    {STATUS_LABEL[row.packageStatus] || row.packageStatus}
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface FindResult {
  package_item_id: string;
  qty: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  attributes: Record<string, string> | null;
  package_id: string;
  scan_code: string | null;
  tracking_code: string | null;
  package_status: string;
  last_scanned_at: string | null;
  marketplace: string | null;
  external_order_id: string | null;
}

export default function FindPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [results, setResults] = useState<FindResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);

    // Search product_variants via products name or sku
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, variant_name, sku, attributes, product_id")
      .or(`variant_name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);

    // Also search products by name
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .ilike("name", `%${searchTerm}%`);

    const productIds = products?.map((p) => p.id) || [];

    // Get variants from matching products
    let allVariantIds = new Set(variants?.map((v) => v.id) || []);
    if (productIds.length > 0) {
      const { data: productVariants } = await supabase
        .from("product_variants")
        .select("id, variant_name, sku, attributes, product_id")
        .in("product_id", productIds);
      productVariants?.forEach((v) => allVariantIds.add(v.id));
    }

    if (allVariantIds.size === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Get package_items for these variants
    const { data: pkgItems } = await supabase
      .from("package_items")
      .select("id, qty, variant_id, package_id")
      .in("variant_id", Array.from(allVariantIds));

    if (!pkgItems || pkgItems.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const enriched: FindResult[] = [];
    for (const pi of pkgItems) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("variant_name, sku, attributes, product_id")
        .eq("id", pi.variant_id!)
        .single();

      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", variant?.product_id || "")
        .single();

      const { data: pkg } = await supabase
        .from("packages")
        .select("scan_code, tracking_code, status, last_scanned_at, order_id")
        .eq("id", pi.package_id)
        .single();

      let marketplace = null;
      let external_order_id = null;
      if (pkg?.order_id) {
        const { data: order } = await supabase
          .from("orders")
          .select("marketplace, external_order_id")
          .eq("id", pkg.order_id)
          .single();
        marketplace = order?.marketplace ?? null;
        external_order_id = order?.external_order_id ?? null;
      }

      const attrs = variant?.attributes as Record<string, string> | null;

      // Apply size filter
      if (sizeFilter !== "all" && attrs?.size !== sizeFilter) continue;

      enriched.push({
        package_item_id: pi.id,
        qty: pi.qty,
        product_name: product?.name || "—",
        variant_name: variant?.variant_name ?? null,
        sku: variant?.sku ?? null,
        attributes: attrs,
        package_id: pi.package_id,
        scan_code: pkg?.scan_code ?? null,
        tracking_code: pkg?.tracking_code ?? null,
        package_status: pkg?.status || "—",
        last_scanned_at: pkg?.last_scanned_at ?? null,
        marketplace,
        external_order_id,
      });
    }

    setResults(enriched);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buscar Item</h1>
        <p className="text-muted-foreground">Encontre em qual pacote está um item específico</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Nome do produto, SKU ou termo..."
            className="pl-10"
          />
        </div>
        <Select value={sizeFilter} onValueChange={setSizeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Tamanho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PP">PP</SelectItem>
            <SelectItem value="P">P</SelectItem>
            <SelectItem value="M">M</SelectItem>
            <SelectItem value="G">G</SelectItem>
            <SelectItem value="GG">GG</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Pacote (scan)</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow
                    key={r.package_item_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/package/${r.package_id}`)}
                  >
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell>
                      {r.variant_name || "—"}
                      {r.attributes?.size && (
                        <Badge variant="outline" className="ml-1">{r.attributes.size}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.qty}</TableCell>
                    <TableCell className="font-mono text-xs">{r.scan_code || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.tracking_code || "—"}</TableCell>
                    <TableCell>{r.marketplace || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.package_status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        !loading && searchTerm && (
          <p className="text-center text-muted-foreground">Nenhum resultado encontrado.</p>
        )
      )}
    </div>
  );
}

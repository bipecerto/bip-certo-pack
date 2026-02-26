import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Package, Truck, XCircle, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface PackageData {
  id: string;
  scan_code: string | null;
  tracking_code: string | null;
  status: string;
  package_number: number;
  last_scanned_at: string | null;
  order_id: string;
  company_id: string;
}

interface OrderData {
  marketplace: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  address_summary: string | null;
  status: string;
}

interface PackageItemRow {
  id: string;
  qty: number;
  variant_id: string | null;
  product_name?: string;
  variant_name?: string;
  sku?: string;
  attributes?: Record<string, string>;
}

const statusColors: Record<string, string> = {
  packed: "bg-info text-info-foreground",
  checked: "bg-warning text-warning-foreground",
  shipped: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  received: "bg-muted text-muted-foreground",
};

export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<PackageData | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [items, setItems] = useState<PackageItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [addQty, setAddQty] = useState(1);

  const fetchData = async () => {
    if (!id) return;
    const { data: pkgData } = await supabase
      .from("packages")
      .select("*")
      .eq("id", id)
      .single();

    if (!pkgData) { setLoading(false); return; }
    setPkg(pkgData);

    const { data: orderData } = await supabase
      .from("orders")
      .select("marketplace, external_order_id, customer_name, address_summary, status")
      .eq("id", pkgData.order_id)
      .single();
    setOrder(orderData);

    const { data: pkgItems } = await supabase
      .from("package_items")
      .select("id, qty, variant_id")
      .eq("package_id", id);

    if (pkgItems) {
      const enriched: PackageItemRow[] = [];
      for (const item of pkgItems) {
        if (item.variant_id) {
          const { data: variant } = await supabase
            .from("product_variants")
            .select("variant_name, sku, attributes, product_id")
            .eq("id", item.variant_id)
            .single();
          if (variant) {
            const { data: product } = await supabase
              .from("products")
              .select("name")
              .eq("id", variant.product_id)
              .single();
            enriched.push({
              ...item,
              product_name: product?.name,
              variant_name: variant.variant_name ?? undefined,
              sku: variant.sku ?? undefined,
              attributes: variant.attributes as Record<string, string> | undefined,
            });
          } else {
            enriched.push(item);
          }
        } else {
          enriched.push(item);
        }
      }
      setItems(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAction = async (action: string, newStatus: string) => {
    if (!pkg || !companyId || !user) return;
    await supabase.from("scans").insert({
      company_id: companyId,
      package_id: pkg.id,
      user_id: user.id,
      action,
    });
    await supabase
      .from("packages")
      .update({ status: newStatus, last_scanned_at: new Date().toISOString() })
      .eq("id", pkg.id);
    toast({ title: `Status: ${action}` });
    fetchData();
  };

  const handleAddItem = async () => {
    if (!selectedVariant || !pkg || !companyId) return;
    await supabase.from("package_items").insert({
      company_id: companyId,
      package_id: pkg.id,
      variant_id: selectedVariant,
      qty: addQty,
    });
    toast({ title: "Item adicionado" });
    setAddDialogOpen(false);
    setSelectedVariant("");
    setAddQty(1);
    fetchData();
  };

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("product_variants")
      .select("id, variant_name, sku, product_id, attributes")
      .then(({ data }) => {
        if (data) {
          Promise.all(
            data.map(async (v) => {
              const { data: p } = await supabase
                .from("products")
                .select("name")
                .eq("id", v.product_id)
                .single();
              return { ...v, product_name: p?.name };
            })
          ).then(setVariants);
        }
      });
  }, [companyId]);

  if (loading) return <p className="p-8 text-center text-muted-foreground">Carregando...</p>;
  if (!pkg) return <p className="p-8 text-center text-muted-foreground">Pacote não encontrado.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pacote #{pkg.package_number}</h1>
          <p className="text-sm text-muted-foreground">
            {order?.marketplace && <Badge variant="outline" className="mr-2">{order.marketplace}</Badge>}
            {order?.external_order_id}
          </p>
        </div>
        <Badge className={statusColors[pkg.status] || "bg-muted"}>{pkg.status}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pedido</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><strong>Cliente:</strong> {order?.customer_name || "—"}</p>
            <p><strong>Endereço:</strong> {order?.address_summary || "—"}</p>
            <p><strong>Status pedido:</strong> {order?.status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Etiqueta</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><strong>Scan code:</strong> <span className="font-mono">{pkg.scan_code || "—"}</span></p>
            <p><strong>Tracking:</strong> <span className="font-mono">{pkg.tracking_code || "—"}</span></p>
            <p><strong>Último scan:</strong> {pkg.last_scanned_at ? new Date(pkg.last_scanned_at).toLocaleString("pt-BR") : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => handleAction("checked", "checked")} className="gap-1">
          <CheckCircle className="h-4 w-4" /> Conferido
        </Button>
        <Button size="sm" onClick={() => handleAction("packed", "packed")} variant="secondary" className="gap-1">
          <Package className="h-4 w-4" /> Empacotado
        </Button>
        <Button size="sm" onClick={() => handleAction("shipped", "shipped")} variant="secondary" className="gap-1">
          <Truck className="h-4 w-4" /> Enviado
        </Button>
        <Button size="sm" onClick={() => handleAction("cancelled", "cancelled")} variant="destructive" className="gap-1">
          <XCircle className="h-4 w-4" /> Cancelado
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Conteúdo do Pacote</CardTitle>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-4 w-4" /> Adicionar Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar item ao pacote</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto/variante" /></SelectTrigger>
                  <SelectContent>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.product_name} — {v.variant_name || v.sku || "sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min={1} value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} placeholder="Quantidade" />
                <Button onClick={handleAddItem} className="w-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item neste pacote.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name || "—"}</TableCell>
                    <TableCell>
                      {item.variant_name || "—"}
                      {item.attributes?.size && <Badge variant="outline" className="ml-2">{item.attributes.size}</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.sku || "—"}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2 } from "lucide-react";

type MarketplaceTemplate = "shopee" | "aliexpress" | "shein";

interface ColumnMapping {
  order_id: string;
  product_name: string;
  variant: string;
  qty: string;
  customer_name: string;
  address: string;
  tracking_code: string;
  sku: string;
}

const TEMPLATES: Record<MarketplaceTemplate, ColumnMapping> = {
  shopee: {
    order_id: "Nº do pedido",
    product_name: "Nome do produto",
    variant: "Nome da variação",
    qty: "Quantidade",
    customer_name: "Nome do comprador",
    address: "Endereço de envio",
    tracking_code: "Número de rastreamento",
    sku: "Número de referência SKU",
  },
  aliexpress: {
    order_id: "Order ID",
    product_name: "Product Name",
    variant: "Product Properties",
    qty: "Quantity",
    customer_name: "Buyer Name",
    address: "Shipping Address",
    tracking_code: "Tracking Number",
    sku: "SKU",
  },
  shein: {
    order_id: "Order No.",
    product_name: "Product Name",
    variant: "Size",
    qty: "Quantity",
    customer_name: "Customer Name",
    address: "Address",
    tracking_code: "Tracking No.",
    sku: "SKU",
  },
};

interface ImportReport {
  orders: number;
  products: number;
  variants: number;
  packages: number;
  errors: string[];
}

export default function ImportsPage() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<MarketplaceTemplate>("shopee");
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(TEMPLATES.shopee);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      if (lines.length > 0) {
        setHeaders(lines[0]);
        setCsvData(lines.slice(1).filter((l) => l.length > 1));
      }
    };
    reader.readAsText(file);
  };

  const handleTemplateChange = (t: MarketplaceTemplate) => {
    setTemplate(t);
    setMapping(TEMPLATES[t]);
  };

  const findCol = (row: string[], colName: string): string => {
    const idx = headers.indexOf(colName);
    return idx >= 0 ? row[idx] || "" : "";
  };

  const handleImport = async () => {
    if (!csvData || !companyId) return;
    setImporting(true);

    const rep: ImportReport = { orders: 0, products: 0, variants: 0, packages: 0, errors: [] };
    const productCache = new Map<string, string>();
    const variantCache = new Map<string, string>();
    const orderCache = new Map<string, string>();

    for (const row of csvData) {
      try {
        const orderId = findCol(row, mapping.order_id);
        const productName = findCol(row, mapping.product_name);
        const variantName = findCol(row, mapping.variant);
        const qty = parseInt(findCol(row, mapping.qty)) || 1;
        const customerName = findCol(row, mapping.customer_name);
        const address = findCol(row, mapping.address);
        const trackingCode = findCol(row, mapping.tracking_code);
        const sku = findCol(row, mapping.sku);

        if (!orderId && !productName) continue;

        // Product
        let productId = productCache.get(productName);
        if (!productId && productName) {
          const { data: existing } = await supabase
            .from("products")
            .select("id")
            .eq("name", productName)
            .maybeSingle();

          if (existing) {
            productId = existing.id;
          } else {
            const { data: newProd } = await supabase
              .from("products")
              .insert({ company_id: companyId, name: productName, base_sku: sku || null })
              .select("id")
              .single();
            if (newProd) {
              productId = newProd.id;
              rep.products++;
            }
          }
          if (productId) productCache.set(productName, productId);
        }

        // Variant
        let variantId = variantCache.get(`${productName}|${variantName}`);
        if (!variantId && productId && variantName) {
          const { data: existingVar } = await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", productId)
            .eq("variant_name", variantName)
            .maybeSingle();

          if (existingVar) {
            variantId = existingVar.id;
          } else {
            // Try to extract size
            const sizeMatch = variantName.match(/\b(PP|P|M|G|GG|XL|XXL|S|L)\b/i);
            const attrs: Record<string, string> = {};
            if (sizeMatch) attrs.size = sizeMatch[1].toUpperCase();

            const { data: newVar } = await supabase
              .from("product_variants")
              .insert({
                company_id: companyId,
                product_id: productId,
                variant_name: variantName,
                sku: sku || null,
                attributes: attrs,
              })
              .select("id")
              .single();
            if (newVar) {
              variantId = newVar.id;
              rep.variants++;
            }
          }
          if (variantId) variantCache.set(`${productName}|${variantName}`, variantId);
        }

        // Order
        let dbOrderId = orderCache.get(orderId);
        if (!dbOrderId && orderId) {
          const { data: existingOrder } = await supabase
            .from("orders")
            .select("id")
            .eq("external_order_id", orderId)
            .maybeSingle();

          if (existingOrder) {
            dbOrderId = existingOrder.id;
          } else {
            const marketplace = template.charAt(0).toUpperCase() + template.slice(1);
            const { data: newOrder } = await supabase
              .from("orders")
              .insert({
                company_id: companyId,
                marketplace,
                external_order_id: orderId,
                customer_name: customerName || null,
                address_summary: address || null,
              })
              .select("id")
              .single();
            if (newOrder) {
              dbOrderId = newOrder.id;
              rep.orders++;
            }
          }
          if (dbOrderId) orderCache.set(orderId, dbOrderId);
        }

        // Order item
        if (dbOrderId) {
          await supabase.from("order_items").insert({
            company_id: companyId,
            order_id: dbOrderId,
            variant_id: variantId || null,
            qty,
          });
        }

        // Package (if tracking code exists)
        if (trackingCode && dbOrderId) {
          const { data: existingPkg } = await supabase
            .from("packages")
            .select("id")
            .eq("tracking_code", trackingCode)
            .maybeSingle();

          if (!existingPkg) {
            const { data: newPkg } = await supabase
              .from("packages")
              .insert({
                company_id: companyId,
                order_id: dbOrderId,
                tracking_code: trackingCode,
                scan_code: trackingCode,
              })
              .select("id")
              .single();
            if (newPkg) {
              rep.packages++;
              // Add item to package
              if (variantId) {
                await supabase.from("package_items").insert({
                  company_id: companyId,
                  package_id: newPkg.id,
                  variant_id: variantId,
                  qty,
                });
              }
            }
          }
        }
      } catch (err: any) {
        rep.errors.push(err.message || "Erro desconhecido");
      }
    }

    setReport(rep);
    setImporting(false);
    toast({ title: "Importação concluída!" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar CSV</h1>
        <p className="text-muted-foreground">Importe pedidos de Shopee, AliExpress ou Shein</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Selecione o template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={template} onValueChange={(v) => handleTemplateChange(v as MarketplaceTemplate)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shopee">Shopee</SelectItem>
                <SelectItem value="aliexpress">AliExpress</SelectItem>
                <SelectItem value="shein">Shein</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Colunas esperadas:</p>
              <div className="flex flex-wrap gap-1">
                {Object.values(mapping).map((col) => (
                  <Badge key={col} variant="outline" className="text-xs">{col}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition hover:border-primary hover:bg-muted/50"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para selecionar arquivo CSV</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            {csvData && (
              <div className="flex items-center gap-2 text-sm text-success">
                <FileText className="h-4 w-4" />
                {csvData.length} linhas carregadas ({headers.length} colunas)
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {csvData && (
        <div className="flex justify-center">
          <Button onClick={handleImport} disabled={importing} size="lg" className="gap-2">
            {importing ? "Importando..." : "Iniciar Importação"}
          </Button>
        </div>
      )}

      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Relatório de Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{report.orders}</p>
                <p className="text-sm text-muted-foreground">Pedidos</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{report.products}</p>
                <p className="text-sm text-muted-foreground">Produtos</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{report.variants}</p>
                <p className="text-sm text-muted-foreground">Variantes</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{report.packages}</p>
                <p className="text-sm text-muted-foreground">Pacotes</p>
              </div>
            </div>
            {report.errors.length > 0 && (
              <div className="mt-4 rounded border border-destructive/30 bg-destructive/10 p-3">
                <p className="mb-1 text-sm font-medium">Erros ({report.errors.length}):</p>
                {report.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

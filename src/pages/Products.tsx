import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Box } from "lucide-react";

interface Product {
  id: string;
  name: string;
  base_sku: string | null;
  created_at: string;
  variants: { id: string; variant_name: string | null; sku: string | null; attributes: Record<string, string> | null }[];
}

const SIZES = ["PP", "P", "M", "G", "GG"];

export default function ProductsPage() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", base_sku: "" });
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  const fetchProducts = async () => {
    if (!companyId) return;
    const { data: prods } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (prods) {
      const enriched: Product[] = [];
      for (const p of prods) {
        const { data: vars } = await supabase
          .from("product_variants")
          .select("id, variant_name, sku, attributes")
          .eq("product_id", p.id);
        enriched.push({
          ...p,
          variants: (vars || []).map((v) => ({
            ...v,
            attributes: v.attributes as Record<string, string> | null,
          })),
        });
      }
      setProducts(enriched);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [companyId]);

  const handleCreate = async () => {
    if (!companyId || !form.name) return;
    const { data: product, error } = await supabase
      .from("products")
      .insert({ company_id: companyId, name: form.name, base_sku: form.base_sku || null })
      .select()
      .single();

    if (error || !product) {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
      return;
    }

    // Create variants for selected sizes
    if (selectedSizes.length > 0) {
      const variants = selectedSizes.map((size) => ({
        company_id: companyId,
        product_id: product.id,
        variant_name: `${form.name} - ${size}`,
        sku: form.base_sku ? `${form.base_sku}-${size}` : null,
        attributes: { size },
      }));
      await supabase.from("product_variants").insert(variants);
    }

    toast({ title: "Produto criado" });
    setDialogOpen(false);
    setForm({ name: "", base_sku: "" });
    setSelectedSizes([]);
    fetchProducts();
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">{products.length} produtos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Produto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do Produto</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Calça Jeans" />
              </div>
              <div>
                <Label>SKU Base</Label>
                <Input value={form.base_sku} onChange={(e) => setForm({ ...form, base_sku: e.target.value })} placeholder="Ex: CJ-001" />
              </div>
              <div>
                <Label>Tamanhos (variantes rápidas)</Label>
                <div className="mt-2 flex gap-3">
                  {SIZES.map((size) => (
                    <label key={size} className="flex items-center gap-1.5">
                      <Checkbox
                        checked={selectedSizes.includes(size)}
                        onCheckedChange={() => toggleSize(size)}
                      />
                      <span className="text-sm">{size}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">Criar Produto</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{product.name}</CardTitle>
              {product.base_sku && (
                <Badge variant="outline" className="font-mono">{product.base_sku}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {product.variants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <Badge key={v.id} variant="secondary">
                    {v.variant_name || v.sku || "Variante"}
                    {v.attributes?.size && ` (${v.attributes.size})`}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem variantes</p>
            )}
          </CardContent>
        </Card>
      ))}

      {products.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <Box className="mx-auto mb-3 h-12 w-12" />
          <p>Nenhum produto cadastrado</p>
        </div>
      )}
    </div>
  );
}

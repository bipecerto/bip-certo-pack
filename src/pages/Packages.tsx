import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package } from "lucide-react";

interface PkgRow {
  id: string;
  scan_code: string | null;
  tracking_code: string | null;
  status: string;
  package_number: number;
  last_scanned_at: string | null;
  order_id: string;
  external_order_id?: string | null;
}

export default function PackagesPage() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PkgRow[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orders, setOrders] = useState<{ id: string; external_order_id: string | null }[]>([]);
  const [form, setForm] = useState({ order_id: "", scan_code: "", tracking_code: "", package_number: 1 });

  const fetchPackages = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("packages")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const enriched: PkgRow[] = [];
      for (const p of data) {
        const { data: order } = await supabase
          .from("orders")
          .select("external_order_id")
          .eq("id", p.order_id)
          .single();
        enriched.push({ ...p, external_order_id: order?.external_order_id });
      }
      setPackages(enriched);
    }
  };

  const fetchOrders = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("orders").select("id, external_order_id");
    setOrders(data || []);
  };

  useEffect(() => {
    fetchPackages();
    fetchOrders();
  }, [companyId]);

  const handleCreate = async () => {
    if (!companyId || !form.order_id) return;
    const { error } = await supabase.from("packages").insert({
      company_id: companyId,
      order_id: form.order_id,
      scan_code: form.scan_code || null,
      tracking_code: form.tracking_code || null,
      package_number: form.package_number,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pacote criado" });
      setDialogOpen(false);
      setForm({ order_id: "", scan_code: "", tracking_code: "", package_number: 1 });
      fetchPackages();
    }
  };

  const filtered = packages.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.scan_code?.toLowerCase().includes(s) ||
      p.tracking_code?.toLowerCase().includes(s) ||
      p.external_order_id?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pacotes</h1>
          <p className="text-muted-foreground">{packages.length} pacotes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Pacote</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Pacote</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Pedido</Label>
                <Select value={form.order_id} onValueChange={(v) => setForm({ ...form, order_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o pedido" /></SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.external_order_id || o.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scan Code</Label>
                <Input value={form.scan_code} onChange={(e) => setForm({ ...form, scan_code: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label>Tracking Code</Label>
                <Input value={form.tracking_code} onChange={(e) => setForm({ ...form, tracking_code: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label>Número do pacote</Label>
                <Input type="number" min={1} value={form.package_number} onChange={(e) => setForm({ ...form, package_number: Number(e.target.value) })} />
              </div>
              <Button onClick={handleCreate} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por scan_code, tracking ou pedido..."
        className="max-w-md"
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Scan Code</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/package/${p.id}`)}
                >
                  <TableCell>{p.package_number}</TableCell>
                  <TableCell className="font-mono text-sm">{p.scan_code || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{p.tracking_code || "—"}</TableCell>
                  <TableCell className="text-sm">{p.external_order_id || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.last_scanned_at ? new Date(p.last_scanned_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8" />
                    Nenhum pacote encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

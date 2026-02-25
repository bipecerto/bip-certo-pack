import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShoppingCart } from "lucide-react";

interface Order {
  id: string;
  marketplace: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  status: string;
  created_at: string;
}

export default function OrdersPage() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterMarketplace, setFilterMarketplace] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    marketplace: "",
    external_order_id: "",
    customer_name: "",
    address_summary: "",
  });

  const fetchOrders = async () => {
    if (!companyId) return;
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (filterMarketplace !== "all") q = q.eq("marketplace", filterMarketplace);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    const { data } = await q;
    setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();
  }, [companyId, filterMarketplace, filterStatus]);

  const handleCreate = async () => {
    if (!companyId) return;
    const { error } = await supabase.from("orders").insert({
      company_id: companyId,
      ...form,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pedido criado" });
      setDialogOpen(false);
      setForm({ marketplace: "", external_order_id: "", customer_name: "", address_summary: "" });
      fetchOrders();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground">{orders.length} pedidos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Pedido</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Marketplace</Label>
                <Select value={form.marketplace} onValueChange={(v) => setForm({ ...form, marketplace: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Shopee">Shopee</SelectItem>
                    <SelectItem value="AliExpress">AliExpress</SelectItem>
                    <SelectItem value="Shein">Shein</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ID do Pedido (externo)</Label>
                <Input value={form.external_order_id} onChange={(e) => setForm({ ...form, external_order_id: e.target.value })} />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div>
                <Label>Endereço resumido</Label>
                <Input value={form.address_summary} onChange={(e) => setForm({ ...form, address_summary: e.target.value })} />
              </div>
              <Button onClick={handleCreate} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <Select value={filterMarketplace} onValueChange={setFilterMarketplace}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Marketplace" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Shopee">Shopee</SelectItem>
            <SelectItem value="AliExpress">AliExpress</SelectItem>
            <SelectItem value="Shein">Shein</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
            <SelectItem value="packed">Empacotado</SelectItem>
            <SelectItem value="shipped">Enviado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marketplace</TableHead>
                <TableHead>ID Externo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell><Badge variant="outline">{o.marketplace || "—"}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{o.external_order_id || "—"}</TableCell>
                  <TableCell>{o.customer_name || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum pedido encontrado
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

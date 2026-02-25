import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scan, CheckCircle2, XCircle, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ScannerPage() {
  const [scanValue, setScanValue] = useState("");
  const [status, setStatus] = useState<"idle" | "found" | "not-found">("idle");
  const [lastScan, setLastScan] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !scanValue.trim() || !companyId) return;

    const code = scanValue.trim();
    setLastScan(code);

    // Try scan_code first
    const { data: pkg } = await supabase
      .from("packages")
      .select("id")
      .eq("scan_code", code)
      .maybeSingle();

    if (pkg) {
      setStatus("found");
      toast({ title: "Pacote encontrado!" });
      setTimeout(() => navigate(`/package/${pkg.id}`), 500);
      setScanValue("");
      return;
    }

    // Fallback: try external_order_id
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("external_order_id", code)
      .maybeSingle();

    if (order) {
      // Check if order has packages
      const { data: orderPkgs } = await supabase
        .from("packages")
        .select("id")
        .eq("order_id", order.id)
        .limit(1);

      if (orderPkgs && orderPkgs.length > 0) {
        setStatus("found");
        toast({ title: "Pedido encontrado!" });
        setTimeout(() => navigate(`/package/${orderPkgs[0].id}`), 500);
      } else {
        setStatus("found");
        toast({ title: "Pedido encontrado sem pacote", description: "Crie um pacote na tela de pedidos." });
        setTimeout(() => navigate(`/orders`), 800);
      }
      setScanValue("");
      return;
    }

    setStatus("not-found");
    toast({ title: "Não encontrado", description: `Código "${code}" não localizado.`, variant: "destructive" });
    setScanValue("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Scanner</h1>
        <p className="mt-1 text-muted-foreground">
          Bipe ou cole o código da etiqueta
        </p>
      </div>

      <Card
        className={`transition-all duration-300 ${
          status === "found"
            ? "border-success ring-2 ring-success/30"
            : status === "not-found"
            ? "border-destructive ring-2 ring-destructive/30"
            : "border-border"
        }`}
      >
        <CardContent className="p-8">
          <div className="relative">
            <Scan className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={scanValue}
              onChange={(e) => {
                setScanValue(e.target.value);
                setStatus("idle");
              }}
              onKeyDown={handleScan}
              placeholder="Escaneie ou digite o código..."
              className="h-16 pl-14 font-mono text-xl tracking-wider"
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {status !== "idle" && (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            {status === "found" ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-success" />
                <div>
                  <p className="text-lg font-semibold">Encontrado!</p>
                  <p className="font-mono text-sm text-muted-foreground">{lastScan}</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-lg font-semibold">Não encontrado</p>
                  <p className="font-mono text-sm text-muted-foreground">{lastScan}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 text-center">
        <Card>
          <CardContent className="p-4">
            <Package className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-xs text-muted-foreground">Dica: use leitor USB</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Scan className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-xs text-muted-foreground">Busca por scan_code</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-xs text-muted-foreground">Fallback: order_id</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

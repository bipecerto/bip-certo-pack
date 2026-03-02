import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Play, Trash2, AlertTriangle } from 'lucide-react';

type Status = 'idle' | 'running' | 'pass' | 'fail';

interface TestResult {
  name: string;
  status: Status;
  message?: string;
}

const E2E_PREFIX = 'E2E_TEST_';

export default function HealthPage() {
  const { user } = useAuth();
  const { company } = useApp();
  const navigate = useNavigate();
  const [smokeResults, setSmokeResults] = useState<TestResult[]>([]);
  const [e2eResults, setE2eResults] = useState<TestResult[]>([]);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [e2eRunning, setE2eRunning] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const updateResult = (
    setter: React.Dispatch<React.SetStateAction<TestResult[]>>,
    name: string,
    status: Status,
    message?: string
  ) => {
    setter(prev => prev.map(r => (r.name === name ? { ...r, status, message } : r)));
  };

  // ─── SMOKE TESTS ───────────────────────────────────────
  const runSmokeTests = useCallback(async () => {
    setSmokeRunning(true);
    const tests: TestResult[] = [
      { name: 'Auth: usuário logado', status: 'running' },
      { name: 'Auth: companyId definido', status: 'idle' },
      { name: 'DB: listar packages', status: 'idle' },
      { name: 'DB: listar orders', status: 'idle' },
      { name: 'DB: listar products', status: 'idle' },
      { name: 'DB: listar import_jobs', status: 'idle' },
      { name: 'Storage: bucket imports', status: 'idle' },
      { name: 'Scanner: getUserMedia suportado', status: 'idle' },
    ];
    setSmokeResults([...tests]);

    const s = (name: string, status: Status, msg?: string) =>
      setSmokeResults(prev => prev.map(r => (r.name === name ? { ...r, status, message: msg } : r)));

    // 1. Auth user
    s('Auth: usuário logado', user ? 'pass' : 'fail', user ? user.email ?? 'ok' : 'Nenhum usuário logado');

    // 2. Company
    s('Auth: companyId definido', 'running');
    s('Auth: companyId definido', company ? 'pass' : 'fail', company ? company.id : 'company_id não encontrado');

    // 3-6. DB reads
    const dbTests: { name: string; table: 'packages' | 'orders' | 'products' | 'import_jobs' }[] = [
      { name: 'DB: listar packages', table: 'packages' },
      { name: 'DB: listar orders', table: 'orders' },
      { name: 'DB: listar products', table: 'products' },
      { name: 'DB: listar import_jobs', table: 'import_jobs' },
    ];

    for (const t of dbTests) {
      s(t.name, 'running');
      try {
        const { data, error } = await supabase.from(t.table).select('id').limit(1);
        if (error) {
          s(t.name, 'fail', error.message);
        } else {
          s(t.name, 'pass', `${data?.length ?? 0} registro(s) retornado(s)`);
        }
      } catch (err: any) {
        s(t.name, 'fail', err.message);
      }
    }

    // 7. Storage
    s('Storage: bucket imports', 'running');
    try {
      const { data, error } = await supabase.storage.from('imports').list('', { limit: 1 });
      if (error) s('Storage: bucket imports', 'fail', error.message);
      else s('Storage: bucket imports', 'pass', 'Bucket acessível');
    } catch (err: any) {
      s('Storage: bucket imports', 'fail', err.message);
    }

    // 8. getUserMedia
    s('Scanner: getUserMedia suportado', 'running');
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    s('Scanner: getUserMedia suportado', hasMedia ? 'pass' : 'fail', hasMedia ? 'Suportado' : 'Não suportado neste navegador');

    setSmokeRunning(false);
  }, [user, company]);

  // ─── FULL E2E ──────────────────────────────────────────
  const runE2E = useCallback(async () => {
    if (!company) return;
    setE2eRunning(true);
    const tests: TestResult[] = [
      { name: 'Criar produto E2E', status: 'idle' },
      { name: 'Criar pedido E2E', status: 'idle' },
      { name: 'Criar pacote E2E', status: 'idle' },
      { name: 'Buscar pacote por tracking', status: 'idle' },
      { name: 'Verificar pacote (status)', status: 'idle' },
    ];
    setE2eResults([...tests]);

    const s = (name: string, status: Status, msg?: string) =>
      setE2eResults(prev => prev.map(r => (r.name === name ? { ...r, status, message: msg } : r)));

    const ts = Date.now();
    const trackingCode = `${E2E_PREFIX}BR${ts}`;
    const productName = `${E2E_PREFIX}Produto_${ts}`;
    const orderExtId = `${E2E_PREFIX}ORDER_${ts}`;

    try {
      // 1. Criar produto + variante
      s('Criar produto E2E', 'running');
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .insert({ name: productName, company_id: company.id, base_sku: `${E2E_PREFIX}SKU` })
        .select('id')
        .single();
      if (prodErr || !prod) throw new Error(`Produto: ${prodErr?.message}`);
      s('Criar produto E2E', 'pass', `id=${prod.id}`);

      // 2. Criar pedido
      s('Criar pedido E2E', 'running');
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          company_id: company.id,
          external_order_id: orderExtId,
          customer_name: `${E2E_PREFIX}Cliente`,
          marketplace: 'shopee',
          status: 'received',
        })
        .select('id')
        .single();
      if (orderErr || !order) throw new Error(`Pedido: ${orderErr?.message}`);
      s('Criar pedido E2E', 'pass', `id=${order.id}`);

      // 3. Criar pacote
      s('Criar pacote E2E', 'running');
      const { data: pkg, error: pkgErr } = await supabase
        .from('packages')
        .insert({
          company_id: company.id,
          order_id: order.id,
          tracking_code: trackingCode,
          scan_code: trackingCode,
          status: 'packed',
          package_number: 1,
        })
        .select('id')
        .single();
      if (pkgErr || !pkg) throw new Error(`Pacote: ${pkgErr?.message}`);
      s('Criar pacote E2E', 'pass', `id=${pkg.id}, tracking=${trackingCode}`);

      // 4. Buscar pacote pelo tracking
      s('Buscar pacote por tracking', 'running');
      const { data: found, error: findErr } = await supabase
        .from('packages')
        .select('id, tracking_code')
        .eq('tracking_code', trackingCode)
        .maybeSingle();
      if (findErr || !found) throw new Error(`Busca: ${findErr?.message || 'não encontrado'}`);
      s('Buscar pacote por tracking', 'pass', `Encontrou ${found.tracking_code}`);

      // 5. Atualizar status para verified
      s('Verificar pacote (status)', 'running');
      const { error: upErr } = await supabase
        .from('packages')
        .update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: user?.id })
        .eq('id', pkg.id);
      if (upErr) throw new Error(`Verificar: ${upErr.message}`);
      s('Verificar pacote (status)', 'pass', 'Status atualizado para verified');
    } catch (err: any) {
      // Mark current running test as failed
      setE2eResults(prev =>
        prev.map(r => (r.status === 'running' ? { ...r, status: 'fail', message: err.message } : r))
      );
    }

    setE2eRunning(false);
  }, [company, user]);

  // ─── CLEANUP ───────────────────────────────────────────
  const cleanupE2E = useCallback(async () => {
    if (!company) return;
    setCleaning(true);
    try {
      // Delete in order: packages → orders → products (FK dependencies)
      await supabase.from('packages').delete().like('tracking_code', `${E2E_PREFIX}%`);
      await supabase.from('orders').delete().like('external_order_id', `${E2E_PREFIX}%`);
      await supabase.from('products').delete().like('name', `${E2E_PREFIX}%`);
    } catch {
      // best-effort
    }
    setCleaning(false);
    setE2eResults([]);
  }, [company]);

  const icon = (status: Status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted shrink-0" />;
    }
  };

  const ResultList = ({ results }: { results: TestResult[] }) => (
    <div className="space-y-2">
      {results.map(r => (
        <div key={r.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          {icon(r.status)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{r.name}</p>
            {r.message && (
              <p className={`text-xs mt-0.5 ${r.status === 'fail' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {r.message}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Health Check (E2E)</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Verificação de integridade do sistema Bip Certo.
        </p>
      </div>

      {/* Smoke Tests */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Smoke Tests</h2>
          <Button type="button" onClick={runSmokeTests} disabled={smokeRunning} size="sm" className="gap-2">
            {smokeRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {smokeRunning ? 'Rodando...' : 'Rodar Smoke Tests'}
          </Button>
        </div>
        {smokeResults.length > 0 && <ResultList results={smokeResults} />}
        {smokeResults.length > 0 && !smokeRunning && (
          <div className="flex items-center gap-2 pt-2 text-sm">
            {smokeResults.every(r => r.status === 'pass') ? (
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" /> Todos os testes passaram
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-destructive font-medium">
                <AlertTriangle className="w-4 h-4" /> {smokeResults.filter(r => r.status === 'fail').length} teste(s) falharam
              </span>
            )}
          </div>
        )}
      </section>

      {/* Full E2E */}
      <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Teste Completo (E2E)</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cleanupE2E}
              disabled={cleaning || e2eRunning}
              className="gap-2"
            >
              {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Limpar dados E2E
            </Button>
            <Button type="button" onClick={runE2E} disabled={e2eRunning || !company} size="sm" className="gap-2">
              {e2eRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Rodar Teste Completo
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Cria dados com prefixo <code className="bg-muted px-1 rounded">E2E_TEST_</code> para validar o fluxo completo. Use "Limpar dados E2E" depois.
        </p>
        {e2eResults.length > 0 && <ResultList results={e2eResults} />}
        {e2eResults.length > 0 && !e2eRunning && (
          <div className="flex items-center gap-2 pt-2 text-sm">
            {e2eResults.every(r => r.status === 'pass') ? (
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" /> Fluxo E2E completo com sucesso
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-destructive font-medium">
                <AlertTriangle className="w-4 h-4" /> {e2eResults.filter(r => r.status === 'fail').length} etapa(s) falharam
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

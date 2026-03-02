import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Zap, ScanLine, Package, ShieldCheck, FileSpreadsheet, Search, BarChart3, Users, ChevronDown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const steps = [
  { icon: FileSpreadsheet, title: 'Importe seus pedidos', desc: 'Faça upload do CSV da Shopee, Mercado Livre ou SHEIN em segundos.' },
  { icon: ScanLine, title: 'Bipe a etiqueta', desc: 'Use câmera, leitor USB/Bluetooth ou digite o código manualmente.' },
  { icon: ShieldCheck, title: 'Confira e envie', desc: 'Veja o conteúdo do pacote instantaneamente e evite erros.' },
];

const benefits = [
  { icon: Package, title: 'Reduz erros e reenvios', desc: 'Saiba exatamente o que tem dentro de cada pacote antes de enviar.' },
  { icon: ScanLine, title: 'Câmera ou leitor físico', desc: 'Funciona com câmera do celular, leitor USB ou Bluetooth.' },
  { icon: Search, title: 'Busca inteligente', desc: 'Encontre qualquer pacote por tracking, pedido, produto ou SKU.' },
];

const plans = [
  {
    name: 'Starter',
    price: 197,
    features: ['Importação CSV (Shopee, Mercado Livre, SHEIN)', 'Scanner câmera e leitor USB/BT', 'Busca por pacote e pedido', '1 loja (1 empresa)', 'Histórico de conferências'],
    highlight: false,
    plan: 'starter',
  },
  {
    name: 'Pro',
    price: 397,
    features: ['Tudo do Starter', 'Importação escalável (2.000+ pedidos)', 'Relatórios e conferência avançada', 'Suporte prioritário', 'Multiusuário (mesma empresa)'],
    highlight: true,
    plan: 'pro',
  },
];

const faqs = [
  { q: 'Funciona com qual marketplace?', a: 'Shopee, Mercado Livre e SHEIN. Estamos adicionando mais em breve.' },
  { q: 'Preciso de leitor de código de barras?', a: 'Não é obrigatório. Você pode usar a câmera do celular ou digitar o código manualmente.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Sem fidelidade e sem multa.' },
  { q: 'Como funciona o acesso multiusuário?', a: 'No plano Pro, você pode convidar membros da equipe para acessar o sistema da mesma empresa.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubscribe = (plan: string) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Bip Certo</span>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => { console.log('go login'); navigate('/login'); }}>Entrar</Button>
            <Button type="button" size="sm" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Começar agora
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" aria-hidden="true" />
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Zap className="w-4 h-4" /> Sistema de conferência de pacotes
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Pare de enviar<br />
            <span className="text-primary">produto errado.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Bipe etiquetas e descubra instantaneamente o que tem dentro de cada pacote. Conferência rápida para Shopee, Mercado Livre e SHEIN.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button type="button" size="lg" className="text-base px-8 h-12 shadow-lg" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Começar agora
            </Button>
            <Button type="button" variant="outline" size="lg" className="text-base px-8 h-12" onClick={() => { console.log('go login'); navigate('/login'); }}>
              Já tenho conta
            </Button>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Como funciona</h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">Em 3 passos simples você elimina erros de envio.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-8 text-center relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>
                <s.icon className="w-10 h-10 text-primary mx-auto mb-4 mt-2" />
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Por que usar o Bip Certo?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((b, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <b.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="pricing" className="py-20 bg-secondary/30">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Planos</h2>
          <p className="text-muted-foreground text-center mb-14">Escolha o plano ideal para sua operação.</p>
          <div className="grid md:grid-cols-2 gap-8">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`bg-card border rounded-2xl p-8 flex flex-col ${p.highlight ? 'border-primary ring-2 ring-primary/20 shadow-xl relative' : 'border-border'}`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                    Mais popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">R${p.price}</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={p.highlight ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleSubscribe(p.plan)}
                >
                  Assinar R${p.price}/mês
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Perguntas frequentes</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left font-medium hover:bg-secondary/50 transition-colors"
                >
                  {f.q}
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Bip Certo</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Bip Certo. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Checkout Placeholder Modal */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout em implantação</DialogTitle>
            <DialogDescription>
              O pagamento online estará disponível em breve. Por enquanto, entre em contato para ativar seu plano <strong>{selectedPlan === 'pro' ? 'Pro' : 'Starter'}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button className="gap-2" onClick={() => window.open('https://wa.me/5500000000000?text=Quero%20assinar%20o%20Bip%20Certo', '_blank')}>
              <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
            </Button>
            <Button variant="outline" onClick={() => { setCheckoutOpen(false); navigate('/login'); }}>
              Já paguei, entrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Save, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { user, signOut, profile } = useAuth();
    const { company } = useApp();
    const [profileName, setProfileName] = useState(profile?.name || '');
    const [companyName, setCompanyName] = useState(company?.name || '');
    const [sub, setSub] = useState<any>(null);

    useEffect(() => { setProfileName(profile?.name || ''); }, [profile]);
    useEffect(() => { setCompanyName(company?.name || ''); }, [company]);

    useEffect(() => {
        if (!profile?.company_id) return;
        supabase
            .from('subscriptions')
            .select('plan, status, started_at, ends_at')
            .eq('company_id', profile.company_id)
            .eq('status', 'active')
            .maybeSingle()
            .then(({ data }) => setSub(data));
    }, [profile]);

    const saveProfile = async () => {
        if (!user) return;
        await supabase.from('profiles').update({ name: profileName }).eq('id', user.id);
        toast.success('Perfil atualizado');
    };

    const saveCompany = async () => {
        if (!profile?.company_id) return;
        await supabase.from('companies').update({ name: companyName }).eq('id', profile.company_id);
        toast.success('Empresa atualizada');
    };

    return (
        <div className="p-6 max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

            {/* Plano */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Plano</h2>
                </div>
                {sub ? (
                    <div className="flex items-center gap-3">
                        <Badge variant="default" className="text-sm capitalize">{sub.plan}</Badge>
                        <Badge variant="outline" className="text-sm bg-primary/10 text-primary border-primary/20">Ativo</Badge>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Nenhum plano ativo. Acesso via liberação manual.</p>
                )}
                <Button variant="outline" size="sm" disabled className="gap-2">
                    <CreditCard className="w-4 h-4" /> Gerenciar assinatura (em breve)
                </Button>
            </div>

            {/* Profile */}
            {user && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
                    <div>
                        <Label>Email</Label>
                        <Input value={user.email || ''} disabled className="bg-muted" />
                    </div>
                    <div>
                        <Label>Nome</Label>
                        <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                    </div>
                    {profile && (
                        <div>
                            <Label>Cargo</Label>
                            <Input value={profile.role} disabled className="bg-muted" />
                        </div>
                    )}
                    <Button onClick={saveProfile} className="gap-2">
                        <Save className="h-4 w-4" /> Salvar Perfil
                    </Button>
                </div>
            )}

            {/* Company */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Empresa</h2>
                <div>
                    <Label>Nome da Empresa</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <Button onClick={saveCompany} className="gap-2">
                    <Save className="h-4 w-4" /> Salvar Empresa
                </Button>
            </div>

            {/* Logout */}
            <div className="bg-card border border-border rounded-2xl p-6">
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => { await signOut(); window.location.replace('/'); }}
                    className="gap-2"
                >
                    <LogOut className="h-4 w-4" /> Sair da Conta
                </Button>
            </div>
        </div>
    );
}

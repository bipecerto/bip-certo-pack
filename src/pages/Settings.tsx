import { useState, useEffect } from 'react';
import { Save, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { user, signOut, profile } = useAuth();
    const { company } = useApp();
    const [profileName, setProfileName] = useState(profile?.name || '');
    const [companyName, setCompanyName] = useState(company?.name || '');

    useEffect(() => { setProfileName(profile?.name || ''); }, [profile]);
    useEffect(() => { setCompanyName(company?.name || ''); }, [company]);

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

            <div className="bg-card border border-border rounded-2xl p-6">
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                        await signOut();
                        window.location.replace('/auth');
                    }}
                    className="gap-2"
                >
                    <LogOut className="h-4 w-4" /> Sair da Conta
                </Button>
            </div>
        </div>
    );
}

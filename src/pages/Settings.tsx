import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, ExternalLink, LogOut } from 'lucide-react';
import { getConfig, saveConfig, type AppConfig } from '@/lib/config';
import { resetSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { user, signOut } = useAuth();
    const { profile, company } = useApp();
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const cfg = getConfig();
        if (cfg) {
            setUrl(cfg.supabaseUrl);
            setKey(cfg.supabaseAnonKey);
        }
    }, []);

    const handleSave = () => {
        if (!url.trim() || !key.trim()) {
            toast.error('Preencha URL e Chave Anon corretamente.');
            return;
        }
        const cfg: AppConfig = {
            supabaseUrl: url.trim(),
            supabaseAnonKey: key.trim(),
        };
        saveConfig(cfg);
        resetSupabaseClient();
        setSaved(true);
        toast.success('Configurações salvas! Reconectando ao Supabase...');
        setTimeout(() => {
            window.location.replace('/login');
        }, 1500);
    };

    return (
        <div className="p-6 max-w-2xl space-y-6">
            {/* Supabase Config Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-1">Conexão Supabase</h2>
                <p className="text-sm text-slate-400 mb-5">
                    Configure a URL e Anon Key do seu projeto Supabase. Estas credenciais ficam salvas apenas neste PC.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1.5">
                            Supabase Project URL
                        </label>
                        <Input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://xxxxxxxxxxx.supabase.co"
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 font-mono text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1.5">
                            Anon (public) Key
                        </label>
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 font-mono text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handleSave}
                            disabled={saved}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saved ? 'Salvo!' : 'Salvar e Reconectar'}
                        </Button>

                        <a
                            href="https://supabase.com/dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Abrir Supabase Dashboard
                        </a>
                    </div>
                </div>

                {/* Status */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                    {getConfig() ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                            <CheckCircle className="w-4 h-4" />
                            Supabase configurado
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            Supabase ainda não configurado
                        </div>
                    )}
                </div>
            </div>

            {/* Perfil do Usuário */}
            {user && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Perfil</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-slate-400">Email</span>
                            <span className="text-sm text-white font-mono">{user.email}</span>
                        </div>
                        {profile && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-400">Nome</span>
                                    <span className="text-sm text-white">{profile.name || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-400">Função</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${profile.role === 'admin'
                                            ? 'bg-indigo-500/20 text-indigo-300'
                                            : 'bg-slate-700 text-slate-300'
                                        }`}>
                                        {profile.role.toUpperCase()}
                                    </span>
                                </div>
                            </>
                        )}
                        {company && (
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-400">Empresa</span>
                                <span className="text-sm text-white">{company.name}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                                await signOut();
                                window.location.replace('/login');
                            }}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sair da Conta
                        </Button>
                    </div>
                </div>
            )}

            {/* Instruções SQL */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Configuração do Banco</h2>
                <p className="text-sm text-slate-400 mb-3">
                    Se ainda não aplicou o schema, execute o arquivo SQL no Editor SQL do Supabase:
                </p>
                <code className="block bg-slate-800 rounded-lg p-3 text-xs text-indigo-300 font-mono">
                    supabase/migrations/001_schema.sql
                </code>
            </div>
        </div>
    );
}

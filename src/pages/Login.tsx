import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
    const { user, signIn } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    if (user) return <Navigate to="/scanner" replace />;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasConfig()) {
            toast.error('Configure a URL e Chave do Supabase primeiro em Configurações.');
            navigate('/settings');
            return;
        }
        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);
        if (error) {
            toast.error('Falha no login: ' + error);
        } else {
            toast.success('Login realizado!');
            navigate('/scanner');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-xl shadow-indigo-500/30">
                        <Zap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Bip Certo</h1>
                    <p className="text-slate-400 text-sm mt-1">Sistema de Gestão de Pacotes</p>
                </div>

                {/* Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                    <h2 className="text-lg font-semibold text-white mb-5">Entrar</h2>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Senha</label>
                            <div className="relative">
                                <Input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5"
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-slate-500 mt-4">
                        Sem conta?{' '}
                        <button
                            onClick={() => navigate('/settings')}
                            className="text-indigo-400 hover:text-indigo-300"
                        >
                            Configure o Supabase primeiro
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}

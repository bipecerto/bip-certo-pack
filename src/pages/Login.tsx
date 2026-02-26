import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
    const { user, signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'login' | 'signup'>('login');

    if (user) return <Navigate to="/scanner" replace />;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        if (mode === 'login') {
            const { error } = await signIn(email, password);
            setLoading(false);
            if (error) toast.error('Falha no login: ' + error);
            else { toast.success('Login realizado!'); navigate('/scanner'); }
        } else {
            const { error } = await signUp(email, password, name);
            setLoading(false);
            if (error) toast.error('Erro no cadastro: ' + error);
            else toast.success('Conta criada! Verifique seu email para confirmar.');
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-xl">
                        <Zap className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Bip Certo</h1>
                    <p className="text-muted-foreground text-sm mt-1">Sistema de Gestão de Pacotes</p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
                    <h2 className="text-lg font-semibold text-foreground mb-5">
                        {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1.5">Nome</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Seu nome"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1.5">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1.5">Senha</label>
                            <div className="relative">
                                <Input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-muted-foreground mt-4">
                        {mode === 'login' ? (
                            <>Sem conta?{' '}
                            <button onClick={() => setMode('signup')} className="text-primary hover:underline">
                                Criar conta
                            </button></>
                        ) : (
                            <>Já tem conta?{' '}
                            <button onClick={() => setMode('login')} className="text-primary hover:underline">
                                Entrar
                            </button></>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

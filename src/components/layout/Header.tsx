import { useNavigate } from 'react-router-dom';
import { LogOut, User, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';

interface HeaderProps {
    title: string;
}

export function Header({ title }: HeaderProps) {
    const { user, signOut } = useAuth();
    const { company, isOffline } = useApp();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
            <div>
                <h1 className="text-lg font-semibold text-white">{title}</h1>
                {company && (
                    <p className="text-xs text-slate-500">{company.name}</p>
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* Status offline */}
                {isOffline ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-amber-400 font-medium">Offline (cache)</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-medium">Online</span>
                    </div>
                )}

                {/* User info */}
                {user && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300 max-w-[120px] truncate">
                            {user.email}
                        </span>
                    </div>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                    <LogOut className="w-4 h-4" />
                </Button>
            </div>
        </header>
    );
}

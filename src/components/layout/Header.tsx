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
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur shrink-0">
            <div>
                <h1 className="text-lg font-semibold text-foreground">{title}</h1>
                {company && (
                    <p className="text-xs text-muted-foreground">{company.name}</p>
                )}
            </div>

            <div className="flex items-center gap-3">
                {isOffline ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/20">
                        <WifiOff className="w-3.5 h-3.5 text-warning" />
                        <span className="text-xs text-warning font-medium">Offline</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                        <Wifi className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-success font-medium">Online</span>
                    </div>
                )}

                {user && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground max-w-[120px] truncate">
                            {user.email}
                        </span>
                    </div>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <LogOut className="w-4 h-4" />
                </Button>
            </div>
        </header>
    );
}

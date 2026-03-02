import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    Scan,
    Search,
    Upload,
    Package,
    ShoppingCart,
    Box,
    Settings,
    Zap,
    HeartPulse,
} from 'lucide-react';

const navItems = [
    { to: '/scanner', icon: Scan, label: 'Scanner' },
    { to: '/find', icon: Search, label: 'Pesquisar' },
    { to: '/imports', icon: Upload, label: 'Importar' },
    { to: '/packages', icon: Package, label: 'Pacotes' },
    { to: '/orders', icon: ShoppingCart, label: 'Pedidos' },
    { to: '/products', icon: Box, label: 'Produtos' },
    { to: '/settings', icon: Settings, label: 'Configurações' },
    { to: '/health', icon: HeartPulse, label: 'Health Check' },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <aside className="flex flex-col w-16 lg:w-56 bg-card border-r border-border min-h-screen shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                    <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="hidden lg:block font-bold text-foreground text-sm tracking-wide">
                    Bip Certo
                </span>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-1 px-2 py-4 flex-1">
                {navItems.map(({ to, icon: Icon, label }) => {
                    const active = location.pathname.startsWith(to);
                    return (
                        <Link
                            key={to}
                            to={to}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                                active
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                            )}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            <span className="hidden lg:block">{label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Version */}
            <div className="px-4 py-3 border-t border-border">
                <span className="hidden lg:block text-xs text-muted-foreground">v1.0.0</span>
            </div>
        </aside>
    );
}

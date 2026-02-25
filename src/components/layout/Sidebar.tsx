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
} from 'lucide-react';

const navItems = [
    { to: '/scanner', icon: Scan, label: 'Scanner' },
    { to: '/find', icon: Search, label: 'Pesquisar' },
    { to: '/imports', icon: Upload, label: 'Importar' },
    { to: '/packages', icon: Package, label: 'Pacotes' },
    { to: '/orders', icon: ShoppingCart, label: 'Pedidos' },
    { to: '/products', icon: Box, label: 'Produtos' },
    { to: '/settings', icon: Settings, label: 'Configurações' },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <aside className="flex flex-col w-16 lg:w-56 bg-slate-900 border-r border-slate-800 min-h-screen shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-800">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
                    <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="hidden lg:block font-bold text-white text-sm tracking-wide">
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
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            )}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            <span className="hidden lg:block">{label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Version */}
            <div className="px-4 py-3 border-t border-slate-800">
                <span className="hidden lg:block text-xs text-slate-600">v1.0.0</span>
            </div>
        </aside>
    );
}

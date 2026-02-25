import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const pageTitles: Record<string, string> = {
    '/scanner': 'Scanner',
    '/find': 'Pesquisar Item',
    '/imports': 'Importar CSV',
    '/packages': 'Pacotes',
    '/orders': 'Pedidos',
    '/products': 'Produtos',
    '/settings': 'Configurações',
};

export function AppLayout() {
    const location = useLocation();
    const title =
        Object.entries(pageTitles).find(([path]) =>
            location.pathname.startsWith(path)
        )?.[1] ?? 'Bip Certo';

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0">
                <Header title={title} />
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

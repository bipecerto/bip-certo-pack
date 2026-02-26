import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Tag, CheckCircle, Truck, XCircle, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PackageDetail {
    id: string;
    scan_code: string | null;
    tracking_code: string | null;
    status: string;
    package_number: number;
    last_scanned_at: string | null;
    created_at: string;
    order: {
        id: string;
        external_order_id: string;
        customer_name: string | null;
        address_summary: string | null;
        marketplace: string;
        status: string;
    } | null;
    items: {
        id: string;
        qty: number;
        variant: {
            id: string;
            variant_name: string | null;
            sku: string | null;
            attributes: Record<string, string>;
            product: { name: string } | null;
        } | null;
    }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    packed: {
        label: 'Embalado',
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: <Package className="w-3.5 h-3.5" />,
    },
    checking: {
        label: 'Em Conferência',
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: <ClipboardCheck className="w-3.5 h-3.5" />,
    },
    shipped: {
        label: 'Enviado',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: <Truck className="w-3.5 h-3.5" />,
    },
    cancelled: {
        label: 'Cancelado',
        color: 'bg-red-500/10 text-red-400 border-red-500/20',
        icon: <XCircle className="w-3.5 h-3.5" />,
    },
};

const MARKETPLACE_BADGE: Record<string, string> = {
    shopee: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    aliexpress: 'bg-red-500/10 text-red-400 border-red-500/20',
    shein: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

export default function PackageDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile, user } = useApp() as any;
    const [pkg, setPkg] = useState<PackageDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadPackage = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const db = supabase;
            const { data, error } = await db
                .from('packages')
                .select(`
          id, scan_code, tracking_code, status, package_number, last_scanned_at, created_at,
          order:orders(id, external_order_id, customer_name, address_summary, marketplace, status),
          items:package_items(
            id, qty,
            variant:product_variants(
              id, variant_name, sku, attributes,
              product:products(name)
            )
          )
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setPkg(data as unknown as PackageDetail);
        } catch (err) {
            toast.error('Erro ao carregar pacote.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadPackage(); }, [id]);

    const handleAction = async (action: string, newStatus: string) => {
        if (!pkg || !profile?.company_id) return;
        setActionLoading(action);
        try {
            const db = supabase;
            await db
                .from('packages')
                .update({ status: newStatus, last_scanned_at: new Date().toISOString() })
                .eq('id', pkg.id);

            // Registrar scan
            const { data: authData } = await db.auth.getUser();
            await db.from('scans').insert({
                company_id: profile.company_id,
                package_id: pkg.id,
                user_id: authData.user?.id,
                action,
                meta: { previous_status: pkg.status },
            });

            setPkg((p) => p ? { ...p, status: newStatus, last_scanned_at: new Date().toISOString() } : p);
            toast.success(`Status atualizado: ${STATUS_CONFIG[newStatus]?.label}`);
        } catch (err) {
            toast.error('Erro ao atualizar status.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!pkg) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <XCircle className="w-12 h-12 text-red-400" />
                <p className="text-white font-medium">Pacote não encontrado</p>
                <Button onClick={() => navigate(-1)} variant="outline" className="border-slate-700 text-slate-300">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
            </div>
        );
    }

    const statusCfg = STATUS_CONFIG[pkg.status] || STATUS_CONFIG['packed'];

    return (
        <div className="p-6 max-w-3xl space-y-5">
            {/* Back + Header */}
            <div className="flex items-center gap-4">
                <Button onClick={() => navigate(-1)} variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <h2 className="text-xl font-semibold text-white">
                    Pacote #{pkg.package_number}
                </h2>
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', statusCfg.color)}>
                    {statusCfg.icon}
                    {statusCfg.label}
                </span>
            </div>

            {/* Codes */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Códigos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-800 rounded-xl p-3">
                        <div className="text-xs text-slate-500 mb-1">Scan Code</div>
                        <div className="font-mono text-sm text-white break-all">{pkg.scan_code || '—'}</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3">
                        <div className="text-xs text-slate-500 mb-1">Tracking</div>
                        <div className="font-mono text-sm text-white break-all">{pkg.tracking_code || '—'}</div>
                    </div>
                </div>
                {pkg.last_scanned_at && (
                    <p className="text-xs text-slate-500">
                        Último scan: {new Date(pkg.last_scanned_at).toLocaleString('pt-BR')}
                    </p>
                )}
            </div>

            {/* Order Info */}
            {pkg.order && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Pedido</h3>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MARKETPLACE_BADGE[pkg.order.marketplace] || 'bg-slate-700 text-slate-400')}>
                            {pkg.order.marketplace.toUpperCase()}
                        </span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <Tag className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                            <div>
                                <div className="text-xs text-slate-500">ID do Pedido</div>
                                <div className="font-mono text-sm text-white">{pkg.order.external_order_id}</div>
                            </div>
                        </div>
                        {pkg.order.customer_name && (
                            <div className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-xs text-slate-500">Cliente</div>
                                    <div className="text-sm text-white">{pkg.order.customer_name}</div>
                                </div>
                            </div>
                        )}
                        {pkg.order.address_summary && (
                            <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-xs text-slate-500">Endereço</div>
                                    <div className="text-sm text-white">{pkg.order.address_summary}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Items */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Itens do Pacote</h3>
                {pkg.items.length === 0 ? (
                    <p className="text-slate-500 text-sm">Nenhum item registrado neste pacote.</p>
                ) : (
                    <div className="space-y-2">
                        {pkg.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                                <div>
                                    <div className="text-sm font-medium text-white">
                                        {item.variant?.product?.name || 'Produto desconhecido'}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {item.variant?.variant_name || ''}
                                        {item.variant?.attributes?.size && (
                                            <span className="ml-2 font-semibold text-indigo-400">TAM {item.variant.attributes.size}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {item.variant?.sku && (
                                        <span className="text-xs text-slate-500 font-mono">{item.variant.sku}</span>
                                    )}
                                    <span className="text-lg font-bold text-white">×{item.qty}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Ações</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                        { action: 'checking', status: 'checking', label: 'Conferido', icon: <ClipboardCheck className="w-4 h-4" />, color: 'bg-amber-600 hover:bg-amber-700' },
                        { action: 'packed', status: 'packed', label: 'Embalado', icon: <Package className="w-4 h-4" />, color: 'bg-blue-600 hover:bg-blue-700' },
                        { action: 'shipped', status: 'shipped', label: 'Enviado', icon: <Truck className="w-4 h-4" />, color: 'bg-emerald-600 hover:bg-emerald-700' },
                        { action: 'cancelled', status: 'cancelled', label: 'Cancelado', icon: <XCircle className="w-4 h-4" />, color: 'bg-red-600 hover:bg-red-700' },
                    ].map((btn) => (
                        <Button
                            key={btn.action}
                            onClick={() => handleAction(btn.action, btn.status)}
                            disabled={!!actionLoading || pkg.status === btn.status}
                            className={cn(
                                'flex flex-col items-center gap-1.5 h-auto py-3 text-white font-medium',
                                btn.color,
                                pkg.status === btn.status && 'opacity-50 cursor-default ring-2 ring-white/20'
                            )}
                        >
                            {actionLoading === btn.action ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : btn.icon}
                            <span className="text-xs">{btn.label}</span>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Tag, CheckCircle, Truck, XCircle, ClipboardCheck, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
    packed: { label: 'Embalado', color: 'bg-info/10 text-info border-info/20', icon: <Package className="w-3.5 h-3.5" /> },
    checking: { label: 'Em Conferência', color: 'bg-warning/10 text-warning border-warning/20', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    verified: { label: 'Verificado', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    shipped: { label: 'Enviado', color: 'bg-success/10 text-success border-success/20', icon: <Truck className="w-3.5 h-3.5" /> },
    cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <XCircle className="w-3.5 h-3.5" /> },
};

const MARKETPLACE_BADGE: Record<string, string> = {
    shopee: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    aliexpress: 'bg-red-500/10 text-red-600 border-red-500/20',
    shein: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
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
            const { data, error } = await supabase
                .from('packages')
                .select(`
                  id, scan_code, tracking_code, status, package_number, last_scanned_at, created_at,
                  order:orders(id, external_order_id, customer_name, address_summary, marketplace, status),
                  items:package_items(id, qty, variant:product_variants(id, variant_name, sku, attributes, product:products(name)))
                `)
                .eq('id', id)
                .single();
            if (error) throw error;
            setPkg(data as unknown as PackageDetail);
        } catch {
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
            const updatePayload: Record<string, any> = { status: newStatus, last_scanned_at: new Date().toISOString() };
            if (newStatus === 'verified') {
                const { data: authData } = await supabase.auth.getUser();
                updatePayload.verified_at = new Date().toISOString();
                updatePayload.verified_by = authData.user?.id || null;
            }
            await supabase.from('packages').update(updatePayload).eq('id', pkg.id);
            const { data: authData } = await supabase.auth.getUser();
            await supabase.from('scans').insert({
                company_id: profile.company_id, package_id: pkg.id, user_id: authData.user?.id, action, meta: { previous_status: pkg.status },
            });
            setPkg((p) => p ? { ...p, status: newStatus, last_scanned_at: new Date().toISOString() } : p);
            toast.success(`Status: ${STATUS_CONFIG[newStatus]?.label}`);
        } catch {
            toast.error('Erro ao atualizar status.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!pkg) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <XCircle className="w-12 h-12 text-destructive" />
                <p className="text-foreground font-medium">Pacote não encontrado</p>
                <Button onClick={() => navigate(-1)} variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
            </div>
        );
    }

    const statusCfg = STATUS_CONFIG[pkg.status] || STATUS_CONFIG['packed'];

    return (
        <div className="p-6 max-w-3xl space-y-5">
            <div className="flex items-center gap-4">
                <Button onClick={() => navigate(-1)} variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <h2 className="text-xl font-semibold text-foreground">Pacote #{pkg.package_number}</h2>
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', statusCfg.color)}>
                    {statusCfg.icon} {statusCfg.label}
                </span>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Códigos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-muted rounded-xl p-3">
                        <div className="text-xs text-muted-foreground mb-1">Scan Code</div>
                        <div className="font-mono text-sm text-foreground break-all">{pkg.scan_code || '—'}</div>
                    </div>
                    <div className="bg-muted rounded-xl p-3">
                        <div className="text-xs text-muted-foreground mb-1">Tracking</div>
                        <div className="font-mono text-sm text-foreground break-all">{pkg.tracking_code || '—'}</div>
                    </div>
                </div>
                {pkg.last_scanned_at && (
                    <p className="text-xs text-muted-foreground">Último scan: {new Date(pkg.last_scanned_at).toLocaleString('pt-BR')}</p>
                )}
            </div>

            {pkg.order && (
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pedido</h3>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', MARKETPLACE_BADGE[pkg.order.marketplace] || 'bg-muted text-muted-foreground')}>
                            {pkg.order.marketplace.toUpperCase()}
                        </span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div><div className="text-xs text-muted-foreground">ID do Pedido</div><div className="font-mono text-sm text-foreground">{pkg.order.external_order_id}</div></div>
                        </div>
                        {pkg.order.customer_name && (
                            <div className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div><div className="text-xs text-muted-foreground">Cliente</div><div className="text-sm text-foreground">{pkg.order.customer_name}</div></div>
                            </div>
                        )}
                        {pkg.order.address_summary && (
                            <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div><div className="text-xs text-muted-foreground">Endereço</div><div className="text-sm text-foreground">{pkg.order.address_summary}</div></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Itens do Pacote</h3>
                {pkg.items.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum item neste pacote.</p>
                ) : (
                    <div className="space-y-2">
                        {pkg.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
                                <div>
                                    <div className="text-sm font-medium text-foreground">{item.variant?.product?.name || 'Produto desconhecido'}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {item.variant?.variant_name || ''}
                                        {item.variant?.attributes?.size && <span className="ml-2 font-semibold text-primary">TAM {item.variant.attributes.size}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {item.variant?.sku && <span className="text-xs text-muted-foreground font-mono">{item.variant.sku}</span>}
                                    <span className="text-lg font-bold text-foreground">×{item.qty}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {[
                        { action: 'checking', status: 'checking', label: 'Em Conferência', icon: <ClipboardCheck className="w-4 h-4" />, variant: 'secondary' as const },
                        { action: 'verified', status: 'verified', label: 'Verificado', icon: <CheckCircle className="w-4 h-4" />, variant: 'secondary' as const },
                        { action: 'packed', status: 'packed', label: 'Embalado', icon: <Package className="w-4 h-4" />, variant: 'secondary' as const },
                        { action: 'shipped', status: 'shipped', label: 'Enviado', icon: <Truck className="w-4 h-4" />, variant: 'default' as const },
                        { action: 'cancelled', status: 'cancelled', label: 'Cancelado', icon: <XCircle className="w-4 h-4" />, variant: 'destructive' as const },
                    ].map((btn) => (
                        <Button
                            key={btn.action}
                            onClick={() => handleAction(btn.action, btn.status)}
                            disabled={!!actionLoading || pkg.status === btn.status}
                            variant={btn.variant}
                            className={cn('flex flex-col items-center gap-1.5 h-auto py-3', pkg.status === btn.status && 'opacity-50 ring-2 ring-primary/20')}
                        >
                            {actionLoading === btn.action ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : btn.icon}
                            <span className="text-xs">{btn.label}</span>
                        </Button>
                    ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border">
                    <DeletePackageButton packageId={pkg.id} onDeleted={() => navigate(-1)} />
                </div>
            </div>
        </div>
    );
}

function DeletePackageButton({ packageId, onDeleted }: { packageId: string; onDeleted: () => void }) {
    const [deleting, setDeleting] = useState(false);
    const handleDelete = async () => {
        setDeleting(true);
        try {
            await supabase.from('package_items').delete().eq('package_id', packageId);
            await supabase.from('scans').delete().eq('package_id', packageId);
            const { error } = await supabase.from('packages').delete().eq('id', packageId);
            if (error) throw error;
            toast.success('Pacote excluído.');
            onDeleted();
        } catch (err: any) {
            toast.error('Erro: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir pacote
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
                    <AlertDialogDescription>Isso excluirá o pacote e seus itens permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar exclusão'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

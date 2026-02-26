/**
 * upsert.ts — Lógica de UPSERT para os dados normalizados no Supabase.
 * Garante anti-duplicação e relatório de estatísticas.
 */

import { supabase } from '../supabase';
import type { NormalizedRow } from './shopee';
import type { Marketplace } from './detect';

export interface UpsertStats {
    ordersCreated: number;
    ordersUpdated: number;
    productsCreated: number;
    variantsCreated: number;
    packagesCreated: number;
    itemsUpserted: number;
    errors: { line: number; message: string }[];
}

export async function upsertRows(
    rows: NormalizedRow[],
    marketplace: Marketplace,
    companyId: string,
    onProgress?: (processed: number, total: number) => void
): Promise<UpsertStats> {
    const stats: UpsertStats = {
        ordersCreated: 0,
        ordersUpdated: 0,
        productsCreated: 0,
        variantsCreated: 0,
        packagesCreated: 0,
        itemsUpserted: 0,
        errors: [],
    };

    const db = supabase();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        onProgress?.(i + 1, rows.length);

        try {
            // ── 1. UPSERT Order ──────────────────────────────────────
            const { data: orderData, error: orderErr } = await db
                .from('orders')
                .upsert(
                    {
                        company_id: companyId,
                        marketplace,
                        external_order_id: row.externalOrderId,
                        customer_name: row.customerName,
                        address_summary: row.addressSummary,
                        status: 'received',
                    },
                    {
                        onConflict: 'marketplace,external_order_id',
                        ignoreDuplicates: false,
                    }
                )
                .select('id,created_at')
                .single();

            if (orderErr) throw new Error(`Order: ${orderErr.message}`);
            const orderId: string = orderData.id;

            // Incrementar estatística: created ou updated
            // (heurística: se created_at é recente, foi criado; senão, atualizado)
            const isNew =
                new Date(orderData.created_at).getTime() > Date.now() - 5000;
            if (isNew) stats.ordersCreated++;
            else stats.ordersUpdated++;

            // ── 2. UPSERT Product ────────────────────────────────────
            const { data: productData, error: productErr } = await db
                .from('products')
                .upsert(
                    {
                        company_id: companyId,
                        name: row.productName,
                        base_sku: null,
                    },
                    { onConflict: 'company_id,name', ignoreDuplicates: false }
                )
                .select('id')
                .single();

            if (productErr) throw new Error(`Product: ${productErr.message}`);
            const productId: string = productData.id;
            stats.productsCreated++;

            // ── 3. UPSERT ProductVariant ─────────────────────────────
            const { data: variantData, error: variantErr } = await db
                .from('product_variants')
                .upsert(
                    {
                        company_id: companyId,
                        product_id: productId,
                        variant_name: row.variantName,
                        sku: row.sku,
                        attributes: row.attributes,
                    },
                    { onConflict: 'company_id,sku', ignoreDuplicates: false }
                )
                .select('id')
                .single();

            if (variantErr) throw new Error(`Variant: ${variantErr.message}`);
            const variantId: string = variantData.id;
            stats.variantsCreated++;

            // ── 4. UPSERT OrderItem ──────────────────────────────────
            const { error: itemErr } = await db
                .from('order_items')
                .upsert(
                    {
                        company_id: companyId,
                        order_id: orderId,
                        variant_id: variantId,
                        qty: row.qty,
                    },
                    { onConflict: 'order_id,variant_id', ignoreDuplicates: false }
                );

            if (itemErr) throw new Error(`OrderItem: ${itemErr.message}`);
            stats.itemsUpserted++;

            // ── 5. UPSERT Package (se houver tracking) ───────────────
            if (row.scanCode || row.trackingCode) {
                const scanCode = row.scanCode || row.trackingCode;
                const { error: pkgErr } = await db
                    .from('packages')
                    .upsert(
                        {
                            company_id: companyId,
                            order_id: orderId,
                            package_number: 1,
                            scan_code: scanCode,
                            tracking_code: row.trackingCode || scanCode,
                            status: 'packed',
                        },
                        { onConflict: 'scan_code', ignoreDuplicates: true }
                    );

                if (pkgErr) throw new Error(`Package: ${pkgErr.message}`);
                stats.packagesCreated++;

                // ── 6. UPSERT package_items (cópia de order_items) ───────
                const { data: pkgRow } = await db
                    .from('packages')
                    .select('id')
                    .eq('scan_code', scanCode)
                    .single();

                if (pkgRow) {
                    await db
                        .from('package_items')
                        .upsert(
                            {
                                company_id: companyId,
                                package_id: pkgRow.id,
                                variant_id: variantId,
                                qty: row.qty,
                            },
                            { onConflict: 'package_id,variant_id', ignoreDuplicates: false }
                        );
                }
            }
        } catch (err) {
            stats.errors.push({
                line: i + 2,
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return stats;
}

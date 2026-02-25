/**
 * shein.ts — Mapper de linhas CSV da SHEIN para o modelo interno.
 */

import { findHeader } from './parse';
import { extractSize, generateStableSku } from './size';
import type { NormalizedRow } from './shopee';

export function mapSheinRow(
    row: Record<string, string>,
    headers: string[]
): NormalizedRow | null {
    const get = (candidates: string[]) => {
        const h = findHeader(headers, candidates);
        return h ? (row[h] || '').trim() : '';
    };

    const orderId = get(['Order Number', 'Order No', 'Order ID']);
    const tracking = get(['Tracking Number', 'Tracking', 'Waybill', 'Express Number']);
    const buyerName = get(['Customer Name', 'Buyer Name', 'Recipient Name']);
    const sku = get(['SKU', 'Item SKU', 'Product SKU']);
    const productName = get(['Product Name', 'Item Name', 'Product Name(s)', 'Goods Name']);
    const variation = get(['Variation', 'Colour/Size', 'Variant', 'Style', 'Attributes']);
    const qtyStr = get(['Quantity', 'Qty', 'Amount', 'Ordered Quantity']);
    const address = get(['Shipping Address', 'Address', 'Delivery Address']);

    if (!orderId) return null;

    const qty = parseInt(qtyStr, 10) || 1;
    const variantText = variation || sku;
    const size = extractSize(variantText) || extractSize(productName);
    const attrs: Record<string, string> = {};
    if (size) attrs['size'] = size;

    const finalSku = sku || generateStableSku(productName, variation);

    return {
        externalOrderId: orderId,
        trackingCode: tracking,
        scanCode: tracking,
        customerName: buyerName,
        addressSummary: address,
        productName: productName || 'Produto sem nome',
        variantName: variation || sku,
        sku: finalSku,
        qty,
        attributes: attrs,
    };
}

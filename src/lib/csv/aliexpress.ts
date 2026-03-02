/**
 * aliexpress.ts — Mapper de linhas CSV do Mercado Livre para o modelo interno.
 */

import { findHeader } from './parse';
import { extractSize, generateStableSku } from './size';
import type { NormalizedRow } from './shopee';

export function mapAliExpressRow(
    row: Record<string, string>,
    headers: string[]
): NormalizedRow | null {
    const get = (candidates: string[]) => {
        const h = findHeader(headers, candidates);
        return h ? (row[h] || '').trim() : '';
    };

    const orderId = get(['Order ID', 'Order No', 'Order Number']);
    const tracking = get([
        'Logistics Tracking Number',
        'Tracking Number',
        'Tracking No',
        'Waybill Number',
        'AWB No',
    ]);
    const buyerName = get(['Buyer Login Name', 'Buyer Name', 'Buyer Alias', 'Customer Name']);
    const sku = get(['SKU', 'SKU ID', 'Product SKU']);
    const productName = get(['Product Name', 'Subject', 'Item Name', 'Title']);
    const productAttrs = get(['Product Attributes', 'Variation', 'SKU Attributes', 'Sku Attributes']);
    const qtyStr = get(['Quantity', 'Ordered Quantity', 'Qty']);
    const address = get([
        'Shipping Address',
        'Address',
        'Delivery Address',
        'Ship To Address',
    ]);

    if (!orderId) return null;

    const qty = parseInt(qtyStr, 10) || 1;
    const variantText = productAttrs || sku;
    const size = extractSize(variantText) || extractSize(productName);
    const attrs: Record<string, string> = {};
    if (size) attrs['size'] = size;

    const finalSku = sku || generateStableSku(productName, productAttrs);

    return {
        externalOrderId: orderId,
        trackingCode: tracking,
        scanCode: tracking,
        customerName: buyerName,
        addressSummary: address,
        productName: productName || 'Produto sem nome',
        variantName: productAttrs || sku,
        sku: finalSku,
        qty,
        attributes: attrs,
    };
}

/**
 * shopee.ts — Mapper de linhas CSV da Shopee para o modelo interno.
 */

import { findHeader } from './parse';
import { extractSize, generateStableSku } from './size';

export interface NormalizedRow {
    externalOrderId: string;
    trackingCode: string;
    scanCode: string;
    customerName: string;
    addressSummary: string;
    productName: string;
    variantName: string;
    sku: string;
    qty: number;
    attributes: Record<string, string>;
}

export function mapShopeeRow(
    row: Record<string, string>,
    headers: string[]
): NormalizedRow | null {
    const get = (candidates: string[]) => {
        const h = findHeader(headers, candidates);
        return h ? (row[h] || '').trim() : '';
    };

    const orderId = get(['Order ID', 'OrderID', 'Order Id']);
    const tracking = get(['Tracking Number', 'TrackingNumber', 'AWB Number']);
    const buyerName = get(['Buyer Name', 'Buyer Username', 'Recipient Name']);
    const productName = get(['Product Name', 'Product Name(s)', 'Item Name']);
    const modelName = get(['Model Name', 'Variation Name', 'Variation']);
    const qtyStr = get(['Quantity', 'Qty', 'Amount']);
    const address = get([
        'Recipient Address',
        'Delivery Address',
        'Recipient Full Address',
        'Shipping Address',
    ]);

    if (!orderId) return null;

    const qty = parseInt(qtyStr, 10) || 1;
    const size = extractSize(modelName) || extractSize(productName);
    const attrs: Record<string, string> = {};
    if (size) attrs['size'] = size;

    const sku = generateStableSku(productName, modelName);

    return {
        externalOrderId: orderId,
        trackingCode: tracking,
        scanCode: tracking,
        customerName: buyerName,
        addressSummary: address,
        productName: productName || 'Produto sem nome',
        variantName: modelName,
        sku,
        qty,
        attributes: attrs,
    };
}

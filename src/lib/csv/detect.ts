/**
 * detect.ts — Detecção automática de marketplace pelo cabeçalho do CSV.
 */

export type Marketplace = 'shopee' | 'mercadolivre' | 'shein' | 'unknown';

/** Normaliza um header: Remove espaços extras, lowercase */
function normalize(h: string): string {
    return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function detectMarketplace(headers: string[]): Marketplace {
    const norm = headers.map(normalize);
    const has = (term: string) => norm.some((h) => h.includes(term));

    // Shopee: tem "order id" + "tracking number" + "model name"
    if (has('order id') && has('tracking number') && has('model name')) {
        return 'shopee';
    }

    // Mercado Livre (antigo AliExpress): tem "order id" + "sku" + algum tracking
    if (
        has('order id') &&
        has('sku') &&
        (has('logistics tracking') || has('tracking no') || has('tracking number'))
    ) {
        return 'mercadolivre';
    }

    // SHEIN: tem "order number" (não order id) + ("variation" ou "color/size") + tracking
    if (
        (has('order number') || has('order no')) &&
        (has('variation') || has('size') || has('colour')) &&
        (has('tracking') || has('waybill'))
    ) {
        return 'shein';
    }

    return 'unknown';
}

/**
 * size.ts — Extração e normalização de tamanho de vestuário.
 * Suporta: PP, P, M, G, GG, GGG/3XL, XL, XXL, ÚNICO/UN
 */

export type Size = 'PP' | 'P' | 'M' | 'G' | 'GG' | 'GGG' | 'UN';

const SIZE_PATTERNS: [RegExp, Size][] = [
    [/\b(3xl|gggg?|xxxl)\b/i, 'GGG'],
    [/\b(2xl|gg|xxl)\b/i, 'GG'],
    [/\b(xl|eg|eg)\b/i, 'GG'],   // XL  → GG na tabela BR
    [/\b(g|l)\b/i, 'G'],
    [/\b(m|md)\b/i, 'M'],
    [/\b(pp|xxs)\b/i, 'PP'],
    [/\b(p|s|sm)\b/i, 'P'],
    [/\b(un(?:ico|ique|i)?|u\.?n\.?|free\s*size|tamanho\s*[uú]nico)\b/i, 'UN'],
];

/**
 * Extraí tamanho de uma string de texto (nome do produto, variante, atributos).
 * Retorna o tamanho normalizado ou null se não encontrar.
 */
export function extractSize(text: string): Size | null {
    if (!text) return null;

    // Tenta padrões no texto inteiro
    for (const [pattern, size] of SIZE_PATTERNS) {
        if (pattern.test(text)) return size;
    }

    // Tenta localizar em fragmentos separados por / ou - ou ,
    const parts = text.split(/[\/\-,;|]/).map((p) => p.trim());
    for (const part of parts) {
        for (const [pattern, size] of SIZE_PATTERNS) {
            if (pattern.test(part)) return size;
        }
    }

    return null;
}

/**
 * Gera um slug estável a partir de nome do produto + variante.
 * Usado como SKU fallback quando o CSV não tem SKU.
 */
export function generateStableSku(productName: string, variantName: string): string {
    const slug = (s: string) =>
        s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 30);

    const hash = simpleHash(productName + '|' + variantName);
    return `${slug(productName)}-${slug(variantName)}-${hash}`;
}

function simpleHash(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
    }
    return h.toString(36).slice(0, 6);
}

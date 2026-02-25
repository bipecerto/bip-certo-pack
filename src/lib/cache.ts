/**
 * cache.ts — Cache local simples para operação offline/resiliente.
 * Armazena no localStorage com versionamento e TTL opcional.
 */

const CACHE_VERSION = 1;
const PREFIX = `bip_cache_v${CACHE_VERSION}_`;

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl?: number; // ms; undefined = sem expiração
}

export function setCache<T>(key: string, data: T, ttlMs?: number): void {
    try {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        };
        localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
        // Ignora erro de quota
    }
}

export function getCache<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (!raw) return null;
        const entry = JSON.parse(raw) as CacheEntry<T>;
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            localStorage.removeItem(PREFIX + key);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

export function clearCache(key: string): void {
    localStorage.removeItem(PREFIX + key);
}

export function clearAllCache(): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
}

// Chaves de cache utilizadas no app
export const CACHE_KEYS = {
    PACKAGES: 'packages_list',
    ORDERS: 'orders_list',
    VARIANTS: 'variants_list',
    PRODUCTS: 'products_list',
} as const;

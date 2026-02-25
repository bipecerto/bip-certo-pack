/**
 * supabase.ts — Cliente Supabase dinâmico com URL/Key do config local.
 * Suporta: persistSession, autoRefreshToken, detectSessionInUrl: false
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from './config';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    if (_client) return _client;
    const cfg = getConfig();
    if (!cfg) return null;
    _client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: 'bip_certo_auth',
        },
    });
    return _client;
}

/** Recria o cliente após mudança de configuração */
export function resetSupabaseClient(): void {
    _client = null;
}

/** Retorna o client ou lança erro (use dentro de hooks/actions que garantem config) */
export function supabase(): SupabaseClient {
    const c = getSupabaseClient();
    if (!c) throw new Error('Supabase client não configurado. Configure URL e Key em /settings.');
    return c;
}

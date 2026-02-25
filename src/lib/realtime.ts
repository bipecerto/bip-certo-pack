/**
 * realtime.ts — Subscriptions do Supabase Realtime para tables:
 *  packages, scans, imports
 * Exige client válido e autenticado.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

type RealtimeCallback = (payload: unknown) => void;

const channels: RealtimeChannel[] = [];

export function subscribeRealtime(
    table: 'packages' | 'scans' | 'imports',
    companyId: string,
    callback: RealtimeCallback
): RealtimeChannel | null {
    const client = getSupabaseClient();
    if (!client) return null;

    const channelName = `realtime:${table}:${companyId}`;
    const channel = client
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table,
                filter: `company_id=eq.${companyId}`,
            },
            callback
        )
        .subscribe();

    channels.push(channel);
    return channel;
}

export function unsubscribeAll(): void {
    const client = getSupabaseClient();
    if (!client) return;
    channels.forEach((ch) => {
        client.removeChannel(ch);
    });
    channels.length = 0;
}

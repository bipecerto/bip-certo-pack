import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { job_id } = await req.json()
        if (!job_id) throw new Error('job_id is required')

        // Fetch batch of unprocessed rows (500)
        const { data: rows, error: fetchError } = await supabaseClient
            .from('marketplace_order_lines_staging')
            .select('*')
            .eq('job_id', job_id)
            .eq('processed', false)
            .limit(500)

        if (fetchError || !rows) throw new Error('Failed to fetch staging rows: ' + fetchError?.message)

        if (rows.length === 0) {
            // Mark job completed if all processed
            const { count } = await supabaseClient.from('marketplace_order_lines_staging').select('*', { count: 'exact', head: true }).eq('job_id', job_id).eq('processed', false)
            if (count === 0) {
                await supabaseClient.from('import_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', job_id)
                return new Response(JSON.stringify({ status: 'completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        const { data: job } = await supabaseClient.from('import_jobs').select('company_id').eq('id', job_id).single()
        const company_id = job.company_id

        // We process each row sequentially here or batch upsert.
        // Batch upsert requires parsing. We'll do an array of upserts.
        let successfulCount = 0;

        // For simplicity, let's process sequentially since it handles normalized structure.
        for (const row of rows) {
            try {
                const raw = row.raw_data;
                // Basic parser based on Bip Certo's expected CSV format from context
                const orderId = raw['order_id'] || raw['ID do Pedido'];
                const trackingCode = raw['tracking_code'] || raw['Código de Rastreio'];
                const marketplace = raw['marketplace'] || raw['Marketplace'];

                if (!orderId) throw new Error('Order ID missing');

                // Upsert orders
                const { error: ordErr } = await supabaseClient.from('orders').upsert({
                    company_id,
                    marketplace: marketplace || 'shopee', // Default/fallback
                    external_order_id: orderId,
                }, { onConflict: 'company_id, marketplace, external_order_id', ignoreDuplicates: true })
                if (ordErr) throw new Error(`Orders upsert failed: ${ordErr.message}`);

                // Upsert packages
                if (trackingCode) {
                    const { error: pkgErr } = await supabaseClient.from('packages').upsert({
                        company_id,
                        scan_code: trackingCode,
                        status: 'pending'
                    }, { onConflict: 'company_id, scan_code', ignoreDuplicates: true })
                    if (pkgErr) throw new Error(`Packages upsert failed: ${pkgErr.message}`);
                }

                // Mark staging row as processed
                await supabaseClient.from('marketplace_order_lines_staging').update({ processed: true }).eq('id', row.id)
                successfulCount++;

            } catch (err: any) {
                console.error('Line process error:', err.message)
                await supabaseClient.from('import_job_errors').insert({
                    job_id,
                    row_number: parseInt(row.raw_data?.row_index || 0),
                    raw_row: row.raw_data,
                    message: err.message
                })
                // Still mark as processed so it doesn't try again
                await supabaseClient.from('marketplace_order_lines_staging').update({ processed: true }).eq('id', row.id)
            }
        }

        // Increment processed rows
        await supabaseClient.rpc('increment_processed_rows', { inc_job_id: job_id, count: successfulCount })

        // If we processed 500, we call ourselves again asynchronously to keep the ball rolling.
        if (rows.length === 500) {
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/resume_import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                },
                body: JSON.stringify({ job_id })
            }).catch(console.error);
        }

        return new Response(JSON.stringify({ status: 'running', processed: successfulCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})

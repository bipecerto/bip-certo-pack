import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as csv from 'https://deno.land/std@0.168.0/encoding/csv.ts'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encode } from 'https://deno.land/std@0.168.0/encoding/hex.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashRow(row: any): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(row))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new TextDecoder().decode(encode(new Uint8Array(hash)))
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

    // Mark job as running
    const { data: job, error: jobError } = await supabaseClient
      .from('import_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_id)
      .eq('status', 'queued')
      .select()
      .single()

    if (jobError || !job) {
      // If it's already running or completed, just return
      return new Response(JSON.stringify({ message: 'Job already started or not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) Download the CSV from Storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('imports')
      .download(job.file_path)

    if (downloadError) throw new Error('File download failed: ' + downloadError.message)

    const text = await fileData.text()
    const rows = await csv.parse(text, { skipFirstRow: true })

    // 2) Parse CSV and insert into staging
    let totalRows = rows.length;

    // First update total rows
    await supabaseClient.from('import_jobs').update({ total_rows: totalRows }).eq('id', job_id)

    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, i + BATCH_SIZE);
      const stagingRows = await Promise.all(batchRows.map(async (row) => {
        const lineHash = await hashRow(row);
        return {
          job_id,
          line_hash: lineHash,
          raw_data: row,
          processed: false
        }
      }))
      
      const { error: insertError } = await supabaseClient
        .from('marketplace_order_lines_staging')
        .upsert(stagingRows, { onConflict: 'job_id, line_hash', ignoreDuplicates: true })

      if (insertError) {
        console.error('Staging insert error:', insertError)
      }
    }

    // 3) Call resume_import to actually process staging rows
    // Since we are inside start_import, we can make an internal fetch call to resume_import
    // Or we just return and tell client to call resume or cron will handle it.
    // Let's call resume_import directly to avoid delay
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/resume_import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({ job_id })
    }).catch(console.error);

    return new Response(JSON.stringify({ success: true, total_rows: totalRows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encode } from 'https://deno.land/std@0.168.0/encoding/hex.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function hashRow(row: Record<string, string>): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(row))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new TextDecoder().decode(encode(new Uint8Array(hash)))
}

function detectDelimiter(sample: string): string {
  const commas = (sample.match(/,/g) || []).length
  const semicolons = (sample.match(/;/g) || []).length
  return semicolons > commas ? ';' : ','
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim()); current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const delimiter = detectDelimiter(lines.slice(0, 3).join('\n'))
  const headers = parseLine(lines[0], delimiter).map(h => h.replace(/^["'\s]+|["'\s]+$/g, '').trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter)
    if (values.every(v => !v.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return { headers, rows }
}

function norm(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

function findH(headers: string[], candidates: string[]): string | undefined {
  const nc = candidates.map(norm)
  return headers.find(h => nc.includes(norm(h)))
}

type Marketplace = 'shopee' | 'mercadolivre' | 'shein' | 'unknown'

function detectMarketplace(headers: string[]): Marketplace {
  const n = headers.map(h => h.trim().toLowerCase())
  const has = (t: string) => n.some(h => h.includes(t))
  if (has('order id') && has('tracking number') && (has('model name') || has('variation'))) return 'shopee'
  if (has('order id') && has('sku') && (has('logistics tracking') || has('tracking no') || has('tracking number'))) return 'mercadolivre'
  if ((has('order number') || has('order no')) && (has('variation') || has('size') || has('colour')) && (has('tracking') || has('waybill'))) return 'shein'
  return 'unknown'
}

function mapRow(row: Record<string, string>, headers: string[], marketplace: Marketplace) {
  const get = (candidates: string[]) => {
    const h = findH(headers, candidates)
    return h ? (row[h] || '').trim() : ''
  }

  let orderId = '', tracking = '', buyer = '', product = '', variation = '', sku = '', qtyStr = '', address = ''

  if (marketplace === 'shopee') {
    orderId = get(['Order ID', 'OrderID'])
    tracking = get(['Tracking Number', 'TrackingNumber', 'AWB Number'])
    buyer = get(['Buyer Name', 'Buyer Username', 'Recipient Name'])
    product = get(['Product Name', 'Item Name'])
    variation = get(['Model Name', 'Variation Name', 'Variation'])
    qtyStr = get(['Quantity', 'Qty'])
    address = get(['Recipient Address', 'Delivery Address', 'Shipping Address'])
  } else if (marketplace === 'mercadolivre') {
    orderId = get(['Order ID', 'Order No', 'Order Number'])
    tracking = get(['Logistics Tracking Number', 'Tracking Number', 'Tracking No'])
    buyer = get(['Buyer Login Name', 'Buyer Name', 'Customer Name'])
    product = get(['Product Name', 'Subject', 'Item Name'])
    variation = get(['Product Attributes', 'Variation', 'SKU Attributes'])
    sku = get(['SKU', 'SKU ID', 'Product SKU'])
    qtyStr = get(['Quantity', 'Ordered Quantity', 'Qty'])
    address = get(['Shipping Address', 'Address'])
  } else if (marketplace === 'shein') {
    orderId = get(['Order Number', 'Order No', 'Order ID'])
    tracking = get(['Tracking Number', 'Tracking', 'Waybill', 'Express Number'])
    buyer = get(['Customer Name', 'Buyer Name', 'Recipient Name'])
    product = get(['Product Name', 'Item Name', 'Goods Name'])
    variation = get(['Variation', 'Colour/Size', 'Variant', 'Attributes'])
    sku = get(['SKU', 'Item SKU'])
    qtyStr = get(['Quantity', 'Qty'])
    address = get(['Shipping Address', 'Address'])
  } else {
    orderId = get(['Order ID', 'Order Number', 'order_id'])
    tracking = get(['Tracking Number', 'tracking_code', 'Tracking'])
    buyer = get(['Buyer Name', 'Customer Name', 'Recipient Name'])
    product = get(['Product Name', 'Item Name'])
    variation = get(['Variation', 'Model Name'])
    qtyStr = get(['Quantity', 'Qty'])
    address = get(['Address', 'Shipping Address'])
  }

  return {
    external_order_id: orderId,
    tracking_code: tracking,
    item_name: product || 'Produto sem nome',
    variation: variation || sku,
    sku: sku,
    qty: parseInt(qtyStr, 10) || 1,
    buyer_name: buyer,
    address: address,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { job_id } = await req.json()
    if (!job_id) throw new Error('job_id is required')

    // Mark job as running
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_id)
      .select()
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ message: 'Job already started or not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download CSV from Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage.from('imports').download(job.file_path)

    if (downloadError || !fileData) throw new Error('File download failed: ' + downloadError?.message)

    // Try UTF-8, fallback to latin1
    let text: string
    try {
      const buf = await fileData.arrayBuffer()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      text = decoder.decode(buf)
    } catch {
      const buf = await fileData.arrayBuffer()
      text = new TextDecoder('windows-1252').decode(buf)
    }

    const { headers, rows } = parseCSV(text)
    const marketplace = detectMarketplace(headers)

    // Update job with marketplace and total rows
    await supabase.from('import_jobs').update({
      total_rows: rows.length,
      marketplace: marketplace !== 'unknown' ? marketplace : null,
    }).eq('id', job_id)

    // Insert into staging in batches
    const BATCH = 1000
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const stagingRows = await Promise.all(batch.map(async (row) => {
        const mapped = mapRow(row, headers, marketplace)
        const lineHash = await hashRow(row)
        return {
          job_id,
          company_id: job.company_id,
          marketplace: marketplace !== 'unknown' ? marketplace : null,
          external_order_id: mapped.external_order_id || null,
          tracking_code: mapped.tracking_code || null,
          item_name: mapped.item_name,
          variation: mapped.variation || null,
          sku: mapped.sku || null,
          qty: mapped.qty,
          buyer_name: mapped.buyer_name || null,
          address: mapped.address || null,
          raw_data: row,
          line_hash: lineHash,
          processed: false,
        }
      }))

      await supabase
        .from('marketplace_order_lines_staging')
        .upsert(stagingRows, { onConflict: 'job_id, line_hash', ignoreDuplicates: true })
    }

    // Trigger resume_import to process staging rows
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/resume_import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ job_id })
    }).catch(console.error)

    return new Response(JSON.stringify({ success: true, marketplace, total_rows: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

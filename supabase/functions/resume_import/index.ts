import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Extract size from variation/product text
function extractSize(text: string): string | null {
  if (!text) return null
  const patterns: [RegExp, string][] = [
    [/\b(3xl|gggg?|xxxl)\b/i, 'GGG'],
    [/\b(2xl|xxl)\b/i, 'GG'],
    [/\b(xl)\b/i, 'GG'],
    [/\bgg\b/i, 'GG'],
    [/\b(g|l)\b/i, 'G'],
    [/\b(m|md)\b/i, 'M'],
    [/\b(pp|xxs)\b/i, 'PP'],
    [/\b(p|s|sm)\b/i, 'P'],
    [/\b(un(?:ico)?|free\s*size|tamanho\s*[uú]nico)\b/i, 'UN'],
  ]
  for (const [pat, size] of patterns) {
    if (pat.test(text)) return size
  }
  // Numeric sizes
  const numMatch = text.match(/\b(3[4-9]|4[0-9]|5[0-4])\b/)
  if (numMatch) return numMatch[1]
  return null
}

function generateVariantKey(productName: string, variation: string): string {
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `${slug(productName)}-${slug(variation)}`
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

    // Get job info
    const { data: job } = await supabase.from('import_jobs').select('company_id, marketplace, status').eq('id', job_id).single()
    if (!job) throw new Error('Job not found')

    const company_id = job.company_id
    const marketplace = job.marketplace || 'unknown'

    // Fetch batch of unprocessed rows
    const { data: rows, error: fetchError } = await supabase
      .from('marketplace_order_lines_staging')
      .select('*')
      .eq('job_id', job_id)
      .eq('processed', false)
      .limit(500)

    if (fetchError) throw new Error('Failed to fetch staging rows: ' + fetchError.message)

    if (!rows || rows.length === 0) {
      // Check if all done
      const { count } = await supabase
        .from('marketplace_order_lines_staging')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job_id)
        .eq('processed', false)

      if (count === 0) {
        await supabase.from('import_jobs').update({
          status: 'completed',
          completed_at: new Date().toISOString()
        }).eq('id', job_id)
      }
      return new Response(JSON.stringify({ status: 'completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let successCount = 0
    const errors: any[] = []

    for (const row of rows) {
      try {
        const orderId = row.external_order_id
        if (!orderId) throw new Error('Order ID missing')

        // 1. Upsert order
        const { data: orderData, error: ordErr } = await supabase.from('orders').upsert({
          company_id,
          marketplace: marketplace,
          external_order_id: orderId,
          customer_name: row.buyer_name || row.recipient_name || null,
          address_summary: row.address || null,
          status: 'received',
        }, { onConflict: 'company_id, marketplace, external_order_id' }).select('id').single()

        if (ordErr) throw new Error(`Order upsert: ${ordErr.message}`)
        const order_id = orderData.id

        // 2. Upsert product
        const productName = row.item_name || 'Produto sem nome'
        const { data: prodData, error: prodErr } = await supabase.from('products').upsert({
          company_id,
          name: productName,
        }, { onConflict: 'company_id, name' }).select('id').single()

        if (prodErr) throw new Error(`Product upsert: ${prodErr.message}`)
        const product_id = prodData.id

        // 3. Upsert variant
        const variationText = row.variation || ''
        const size = extractSize(variationText) || extractSize(productName)
        const attrs: Record<string, string> = {}
        if (size) attrs['size'] = size

        let variant_id: string | null = null
        if (row.sku) {
          // Use SKU-based unique index
          const { data: varData, error: varErr } = await supabase.from('product_variants').upsert({
            company_id,
            product_id,
            variant_name: variationText || null,
            sku: row.sku,
            attributes: attrs,
          }, { onConflict: 'company_id, sku' }).select('id').single()

          if (varErr) throw new Error(`Variant upsert: ${varErr.message}`)
          variant_id = varData.id
        } else if (variationText) {
          // No SKU — try to find existing or create
          const variantKey = generateVariantKey(productName, variationText)
          const { data: existing } = await supabase.from('product_variants')
            .select('id')
            .eq('company_id', company_id)
            .eq('product_id', product_id)
            .eq('variant_name', variationText)
            .maybeSingle()

          if (existing) {
            variant_id = existing.id
          } else {
            const { data: newVar, error: newVarErr } = await supabase.from('product_variants').insert({
              company_id,
              product_id,
              variant_name: variationText,
              sku: null,
              attributes: attrs,
            }).select('id').single()
            if (newVarErr) throw new Error(`Variant insert: ${newVarErr.message}`)
            variant_id = newVar.id
          }
        }

        // 4. Upsert order_items
        if (variant_id) {
          await supabase.from('order_items').upsert({
            company_id,
            order_id,
            variant_id,
            qty: row.qty || 1,
          }, { onConflict: 'order_id, variant_id' }).select('id').single()
        }

        // 5. Upsert package if tracking exists
        if (row.tracking_code) {
          const { data: pkgData } = await supabase.from('packages').upsert({
            company_id,
            order_id,
            scan_code: row.tracking_code,
            tracking_code: row.tracking_code,
            status: 'packed',
          }, { onConflict: 'company_id, scan_code' }).select('id').single()

          // Add package_items
          if (pkgData && variant_id) {
            await supabase.from('package_items').upsert({
              company_id,
              package_id: pkgData.id,
              variant_id,
              qty: row.qty || 1,
            }, { onConflict: 'package_id, variant_id' }).select('id').single()
          }
        }

        // Mark processed
        await supabase.from('marketplace_order_lines_staging').update({ processed: true }).eq('id', row.id)
        successCount++

      } catch (err: any) {
        console.error('Row error:', err.message)
        errors.push({ job_id, company_id, row_number: 0, raw_row: row.raw_data, message: err.message })
        await supabase.from('marketplace_order_lines_staging').update({ processed: true }).eq('id', row.id)
      }
    }

    // Insert errors
    if (errors.length > 0) {
      await supabase.from('import_job_errors').insert(errors)
    }

    // Increment processed rows
    await supabase.rpc('increment_processed_rows', { inc_job_id: job_id, count: successCount })

    // Chain if more rows
    if (rows.length === 500) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/resume_import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ job_id })
      }).catch(console.error)
    } else {
      // Might be done — check
      const { count } = await supabase
        .from('marketplace_order_lines_staging')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job_id)
        .eq('processed', false)

      if (count === 0) {
        await supabase.from('import_jobs').update({
          status: 'completed',
          completed_at: new Date().toISOString()
        }).eq('id', job_id)
      }
    }

    return new Response(JSON.stringify({ status: 'running', processed: successCount, errors: errors.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

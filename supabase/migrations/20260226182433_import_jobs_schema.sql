-- Create ENUM for import status if not exists
DO $$ BEGIN
    CREATE TYPE import_status AS ENUM ('queued', 'running', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table for tracking import jobs
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    status import_status NOT NULL DEFAULT 'queued',
    total_rows INT NOT NULL DEFAULT 0,
    processed_rows INT NOT NULL DEFAULT 0,
    stats JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for logging line-specific errors during import
CREATE TABLE IF NOT EXISTS public.import_job_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    raw_row JSONB,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staging table for raw data processing
CREATE TABLE IF NOT EXISTS public.marketplace_order_lines_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    line_hash TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    normalized_data JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, line_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_company_status ON public.import_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_import_job_errors_job_id ON public.import_job_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_staging_job_id_processed ON public.marketplace_order_lines_staging(job_id, processed);

-- Idempotency Constraints for Orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_company_marketplace_external_id_key;
ALTER TABLE public.orders ADD CONSTRAINT orders_company_marketplace_external_id_key UNIQUE (company_id, marketplace, external_order_id);

-- Idempotency Constraints for Packages
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_company_scan_code_key;
ALTER TABLE public.packages ADD CONSTRAINT packages_company_scan_code_key UNIQUE (company_id, scan_code);

-- Idempotency Constraints for Products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_company_name_key;
ALTER TABLE public.products ADD CONSTRAINT products_company_name_key UNIQUE (company_id, name);

-- Idempotency Constraints for Product Variants (using partial indexes for unique constraints)
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_company_sku_unique ON public.product_variants(company_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_company_key_unique ON public.product_variants(company_id, variant_key) WHERE sku IS NULL;

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_lines_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company import jobs" ON public.import_jobs
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM public.users WHERE auth_id = auth.uid()
    ));

CREATE POLICY "Users can insert their company import jobs" ON public.import_jobs
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM public.users WHERE auth_id = auth.uid()
    ));

CREATE POLICY "Users can update their company import jobs" ON public.import_jobs
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM public.users WHERE auth_id = auth.uid()
    ));

CREATE POLICY "Users can view their job errors" ON public.import_job_errors
    FOR SELECT USING (job_id IN (
        SELECT id FROM public.import_jobs WHERE company_id IN (
            SELECT company_id FROM public.users WHERE auth_id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert job errors" ON public.import_job_errors
    FOR INSERT WITH CHECK (job_id IN (
        SELECT id FROM public.import_jobs WHERE company_id IN (
            SELECT company_id FROM public.users WHERE auth_id = auth.uid()
        )
    ));

CREATE POLICY "Users can view staging lines" ON public.marketplace_order_lines_staging
    FOR SELECT USING (job_id IN (
        SELECT id FROM public.import_jobs WHERE company_id IN (
            SELECT company_id FROM public.users WHERE auth_id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert staging lines" ON public.marketplace_order_lines_staging
    FOR INSERT WITH CHECK (job_id IN (
        SELECT id FROM public.import_jobs WHERE company_id IN (
            SELECT company_id FROM public.users WHERE auth_id = auth.uid()
        )
    ));

CREATE POLICY "Users can update staging lines" ON public.marketplace_order_lines_staging
    FOR UPDATE USING (job_id IN (
        SELECT id FROM public.import_jobs WHERE company_id IN (
            SELECT company_id FROM public.users WHERE auth_id = auth.uid()
        )
    ));

-- pg_cron Extension and Cron Job for Watchdog
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    -- Remove if exists to recreate
    PERFORM cron.unschedule('import_watchdog');
    
    -- Schedule pg_cron watchdog (every 3 minutes)
    PERFORM cron.schedule('import_watchdog', '*/3 * * * *', $$
        DO $watchdog$
        DECLARE
            j_id UUID;
        BEGIN
            -- Find queued jobs > 1 min or running jobs > 15 min
            FOR j_id IN 
                SELECT id FROM public.import_jobs 
                WHERE (status = 'queued' AND created_at < NOW() - INTERVAL '1 minute')
                   OR (status = 'running' AND started_at < NOW() - INTERVAL '15 minutes')
                ORDER BY created_at ASC
                LIMIT 5
            LOOP
                -- Trigger edge function via pg_net (requires pg_net extension, which supabase has usually)
                -- We'll assume the client implements a resume logic or we can send a webhook.
                -- For Supabase, the best way from trigger/cron to hit an Edge Function is via pg_net HTTP request.
                -- The webhook URL is usually your project ref URL.
                -- We will update status to queued so the Edge Function can pick it up or we can just send request.
                UPDATE public.import_jobs SET status = 'queued', started_at = NULL WHERE id = j_id;
            END LOOP;
        END $watchdog$;
    $$);
END $$;

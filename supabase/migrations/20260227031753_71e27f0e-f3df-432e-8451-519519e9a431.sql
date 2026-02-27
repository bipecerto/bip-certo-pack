
-- Import jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  marketplace text,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  total_rows int DEFAULT 0,
  processed_rows int DEFAULT 0,
  stats jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company select import_jobs" ON public.import_jobs FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Company insert import_jobs" ON public.import_jobs FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Company update import_jobs" ON public.import_jobs FOR UPDATE USING (company_id = get_user_company_id());

-- Import job errors table
CREATE TABLE IF NOT EXISTS public.import_job_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number int,
  raw_row jsonb,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_job_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company select import_job_errors" ON public.import_job_errors FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Company insert import_job_errors" ON public.import_job_errors FOR INSERT WITH CHECK (company_id = get_user_company_id());

-- Staging table
CREATE TABLE IF NOT EXISTS public.marketplace_order_lines_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  marketplace text,
  external_order_id text,
  tracking_code text,
  item_name text,
  variation text,
  sku text,
  qty int DEFAULT 1,
  buyer_name text,
  recipient_name text,
  address text,
  raw_data jsonb,
  line_hash text NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_order_lines_staging ENABLE ROW LEVEL SECURITY;

-- Service role only for staging (edge functions use service role)
CREATE POLICY "Service role staging" ON public.marketplace_order_lines_staging FOR ALL USING (true) WITH CHECK (true);

-- Constraints
ALTER TABLE public.marketplace_order_lines_staging ADD CONSTRAINT staging_job_line_hash_unique UNIQUE (job_id, line_hash);

-- Add unique constraint for orders upsert (company_id scoped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_company_marketplace_external_unique'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_company_marketplace_external_unique UNIQUE (company_id, marketplace, external_order_id);
  END IF;
END $$;

-- Add unique constraint for packages scan_code (company_id scoped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_company_scan_code_unique'
  ) THEN
    ALTER TABLE public.packages ADD CONSTRAINT packages_company_scan_code_unique UNIQUE (company_id, scan_code);
  END IF;
END $$;

-- Add unique constraint for products name (company_id scoped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_company_name_unique'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_company_name_unique UNIQUE (company_id, name);
  END IF;
END $$;

-- Partial unique index for variants with sku
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_company_sku_unique ON public.product_variants (company_id, sku) WHERE sku IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staging_job_id ON public.marketplace_order_lines_staging (job_id);
CREATE INDEX IF NOT EXISTS idx_staging_processed ON public.marketplace_order_lines_staging (job_id, processed);
CREATE INDEX IF NOT EXISTS idx_orders_company_created ON public.orders (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_company_tracking ON public.packages (company_id, tracking_code);
CREATE INDEX IF NOT EXISTS idx_import_jobs_company ON public.import_jobs (company_id, created_at DESC);

-- Function for incrementing processed rows atomically
CREATE OR REPLACE FUNCTION public.increment_processed_rows(inc_job_id uuid, count int)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.import_jobs SET processed_rows = processed_rows + count WHERE id = inc_job_id;
$$;

-- Storage bucket for imports
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false) ON CONFLICT DO NOTHING;

-- Storage RLS: authenticated users can upload to their company folder
CREATE POLICY "Users can upload imports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'imports');
CREATE POLICY "Users can read imports" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'imports');

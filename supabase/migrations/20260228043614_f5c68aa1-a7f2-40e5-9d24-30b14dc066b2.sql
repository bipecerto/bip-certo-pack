
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT NULL;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS verified_by uuid DEFAULT NULL;

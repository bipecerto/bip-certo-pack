
-- Add access_override to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_override boolean NOT NULL DEFAULT false;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'inactive',
  started_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company select subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "Company insert subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Company update subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (company_id = get_user_company_id());

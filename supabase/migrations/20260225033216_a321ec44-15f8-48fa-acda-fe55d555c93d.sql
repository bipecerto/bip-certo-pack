
-- 1) companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2) profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3) products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_sku text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4) product_variants
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name text,
  sku text,
  attributes jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 5) orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  marketplace text,
  external_order_id text,
  customer_name text,
  address_summary text,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 6) order_items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  qty int NOT NULL DEFAULT 1
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 7) packages
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  package_number int NOT NULL DEFAULT 1,
  scan_code text UNIQUE,
  tracking_code text,
  status text NOT NULL DEFAULT 'packed',
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- 8) package_items
CREATE TABLE public.package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  qty int NOT NULL DEFAULT 1
);
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;

-- 9) scans
CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  meta jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- 10) marketplace_accounts
CREATE TABLE public.marketplace_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  access_token text,
  refresh_token text,
  connected_at timestamptz,
  meta jsonb DEFAULT '{}'
);
ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;

-- INDEXES
CREATE INDEX idx_packages_scan_code ON public.packages(scan_code);
CREATE INDEX idx_packages_tracking_code ON public.packages(tracking_code);
CREATE INDEX idx_orders_external_order_id ON public.orders(external_order_id);
CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_orders_company ON public.orders(company_id);
CREATE INDEX idx_packages_company ON public.packages(company_id);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_package_items_package ON public.package_items(package_id);
CREATE INDEX idx_scans_package ON public.scans(package_id);
CREATE INDEX idx_profiles_company ON public.profiles(company_id);

-- Helper function (now profiles table exists)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- RLS POLICIES

-- companies
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.get_user_company_id());
CREATE POLICY "Users can update own company" ON public.companies
  FOR UPDATE TO authenticated USING (id = public.get_user_company_id());

-- profiles
CREATE POLICY "Users can view company profiles" ON public.profiles
  FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Company-scoped policies for all data tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['products','product_variants','orders','order_items','packages','package_items','scans','marketplace_accounts'])
  LOOP
    EXECUTE format('CREATE POLICY "Company select %s" ON public.%I FOR SELECT TO authenticated USING (company_id = public.get_user_company_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "Company insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "Company update %s" ON public.%I FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id())', tbl, tbl);
    EXECUTE format('CREATE POLICY "Company delete %s" ON public.%I FOR DELETE TO authenticated USING (company_id = public.get_user_company_id())', tbl, tbl);
  END LOOP;
END $$;

-- Auto-create company + profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
BEGIN
  INSERT INTO public.companies (name) VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'))
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (id, company_id, name, role)
  VALUES (NEW.id, new_company_id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

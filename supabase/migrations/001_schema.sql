-- ============================================================
-- BIP CERTO – Supabase Schema (Migration 001)
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- ─── Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ─── TABLES ────────────────────────────────────────────────

-- 1) companies
create table if not exists public.companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null default 'Bip Certo',
  created_at  timestamptz not null default now()
);

-- 2) profiles (linked to auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id),
  name        text,
  role        text not null default 'staff',  -- 'admin' | 'staff'
  created_at  timestamptz not null default now()
);

-- 3) products
create table if not exists public.products (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id),
  name        text not null,
  base_sku    text,
  created_at  timestamptz not null default now()
);

-- 4) product_variants
create table if not exists public.product_variants (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id),
  product_id   uuid not null references public.products(id) on delete cascade,
  variant_name text,
  sku          text,
  attributes   jsonb default '{}',  -- {"size":"G","color":"Azul"}
  created_at   timestamptz not null default now()
);

-- 5) orders
create table if not exists public.orders (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid not null references public.companies(id),
  marketplace       text not null,  -- 'shopee' | 'aliexpress' | 'shein'
  external_order_id text not null,
  customer_name     text,
  address_summary   text,
  status            text not null default 'received',
  created_at        timestamptz not null default now()
);

-- 6) order_items
create table if not exists public.order_items (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id),
  order_id    uuid not null references public.orders(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id),
  qty         int not null default 1
);

-- 7) packages
create table if not exists public.packages (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id),
  order_id        uuid references public.orders(id),
  package_number  int not null default 1,
  scan_code       text unique,
  tracking_code   text,
  status          text not null default 'packed',  -- 'packed' | 'checking' | 'shipped' | 'cancelled'
  last_scanned_at timestamptz,
  created_at      timestamptz not null default now()
);

-- 8) package_items
create table if not exists public.package_items (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id),
  package_id  uuid not null references public.packages(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id),
  qty         int not null default 1
);

-- 9) scans (audit log of actions)
create table if not exists public.scans (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id),
  package_id  uuid references public.packages(id),
  user_id     uuid references auth.users(id),
  action      text not null,  -- 'scan' | 'checking' | 'packed' | 'shipped' | 'cancelled'
  meta        jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- 10) imports
create table if not exists public.imports (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id),
  user_id     uuid references auth.users(id),
  marketplace text,
  filename    text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running',  -- 'running' | 'success' | 'failed'
  stats       jsonb default '{}',
  errors      jsonb default '[]'
);

-- ─── INDEXES ───────────────────────────────────────────────
create unique index if not exists idx_packages_scan_code       on public.packages(scan_code) where scan_code is not null;
create        index if not exists idx_packages_tracking_code   on public.packages(tracking_code);
create        index if not exists idx_orders_external_order_id on public.orders(company_id, marketplace, external_order_id);
create        index if not exists idx_variants_sku             on public.product_variants(company_id, sku) where sku is not null;
create        index if not exists idx_variants_name            on public.product_variants using gin(variant_name gin_trgm_ops);
create        index if not exists idx_variants_size            on public.product_variants((attributes->>'size'));
create        index if not exists idx_products_name            on public.products using gin(name gin_trgm_ops);
create        index if not exists idx_imports_company          on public.imports(company_id, started_at desc);
create        index if not exists idx_scans_package            on public.scans(package_id, created_at desc);

-- Unique constraint para evitar duplicação de pedidos
create unique index if not exists idx_orders_unique
  on public.orders(company_id, marketplace, external_order_id);

-- Unique constraint para order_items
create unique index if not exists idx_order_items_unique
  on public.order_items(order_id, variant_id);

-- Unique constraint para products por nome+empresa
create unique index if not exists idx_products_unique
  on public.products(company_id, name);

-- Unique constraint para variants por sku+empresa
create unique index if not exists idx_variants_unique_sku
  on public.product_variants(company_id, sku) where sku is not null;

-- ─── TRIGGER: auto-create company + profile on first signup ────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  -- Pegar a empresa existente (só há 1 empresa no cenário desta app)
  select id into v_company_id from public.companies limit 1;

  -- Se não existe nenhuma empresa, criar a primeira
  if v_company_id is null then
    insert into public.companies(name) values ('Bip Certo')
    returning id into v_company_id;
  end if;

  -- Criar profile vinculado à empresa
  insert into public.profiles(id, company_id, name, role)
  values (
    new.id,
    v_company_id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    -- Primeiro usuário vira admin
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'staff' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Recriar trigger (drop first for idempotency)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── ROW LEVEL SECURITY ────────────────────────────────────

alter table public.companies       enable row level security;
alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.packages        enable row level security;
alter table public.package_items   enable row level security;
alter table public.scans           enable row level security;
alter table public.imports         enable row level security;

-- Helper function para pegar company_id do usuário logado
create or replace function public.my_company_id()
returns uuid
language sql
stable
security definer
as $$
  select company_id from public.profiles where id = auth.uid() limit 1;
$$;

-- ── companies ──
create policy "companies_select" on public.companies
  for select using (id = public.my_company_id());

-- ── profiles ──
create policy "profiles_select" on public.profiles
  for select using (company_id = public.my_company_id());

create policy "profiles_insert" on public.profiles
  for insert with check (company_id = public.my_company_id());

create policy "profiles_update" on public.profiles
  for update using (company_id = public.my_company_id());

-- ── products ──
create policy "products_all" on public.products
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── product_variants ──
create policy "variants_all" on public.product_variants
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── orders ──
create policy "orders_all" on public.orders
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── order_items ──
create policy "order_items_all" on public.order_items
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── packages ──
create policy "packages_all" on public.packages
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── package_items ──
create policy "package_items_all" on public.package_items
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── scans ──
create policy "scans_all" on public.scans
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ── imports ──
create policy "imports_all" on public.imports
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

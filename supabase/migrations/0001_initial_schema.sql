-- 0001_initial_schema.sql
-- Inicializa o schema core da plataforma Mariana Explica

create extension if not exists "pgcrypto";

-- Perfis de usuário
create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null,
  email text not null,
  role text not null default 'student',
  is_admin boolean not null default false,
  status text not null default 'active',
  avatar_url text null,
  phone text null,
  marketing_consent boolean not null default false,
  notifications_enabled boolean not null default true,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- Catálogo de produtos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  short_description text,
  description text,
  product_type text not null default 'paid',
  status text not null default 'draft',
  price_cents integer not null default 0,
  currency text not null default 'EUR',
  cover_image_url text,
  sales_page_enabled boolean not null default true,
  requires_auth boolean not null default true,
  is_featured boolean not null default false,
  allow_affiliate boolean not null default true,
  sort_order integer not null default 0,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_idx on public.products (status);
create index if not exists products_type_idx on public.products (product_type);
create index if not exists products_featured_idx on public.products (is_featured);
create index if not exists products_sort_order_idx on public.products (sort_order);

-- Módulos de produto
create table if not exists public.product_modules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  description text,
  module_type text not null default 'pdf',
  access_type text not null default 'paid_only',
  sort_order integer not null default 0,
  is_preview boolean not null default false,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_modules_product_id_idx on public.product_modules (product_id);
create index if not exists product_modules_status_idx on public.product_modules (status);
create index if not exists product_modules_sort_order_idx on public.product_modules (sort_order);
create index if not exists product_modules_access_type_idx on public.product_modules (access_type);

-- Ativos de módulo
create table if not exists public.module_assets (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.product_modules(id) on delete cascade,
  asset_type text not null,
  title text not null,
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  allow_download boolean not null default false,
  allow_stream boolean not null default true,
  watermark_enabled boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists module_assets_module_id_idx on public.module_assets (module_id);
create index if not exists module_assets_asset_type_idx on public.module_assets (asset_type);
create index if not exists module_assets_status_idx on public.module_assets (status);

-- Pedidos
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  coupon_id uuid null,
  affiliate_id uuid null,
  status text not null default 'pending',
  currency text not null default 'EUR',
  base_price_cents integer not null default 0,
  discount_cents integer not null default 0,
  final_price_cents integer not null default 0,
  payment_provider text,
  payment_reference text,
  checkout_session_id text,
  paid_at timestamptz null,
  refunded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_product_id_idx on public.orders (product_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_reference_idx on public.orders (payment_reference);
create index if not exists orders_created_at_idx on public.orders (created_at);
create index if not exists orders_user_status_idx on public.orders (user_id, status);

-- Itens de pedido
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_title_snapshot text not null,
  unit_price_cents integer not null,
  discount_cents integer not null default 0,
  final_price_cents integer not null,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);

-- Grants de acesso
create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source_type text not null default 'purchase',
  source_order_id uuid null references public.orders(id) on delete set null,
  status text not null default 'active',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  expires_at timestamptz null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_grants_user_id_idx on public.access_grants (user_id);
create index if not exists access_grants_product_id_idx on public.access_grants (product_id);
create index if not exists access_grants_status_idx on public.access_grants (status);
create index if not exists access_grants_user_product_status_idx on public.access_grants (user_id, product_id, status);

-- Trigger para atualizar updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger product_modules_updated_at before update on public.product_modules for each row execute function public.set_updated_at();
create trigger module_assets_updated_at before update on public.module_assets for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger access_grants_updated_at before update on public.access_grants for each row execute function public.set_updated_at();

-- Trigger de bootstrap de profiles para auth.users
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, is_admin, status, created_at, updated_at)
  values (new.id, new.user_metadata->> 'full_name', new.email, 'student', false, 'active', now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Função auxiliar de admin
create or replace function public.is_admin() returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$ language sql stable;

-- RLS e policies
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
create policy profiles_admin_select on public.profiles for select using (public.is_admin());
create policy profiles_admin_update on public.profiles for update using (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete using (public.is_admin());

alter table public.orders enable row level security;
create policy orders_select_own on public.orders for select using (user_id = auth.uid());
create policy orders_insert_own on public.orders for insert with check (user_id = auth.uid());
create policy orders_update_own on public.orders for update using (user_id = auth.uid());
create policy orders_admin_manage on public.orders for all using (public.is_admin());

alter table public.order_items enable row level security;
create policy order_items_select_own on public.order_items for select using (
  exists(
    select 1 from public.orders
    where orders.id = order_items.order_id and orders.user_id = auth.uid()
  )
);
create policy order_items_admin_select on public.order_items for select using (public.is_admin());

alter table public.access_grants enable row level security;
create policy access_grants_select_own on public.access_grants for select using (user_id = auth.uid());
create policy access_grants_insert_own on public.access_grants for insert with check (user_id = auth.uid());
create policy access_grants_update_own on public.access_grants for update using (user_id = auth.uid());
create policy access_grants_admin_manage on public.access_grants for all using (public.is_admin());

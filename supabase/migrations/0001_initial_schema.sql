-- 0001_initial_schema.sql
-- Inicializa o schema core da plataforma Mariana Explica

create extension if not exists "pgcrypto";

-- Core tables
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
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'affiliate', 'admin'));
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'inactive', 'blocked', 'pending_review'));
alter table public.profiles
  add constraint profiles_admin_consistency_check
  check ((role = 'admin') = is_admin);

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
alter table public.products
  add constraint products_product_type_check
  check (product_type in ('paid', 'free', 'hybrid', 'external_service'));
alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'published', 'archived'));
alter table public.products
  add constraint products_price_check
  check (price_cents >= 0);
alter table public.products
  add constraint products_paid_price_check
  check (
    (product_type = 'paid' and price_cents > 0)
    or (product_type = 'free' and price_cents = 0)
    or (product_type in ('hybrid', 'external_service'))
  );

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
alter table public.product_modules
  add constraint product_modules_module_type_check
  check (module_type in ('pdf', 'video', 'external_link', 'mixed'));
alter table public.product_modules
  add constraint product_modules_access_type_check
  check (access_type in ('public', 'registered', 'paid_only'));
alter table public.product_modules
  add constraint product_modules_status_check
  check (status in ('draft', 'published', 'archived'));

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
alter table public.module_assets
  add constraint module_assets_asset_type_check
  check (asset_type in ('pdf', 'video_file', 'video_embed', 'external_link'));
alter table public.module_assets
  add constraint module_assets_status_check
  check (status in ('active', 'inactive'));
alter table public.module_assets
  add constraint module_assets_source_check
  check (
    (
      storage_bucket is not null
      and storage_path is not null
      and external_url is null
    )
    or (
      external_url is not null
      and storage_bucket is null
      and storage_path is null
    )
  );

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
create unique index if not exists orders_payment_reference_unique_idx
  on public.orders (payment_reference)
  where payment_reference is not null;
create index if not exists orders_created_at_idx on public.orders (created_at);
create index if not exists orders_user_status_idx on public.orders (user_id, status);
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded'));
alter table public.orders
  add constraint orders_price_checks
  check (
    base_price_cents >= 0
    and discount_cents >= 0
    and final_price_cents >= 0
  );

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
alter table public.order_items
  add constraint order_items_price_checks
  check (
    unit_price_cents >= 0
    and discount_cents >= 0
    and final_price_cents >= 0
  );

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
create unique index if not exists access_grants_active_unique_idx
  on public.access_grants (user_id, product_id)
  where status = 'active';
alter table public.access_grants
  add constraint access_grants_source_type_check
  check (source_type in ('purchase', 'free_claim', 'admin_grant', 'manual_adjustment'));
alter table public.access_grants
  add constraint access_grants_status_check
  check (status in ('active', 'revoked', 'expired'));

-- Shared helpers
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.is_active_profile(target_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.profiles
    where id = target_user
      and status = 'active'
  );
$$;

create or replace function public.is_admin() returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_admin = true
      and status = 'active'
  );
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text;
begin
  fallback_name := nullif(trim(coalesce(new.user_metadata->>'full_name', '')), '');
  if fallback_name is null then
    fallback_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  insert into public.profiles (id, full_name, email, role, is_admin, status, created_at, updated_at)
  values (new.id, fallback_name, lower(new.email), 'student', false, 'active', now(), now())
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation() returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.id
     and not public.is_admin() then
    if new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.is_admin is distinct from old.is_admin
       or new.status is distinct from old.status then
      raise exception 'profile privilege escalation is not allowed';
    end if;
  end if;

  return new;
end;
$$;

-- Triggers
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger product_modules_updated_at before update on public.product_modules for each row execute function public.set_updated_at();
create trigger module_assets_updated_at before update on public.module_assets for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger access_grants_updated_at before update on public.access_grants for each row execute function public.set_updated_at();
create trigger profiles_sensitive_update_guard before update on public.profiles for each row execute function public.prevent_profile_privilege_escalation();

create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger auth_user_updated after update on auth.users for each row execute function public.handle_new_user();

-- RLS and policies
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and status = 'active');
create policy profiles_admin_select on public.profiles for select using (public.is_admin());
create policy profiles_admin_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete using (public.is_admin());

alter table public.products enable row level security;
create policy products_select_published on public.products for select using (status = 'published');
create policy products_admin_select on public.products for select using (public.is_admin());
create policy products_admin_manage on public.products for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_modules enable row level security;
create policy product_modules_admin_select on public.product_modules for select using (public.is_admin());
create policy product_modules_admin_manage on public.product_modules for all using (public.is_admin()) with check (public.is_admin());

alter table public.module_assets enable row level security;
create policy module_assets_admin_select on public.module_assets for select using (public.is_admin());
create policy module_assets_admin_manage on public.module_assets for all using (public.is_admin()) with check (public.is_admin());

alter table public.orders enable row level security;
create policy orders_select_own on public.orders for select using (user_id = auth.uid() and public.is_active_profile());
create policy orders_select_admin on public.orders for select using (public.is_admin());
create policy orders_admin_manage on public.orders for all using (public.is_admin()) with check (public.is_admin());

alter table public.order_items enable row level security;
create policy order_items_select_own on public.order_items for select using (
  exists(
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
      and public.is_active_profile()
  )
);
create policy order_items_admin_select on public.order_items for select using (public.is_admin());

alter table public.access_grants enable row level security;
create policy access_grants_select_own on public.access_grants for select using (user_id = auth.uid() and public.is_active_profile());
create policy access_grants_select_admin on public.access_grants for select using (public.is_admin());
create policy access_grants_admin_manage on public.access_grants for all using (public.is_admin()) with check (public.is_admin());

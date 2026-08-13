-- Lead capture and secure downloads for free products.
begin;

create table public.product_download_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete restrict,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'r2')),
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text null,
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_download_files_storage_source_check check (char_length(trim(storage_bucket)) > 0 and char_length(trim(storage_path)) > 0)
);
create index product_download_files_active_product_idx on public.product_download_files(product_id) where status = 'active';

create table public.free_product_leads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 3 and 320),
  normalized_email text not null check (normalized_email = lower(trim(normalized_email))),
  source text not null default 'public_product_page' check (char_length(trim(source)) between 1 and 80),
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'failed')),
  request_count integer not null default 1 check (request_count > 0),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, normalized_email)
);
create index free_product_leads_product_id_idx on public.free_product_leads(product_id);
create index free_product_leads_normalized_email_idx on public.free_product_leads(normalized_email);

create or replace function public.register_free_product_lead(
  input_product_id uuid,
  input_name text,
  input_email text,
  input_source text,
  input_metadata jsonb default '{}'::jsonb
) returns public.free_product_leads
language plpgsql security definer set search_path = public as $$
declare result public.free_product_leads;
begin
  insert into public.free_product_leads (product_id, name, email, normalized_email, source, delivery_status, request_count, metadata)
  values (input_product_id, input_name, input_email, lower(trim(input_email)), input_source, 'queued', 1, coalesce(input_metadata, '{}'::jsonb))
  on conflict (product_id, normalized_email) do update set
    name = excluded.name,
    email = excluded.email,
    delivery_status = 'queued',
    request_count = public.free_product_leads.request_count + 1,
    last_requested_at = now(),
    metadata = public.free_product_leads.metadata || excluded.metadata
  returning * into result;
  return result;
end;
$$;

create table public.free_product_download_tokens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.free_product_leads(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_download_file_id uuid not null references public.product_download_files(id) on delete restrict,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  usage_count integer not null default 0 check (usage_count >= 0),
  max_uses integer not null default 3 check (max_uses between 1 and 10),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  constraint free_product_download_tokens_expiry_check check (expires_at > created_at)
);
create index free_product_download_tokens_lookup_idx on public.free_product_download_tokens(token_hash) where revoked_at is null;
create index free_product_download_tokens_lead_idx on public.free_product_download_tokens(lead_id);

create or replace function public.guard_free_product_structure()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  product_kind text;
  has_modules boolean;
  has_lessons boolean;
  has_assessments boolean;
  has_orders boolean;
  has_grants boolean;
  has_file boolean;
begin
  if new.product_type = 'free' then
    select exists(select 1 from product_modules where product_id = new.id) into has_modules;
    select exists(select 1 from product_lessons l join product_modules m on m.id = l.module_id where m.product_id = new.id) into has_lessons;
    select exists(select 1 from product_assessments where product_id = new.id) into has_assessments;
    select exists(select 1 from orders where product_id = new.id) into has_orders;
    select exists(select 1 from access_grants where product_id = new.id) into has_grants;
    if has_modules or has_lessons or has_assessments or has_orders or has_grants then
      raise exception 'produto gratuito nao pode possuir modulos, aulas, avaliacoes, pedidos ou acessos existentes';
    end if;
    if new.status = 'published' then
      select exists(select 1 from product_download_files where product_id = new.id and status = 'active') into has_file;
      if not has_file then raise exception 'produto gratuito requer um ficheiro principal ativo antes da publicacao'; end if;
    end if;
  elsif old.product_type = 'free' and new.product_type <> 'free' then
    update free_product_download_tokens set revoked_at = coalesce(revoked_at, now()) where product_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.guard_free_product_content()
returns trigger language plpgsql security definer set search_path = public as $$
declare product_kind text;
begin
  select product_type into strict product_kind from products where id = new.product_id;
  if product_kind = 'free' then raise exception 'produtos gratuitos nao aceitam modulos, aulas ou avaliacoes'; end if;
  return new;
end;
$$;

create or replace function public.guard_free_product_lessons()
returns trigger language plpgsql security definer set search_path = public as $$
declare product_kind text;
begin
  select p.product_type into strict product_kind from product_modules m join products p on p.id = m.product_id where m.id = new.module_id;
  if product_kind = 'free' then raise exception 'produtos gratuitos nao aceitam aulas'; end if;
  return new;
end;
$$;

drop trigger if exists products_free_structure_guard on public.products;
create trigger products_free_structure_guard before update of product_type, status on public.products for each row execute function public.guard_free_product_structure();
drop trigger if exists product_modules_free_product_guard on public.product_modules;
create trigger product_modules_free_product_guard before insert or update of product_id on public.product_modules for each row execute function public.guard_free_product_content();
drop trigger if exists product_lessons_free_product_guard on public.product_lessons;
create trigger product_lessons_free_product_guard before insert or update of module_id on public.product_lessons for each row execute function public.guard_free_product_lessons();
drop trigger if exists product_assessments_free_product_guard on public.product_assessments;
create trigger product_assessments_free_product_guard before insert or update of product_id on public.product_assessments for each row execute function public.guard_free_product_content();

create or replace function public.revoke_replaced_free_download_tokens()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.storage_bucket is distinct from new.storage_bucket or old.storage_path is distinct from new.storage_path or old.status = 'active' and new.status <> 'active' then
    update free_product_download_tokens set revoked_at = coalesce(revoked_at, now()) where product_download_file_id = old.id;
  end if;
  return new;
end;
$$;
create trigger product_download_files_revoke_tokens before update on public.product_download_files for each row execute function public.revoke_replaced_free_download_tokens();

create trigger product_download_files_updated_at before update on public.product_download_files for each row execute function public.set_updated_at();
create trigger free_product_leads_updated_at before update on public.free_product_leads for each row execute function public.set_updated_at();

alter table public.product_download_files enable row level security;
alter table public.free_product_leads enable row level security;
alter table public.free_product_download_tokens enable row level security;
create policy product_download_files_admin_only on public.product_download_files for all using (public.is_admin()) with check (public.is_admin());
create policy free_product_leads_admin_only on public.free_product_leads for all using (public.is_admin()) with check (public.is_admin());
create policy free_product_download_tokens_admin_only on public.free_product_download_tokens for all using (public.is_admin()) with check (public.is_admin());

revoke all on function public.register_free_product_lead(uuid, text, text, text, jsonb) from public;
grant execute on function public.register_free_product_lead(uuid, text, text, text, jsonb) to service_role;

commit;

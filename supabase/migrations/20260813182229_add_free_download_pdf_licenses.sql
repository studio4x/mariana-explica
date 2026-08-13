-- Store only the private, user-specific PDF copy created for a valid free-download token.
-- The source file remains immutable and access continues to be authorized by the token.
begin;

create table if not exists public.free_product_download_licenses (
  id uuid primary key default gen_random_uuid(),
  download_token_id uuid not null unique references public.free_product_download_tokens(id) on delete cascade,
  product_download_file_id uuid not null references public.product_download_files(id) on delete restrict,
  storage_provider text not null check (storage_provider in ('supabase', 'r2')),
  storage_bucket text not null check (char_length(trim(storage_bucket)) > 0),
  storage_path text not null check (char_length(trim(storage_path)) > 0),
  license_key_hash text not null check (license_key_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint free_product_download_licenses_expiry_check check (expires_at > created_at)
);

create index if not exists free_product_download_licenses_expiry_idx
  on public.free_product_download_licenses(expires_at);

alter table public.free_product_download_licenses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'free_product_download_licenses'
      and policyname = 'free_product_download_licenses_admin_only'
  ) then
    create policy free_product_download_licenses_admin_only
      on public.free_product_download_licenses
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end;
$$;

revoke all on table public.free_product_download_licenses from anon, authenticated;

comment on table public.free_product_download_licenses is
  'Private, temporary PDF copies stamped with the recipient identity for free-material downloads.';

commit;

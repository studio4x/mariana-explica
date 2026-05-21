-- 0031_site_page_builder_foundation.sql
-- Fase 1: builder visual institucional (home + paginas legais/institucionais)

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_version_id uuid null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  layout_json jsonb not null default '{}'::jsonb,
  style_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (page_id, version_number)
);

create table if not exists public.site_page_assets (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  bucket text not null,
  path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text null,
  file_size_bytes bigint null,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists site_page_assets_bucket_path_uidx
  on public.site_page_assets(bucket, path);

create index if not exists site_pages_slug_idx
  on public.site_pages(slug);

create index if not exists site_pages_status_idx
  on public.site_pages(status);

create index if not exists site_page_versions_page_id_idx
  on public.site_page_versions(page_id);

create index if not exists site_page_versions_status_idx
  on public.site_page_versions(status);

create index if not exists site_page_versions_created_at_idx
  on public.site_page_versions(created_at desc);

create index if not exists site_page_assets_page_id_idx
  on public.site_page_assets(page_id);

create trigger site_pages_updated_at
  before update on public.site_pages
  for each row
  execute function public.set_updated_at();

alter table public.site_pages
  add constraint site_pages_published_version_fk
  foreign key (published_version_id) references public.site_page_versions(id)
  on delete set null;

alter table public.site_pages enable row level security;
alter table public.site_page_versions enable row level security;
alter table public.site_page_assets enable row level security;

create policy site_pages_select_published
  on public.site_pages
  for select
  using (status = 'published');

create policy site_pages_select_admin
  on public.site_pages
  for select
  using (public.is_admin());

create policy site_pages_admin_manage
  on public.site_pages
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy site_page_versions_select_published
  on public.site_page_versions
  for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.site_pages p
      where p.id = site_page_versions.page_id
        and p.status = 'published'
        and p.published_version_id = site_page_versions.id
    )
  );

create policy site_page_versions_select_admin
  on public.site_page_versions
  for select
  using (public.is_admin());

create policy site_page_versions_admin_manage
  on public.site_page_versions
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy site_page_assets_select_admin
  on public.site_page_assets
  for select
  using (public.is_admin());

create policy site_page_assets_admin_manage
  on public.site_page_assets
  for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.site_pages (slug, title, status)
values
  ('home', 'Home', 'draft'),
  ('sobre', 'Sobre', 'draft'),
  ('privacidade', 'Privacidade', 'draft'),
  ('cookies', 'Cookies', 'draft'),
  ('termos', 'Termos de uso', 'draft')
on conflict (slug) do update
set
  title = excluded.title;

-- 0031_site_page_builder_foundation.sql
-- Foundation for visual page editor (institutional pages + home).

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft',
  published_version_id uuid null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_pages_slug_check check (char_length(slug) between 2 and 120),
  constraint site_pages_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  layout_json jsonb not null default '{}'::jsonb,
  style_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint site_page_versions_status_check check (status in ('draft', 'published', 'archived')),
  constraint site_page_versions_version_number_check check (version_number >= 1),
  constraint site_page_versions_layout_json_object_check check (jsonb_typeof(layout_json) = 'object'),
  constraint site_page_versions_style_json_object_check check (jsonb_typeof(style_json) = 'object'),
  constraint site_page_versions_metadata_json_object_check check (jsonb_typeof(metadata) = 'object'),
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
  created_at timestamptz not null default now(),
  constraint site_page_assets_bucket_check check (char_length(bucket) between 3 and 120),
  constraint site_page_assets_path_check check (char_length(path) between 3 and 1000),
  constraint site_page_assets_public_url_check check (char_length(public_url) between 8 and 2000),
  constraint site_page_assets_file_name_check check (char_length(file_name) between 1 and 260),
  unique (bucket, path)
);

alter table public.site_pages
  drop constraint if exists site_pages_published_version_id_fkey;

alter table public.site_pages
  add constraint site_pages_published_version_id_fkey
  foreign key (published_version_id)
  references public.site_page_versions(id)
  on delete set null;

create index if not exists site_pages_slug_idx on public.site_pages (slug);
create index if not exists site_pages_status_idx on public.site_pages (status);
create index if not exists site_pages_published_version_id_idx on public.site_pages (published_version_id);

create index if not exists site_page_versions_page_id_idx on public.site_page_versions (page_id);
create index if not exists site_page_versions_created_at_idx on public.site_page_versions (created_at desc);
create index if not exists site_page_versions_status_idx on public.site_page_versions (status);

create index if not exists site_page_assets_page_id_idx on public.site_page_assets (page_id);
create index if not exists site_page_assets_created_at_idx on public.site_page_assets (created_at desc);

drop trigger if exists site_pages_updated_at on public.site_pages;
create trigger site_pages_updated_at
before update on public.site_pages
for each row execute function public.set_updated_at();

alter table public.site_pages enable row level security;
alter table public.site_page_versions enable row level security;
alter table public.site_page_assets enable row level security;

drop policy if exists site_pages_select_public on public.site_pages;
drop policy if exists site_pages_select_admin on public.site_pages;
drop policy if exists site_pages_admin_manage on public.site_pages;
create policy site_pages_select_public
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

drop policy if exists site_page_versions_select_public on public.site_page_versions;
drop policy if exists site_page_versions_select_admin on public.site_page_versions;
drop policy if exists site_page_versions_admin_manage on public.site_page_versions;
create policy site_page_versions_select_public
  on public.site_page_versions
  for select
  using (
    exists (
      select 1
      from public.site_pages p
      where p.published_version_id = site_page_versions.id
        and p.status = 'published'
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

drop policy if exists site_page_assets_select_admin on public.site_page_assets;
drop policy if exists site_page_assets_admin_manage on public.site_page_assets;
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
  ('termos', 'Termos de Uso', 'draft')
on conflict (slug) do update
set
  title = excluded.title;

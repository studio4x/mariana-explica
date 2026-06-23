-- 0043_visual_site_editor_foundation.sql
-- Novo editor visual paralelo ao builder legado, com namespace proprio.

create table if not exists public.visual_site_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_version_id uuid null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.visual_site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.visual_site_pages(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  entries_json jsonb not null default '{}'::jsonb,
  style_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (page_id, version_number)
);

create table if not exists public.visual_site_page_assets (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.visual_site_pages(id) on delete cascade,
  bucket text not null,
  path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text null,
  file_size_bytes bigint null,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists visual_site_page_assets_bucket_path_uidx
  on public.visual_site_page_assets(bucket, path);

create index if not exists visual_site_pages_page_key_idx
  on public.visual_site_pages(page_key);

create index if not exists visual_site_pages_status_idx
  on public.visual_site_pages(status);

create index if not exists visual_site_page_versions_page_id_idx
  on public.visual_site_page_versions(page_id);

create index if not exists visual_site_page_versions_status_idx
  on public.visual_site_page_versions(status);

create index if not exists visual_site_page_versions_created_at_idx
  on public.visual_site_page_versions(created_at desc);

create index if not exists visual_site_page_assets_page_id_idx
  on public.visual_site_page_assets(page_id);

create trigger visual_site_pages_updated_at
  before update on public.visual_site_pages
  for each row
  execute function public.set_updated_at();

alter table public.visual_site_pages
  add constraint visual_site_pages_published_version_fk
  foreign key (published_version_id) references public.visual_site_page_versions(id)
  on delete set null;

alter table public.visual_site_pages enable row level security;
alter table public.visual_site_page_versions enable row level security;
alter table public.visual_site_page_assets enable row level security;

create policy visual_site_pages_select_published
  on public.visual_site_pages
  for select
  using (status = 'published');

create policy visual_site_pages_select_admin
  on public.visual_site_pages
  for select
  using (public.is_admin());

create policy visual_site_pages_admin_manage
  on public.visual_site_pages
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy visual_site_page_versions_select_published
  on public.visual_site_page_versions
  for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.visual_site_pages p
      where p.id = visual_site_page_versions.page_id
        and p.status = 'published'
        and p.published_version_id = visual_site_page_versions.id
    )
  );

create policy visual_site_page_versions_select_admin
  on public.visual_site_page_versions
  for select
  using (public.is_admin());

create policy visual_site_page_versions_admin_manage
  on public.visual_site_page_versions
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy visual_site_page_assets_select_admin
  on public.visual_site_page_assets
  for select
  using (public.is_admin());

create policy visual_site_page_assets_admin_manage
  on public.visual_site_page_assets
  for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.visual_site_pages (page_key, title, status)
values ('support', 'Suporte', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with support_page as (
  select id
  from public.visual_site_pages
  where page_key = 'support'
),
support_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select
    support_page.id,
    1,
    'published',
    '{
      "hero": {
        "eyebrow": "Suporte e FAQ",
        "title": "Como podemos ajudar?",
        "lead": "Encontre respostas rapidas na FAQ e, se ainda precisar, abra um chamado para a equipa acompanhar o seu caso.",
        "primaryCta": {
          "label": "Abrir um chamado",
          "href": "/aluno/chamados?openTicketModal=1&ticketStep=form"
        },
        "secondaryCta": {
          "label": "Entrar na conta",
          "href": "/login"
        },
        "image": {
          "src": "data:image/svg+xml;utf8,<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 960 720''><defs><linearGradient id=''g'' x1=''0'' x2=''1'' y1=''0'' y2=''1''><stop offset=''0%'' stop-color=''#e0f2fe''/><stop offset=''100%'' stop-color=''#bae6fd''/></linearGradient></defs><rect width=''960'' height=''720'' rx=''48'' fill=''url(#g)''/><rect x=''70'' y=''70'' width=''820'' height=''580'' rx=''36'' fill=''#ffffff'' opacity=''0.9''/><circle cx=''320'' cy=''280'' r=''92'' fill=''#0f172a'' opacity=''0.08''/><rect x=''424'' y=''200'' width=''240'' height=''26'' rx=''13'' fill=''#0f172a'' opacity=''0.16''/><rect x=''424'' y=''246'' width=''180'' height=''18'' rx=''9'' fill=''#0f172a'' opacity=''0.12''/><rect x=''200'' y=''440'' width=''560'' height=''120'' rx=''28'' fill=''#0f172a'' opacity=''0.05''/><path d=''M286 506h388'' stroke=''#0284c7'' stroke-width=''18'' stroke-linecap=''round''/><path d=''M408 506l48-48 42 42 70-86 78 70'' fill=''none'' stroke=''#0284c7'' stroke-width=''18'' stroke-linecap=''round'' stroke-linejoin=''round''/></svg>",
          "alt": "Ilustracao de apoio e contacto"
        }
      },
      "supportCta": {
        "title": "Ainda precisa de ajuda?",
        "lead": "Abra um chamado autenticado para receber acompanhamento pelo dashboard.",
        "primaryCta": {
          "label": "Abrir um chamado",
          "href": "/aluno/chamados?openTicketModal=1&ticketStep=form"
        },
        "secondaryCta": {
          "label": "Entrar na conta",
          "href": "/login"
        }
      }
    }'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  from support_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = support_version.id
from support_version
where p.id = support_version.page_id;

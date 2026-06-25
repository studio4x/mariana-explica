-- 0045_visual_site_editor_public_pages.sql
-- Baseline das demais paginas publicas no namespace do editor visual.

insert into public.visual_site_pages (page_key, title, status)
values ('home', 'Home', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with home_page as (
  select id
  from public.visual_site_pages
  where page_key = 'home'
),
home_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select home_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from home_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = home_version.id
from home_version
where p.id = home_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('about', 'Sobre', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with about_page as (
  select id
  from public.visual_site_pages
  where page_key = 'about'
),
about_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select about_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from about_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = about_version.id
from about_version
where p.id = about_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('explicacoes', 'Explicacoes', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with explicacoes_page as (
  select id
  from public.visual_site_pages
  where page_key = 'explicacoes'
),
explicacoes_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select explicacoes_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from explicacoes_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = explicacoes_version.id
from explicacoes_version
where p.id = explicacoes_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('privacy', 'Privacidade', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with privacy_page as (
  select id
  from public.visual_site_pages
  where page_key = 'privacy'
),
privacy_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select privacy_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from privacy_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = privacy_version.id
from privacy_version
where p.id = privacy_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('cookies', 'Cookies', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with cookies_page as (
  select id
  from public.visual_site_pages
  where page_key = 'cookies'
),
cookies_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select cookies_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from cookies_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = cookies_version.id
from cookies_version
where p.id = cookies_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('terms', 'Termos', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with terms_page as (
  select id
  from public.visual_site_pages
  where page_key = 'terms'
),
terms_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select terms_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from terms_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = terms_version.id
from terms_version
where p.id = terms_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('checkout', 'Checkout', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with checkout_page as (
  select id
  from public.visual_site_pages
  where page_key = 'checkout'
),
checkout_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select checkout_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from checkout_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = checkout_version.id
from checkout_version
where p.id = checkout_version.page_id;

insert into public.visual_site_pages (page_key, title, status)
values ('checkout-success', 'Checkout concluido', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with checkout_success_page as (
  select id
  from public.visual_site_pages
  where page_key = 'checkout-success'
),
checkout_success_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select checkout_success_page.id, 1, 'published', '{}'::jsonb, '{}'::jsonb, '{"seeded_via":"migration_0045_visual_site_editor_public_pages"}'::jsonb
  from checkout_success_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = checkout_success_version.id
from checkout_success_version
where p.id = checkout_success_version.page_id;


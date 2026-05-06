create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_categories_active_idx on public.product_categories (is_active);
create index if not exists product_categories_sort_order_idx on public.product_categories (sort_order);

alter table public.product_categories
  add constraint product_categories_slug_check
  check (slug = lower(slug));

alter table public.products
  add column if not exists category_id uuid null references public.product_categories(id) on delete set null;

create index if not exists products_category_id_idx on public.products (category_id);

create trigger product_categories_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

drop policy if exists product_categories_select_active on public.product_categories;
create policy product_categories_select_active
  on public.product_categories
  for select
  using (is_active = true);

drop policy if exists product_categories_admin_select on public.product_categories;
create policy product_categories_admin_select
  on public.product_categories
  for select
  using (public.is_admin());

drop policy if exists product_categories_admin_manage on public.product_categories;
create policy product_categories_admin_manage
  on public.product_categories
  for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.product_categories (slug, title, description, sort_order, is_active)
values
  ('packs-poupanca', 'Packs poupança', 'Conjuntos completos de materiais para estudar com mais contexto.', 1, true),
  ('sebentas-individuais', 'Sebentas individuais', 'Materiais focados por tema, disciplina ou objetivo.', 2, true),
  ('explicacoes', 'Explicações', 'Apoio personalizado e acompanhamento direto.', 3, true),
  ('gratuitos', 'Gratuitos', 'Materiais gratuitos para começar sem fricção.', 4, true)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

update public.products
set category_id = product_categories.id
from public.product_categories
where public.products.category_id is null
  and (
    (public.products.product_type = 'free' and product_categories.slug = 'gratuitos')
    or (public.products.product_type = 'external_service' and product_categories.slug = 'explicacoes')
    or (
      product_categories.slug = 'packs-poupanca'
      and (
        lower(public.products.slug) like '%pack%'
        or lower(public.products.title) like '%pack%'
        or lower(coalesce(public.products.short_description, '')) like '%pack%'
      )
    )
    or (
      product_categories.slug = 'sebentas-individuais'
      and public.products.product_type in ('paid', 'hybrid')
    )
  );

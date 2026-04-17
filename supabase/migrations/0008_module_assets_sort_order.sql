alter table public.module_assets
  add column if not exists sort_order integer not null default 0;

create index if not exists module_assets_sort_order_idx on public.module_assets (sort_order);

comment on column public.module_assets.sort_order is
  'Ordenação do asset dentro do módulo (aula/material).';


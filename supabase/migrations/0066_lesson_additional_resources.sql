alter table public.module_assets
  add column if not exists lesson_id uuid null references public.product_lessons(id) on delete cascade;

create index if not exists module_assets_lesson_id_idx
  on public.module_assets (lesson_id, sort_order);

drop policy if exists module_assets_select_accessible on public.module_assets;
create policy module_assets_select_accessible on public.module_assets
for select using (
  status = 'active'
  and public.can_access_product_module(module_id)
  and (
    lesson_id is null
    or public.can_access_product_lesson(lesson_id, auth.uid())
  )
);

comment on column public.module_assets.lesson_id is
  'Aula à qual o recurso adicional foi ligado manualmente. Nulo indica um ativo do módulo ou da infraestrutura de conteúdo.';

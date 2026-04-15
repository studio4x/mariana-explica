-- 0003_access_and_ops_hardening.sql
-- Endurece acesso a conteudo, notificacoes e operacao de suporte

create or replace function public.has_active_grant(
  target_product_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.access_grants
    where product_id = target_product_id
      and user_id = target_user
      and status = 'active'
      and (expires_at is null or expires_at > now())
      and revoked_at is null
  );
$$;

create or replace function public.touch_support_ticket_last_reply()
returns trigger
language plpgsql
as $$
begin
  update public.support_tickets
  set last_reply_at = new.created_at,
      updated_at = now()
  where id = new.ticket_id;

  return new;
end;
$$;

create trigger support_ticket_messages_touch_ticket
after insert on public.support_ticket_messages
for each row execute function public.touch_support_ticket_last_reply();

alter table public.product_modules enable row level security;
drop policy if exists product_modules_admin_select on public.product_modules;
drop policy if exists product_modules_admin_manage on public.product_modules;
drop policy if exists product_modules_select_accessible on public.product_modules;
create policy product_modules_select_accessible on public.product_modules
for select using (
  status = 'published'
  and exists(
    select 1
    from public.products
    where products.id = product_modules.product_id
      and products.status = 'published'
  )
  and (
    public.is_admin()
    or access_type = 'public'
    or is_preview = true
    or (
      access_type = 'registered'
      and auth.uid() is not null
      and public.is_active_profile()
    )
    or (
      access_type = 'paid_only'
      and auth.uid() is not null
      and public.is_active_profile()
      and public.has_active_grant(product_id)
    )
  )
);
create policy product_modules_admin_manage on public.product_modules
for all using (public.is_admin()) with check (public.is_admin());

alter table public.module_assets enable row level security;
drop policy if exists module_assets_admin_select on public.module_assets;
drop policy if exists module_assets_admin_manage on public.module_assets;
drop policy if exists module_assets_select_accessible on public.module_assets;
create policy module_assets_select_accessible on public.module_assets
for select using (
  status = 'active'
  and exists(
    select 1
    from public.product_modules
    join public.products on products.id = product_modules.product_id
    where product_modules.id = module_assets.module_id
      and product_modules.status = 'published'
      and products.status = 'published'
      and (
        public.is_admin()
        or product_modules.access_type = 'public'
        or product_modules.is_preview = true
        or (
          product_modules.access_type = 'registered'
          and auth.uid() is not null
          and public.is_active_profile()
        )
        or (
          product_modules.access_type = 'paid_only'
          and auth.uid() is not null
          and public.is_active_profile()
          and public.has_active_grant(product_modules.product_id)
        )
      )
  )
);
create policy module_assets_admin_manage on public.module_assets
for all using (public.is_admin()) with check (public.is_admin());

alter table public.notifications enable row level security;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update using (
  user_id = auth.uid()
  and public.is_active_profile()
)
with check (
  user_id = auth.uid()
  and public.is_active_profile()
);

alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_update_own on public.support_tickets;

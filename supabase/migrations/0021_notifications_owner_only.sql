-- 0021_notifications_owner_only.sql
-- Restrict notifications visibility to the authenticated owner only.

alter table public.notifications enable row level security;

drop policy if exists notifications_select_admin on public.notifications;
drop policy if exists notifications_admin_manage on public.notifications;
drop policy if exists notifications_update_admin on public.notifications;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select using (
  user_id = auth.uid()
  and public.is_active_profile()
);

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

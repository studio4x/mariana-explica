-- 0017_admin_notifications_update_policy.sql
-- Allow admins to mark operational notifications as read from the floating center.

alter table public.notifications enable row level security;

drop policy if exists notifications_update_admin on public.notifications;
create policy notifications_update_admin
on public.notifications
for update
using (public.is_admin())
with check (public.is_admin());

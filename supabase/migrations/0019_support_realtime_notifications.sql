-- 0019_support_realtime_notifications.sql
-- Ensure support and notification tables emit Postgres Changes through Supabase Realtime.

alter table public.notifications
  alter column user_id drop not null;

alter table public.notifications replica identity full;
alter table public.support_tickets replica identity full;
alter table public.support_ticket_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.support_tickets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.support_ticket_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

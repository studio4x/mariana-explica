-- 0004_support_and_access_consistency.sql
-- Garante historico inicial de suporte e corrige consistencia operacional

create or replace function public.seed_support_ticket_initial_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_role_value text;
begin
  if exists (
    select 1
    from public.support_ticket_messages
    where ticket_id = new.id
  ) then
    return new;
  end if;

  select case when role = 'admin' then 'admin' else 'student' end
  into sender_role_value
  from public.profiles
  where id = new.user_id;

  insert into public.support_ticket_messages (
    ticket_id,
    sender_user_id,
    sender_role,
    message,
    created_at
  )
  values (
    new.id,
    new.user_id,
    coalesce(sender_role_value, 'student'),
    new.message,
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists support_tickets_seed_initial_message on public.support_tickets;
create trigger support_tickets_seed_initial_message
after insert on public.support_tickets
for each row execute function public.seed_support_ticket_initial_message();

insert into public.support_ticket_messages (
  ticket_id,
  sender_user_id,
  sender_role,
  message,
  created_at
)
select
  tickets.id,
  tickets.user_id,
  case when profiles.role = 'admin' then 'admin' else 'student' end,
  tickets.message,
  tickets.created_at
from public.support_tickets as tickets
join public.profiles on profiles.id = tickets.user_id
where not exists (
  select 1
  from public.support_ticket_messages as messages
  where messages.ticket_id = tickets.id
);

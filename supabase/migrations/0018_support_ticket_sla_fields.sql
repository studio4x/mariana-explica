-- 0018_support_ticket_sla_fields.sql
-- Extend support tickets with category and first-response SLA fields.

alter table public.support_tickets
  add column if not exists category text not null default 'general',
  add column if not exists first_response_due_at timestamptz null,
  add column if not exists first_response_at timestamptz null,
  add column if not exists sla_policy_key text not null default 'general',
  add column if not exists sla_status text not null default 'on_time';

create index if not exists support_tickets_category_idx on public.support_tickets (category);
create index if not exists support_tickets_first_response_due_at_idx on public.support_tickets (first_response_due_at);
create index if not exists support_tickets_sla_status_idx on public.support_tickets (sla_status);

alter table public.support_tickets
  drop constraint if exists support_tickets_category_check;
alter table public.support_tickets
  add constraint support_tickets_category_check
  check (category in ('payment', 'technical', 'account', 'general'));

alter table public.support_tickets
  drop constraint if exists support_tickets_priority_check;
alter table public.support_tickets
  add constraint support_tickets_priority_check
  check (priority in ('low', 'normal', 'medium', 'high', 'urgent'));

alter table public.support_tickets
  drop constraint if exists support_tickets_sla_status_check;
alter table public.support_tickets
  add constraint support_tickets_sla_status_check
  check (sla_status in ('on_time', 'at_risk', 'overdue', 'answered'));

create or replace function public.support_sla_hours(ticket_category text)
returns integer
language sql
stable
as $$
  select case ticket_category
    when 'payment' then 2
    else 24
  end;
$$;

create or replace function public.compute_support_sla_status(
  due_at timestamptz,
  answered_at timestamptz
)
returns text
language sql
stable
as $$
  select case
    when answered_at is not null then 'answered'
    when due_at is null then 'on_time'
    when now() > due_at then 'overdue'
    when now() > due_at - interval '2 hours' then 'at_risk'
    else 'on_time'
  end;
$$;

create or replace function public.set_support_ticket_sla_fields()
returns trigger
language plpgsql
as $$
declare
  target_category text;
begin
  target_category := coalesce(new.category, 'general');
  new.category := target_category;
  new.sla_policy_key := target_category;

  if new.first_response_due_at is null then
    new.first_response_due_at := coalesce(new.created_at, now()) + make_interval(hours => public.support_sla_hours(target_category));
  end if;

  new.sla_status := public.compute_support_sla_status(new.first_response_due_at, new.first_response_at);

  return new;
end;
$$;

drop trigger if exists support_tickets_sla_fields on public.support_tickets;
create trigger support_tickets_sla_fields
before insert or update of category, first_response_due_at, first_response_at, status
on public.support_tickets
for each row execute function public.set_support_ticket_sla_fields();

create or replace function public.set_support_first_admin_response()
returns trigger
language plpgsql
as $$
begin
  if new.sender_role = 'admin' then
    update public.support_tickets
    set first_response_at = coalesce(first_response_at, new.created_at),
        status = case when status = 'closed' then status else 'answered' end,
        updated_at = now()
    where id = new.ticket_id;
  end if;

  return new;
end;
$$;

drop trigger if exists support_ticket_messages_first_admin_response on public.support_ticket_messages;
create trigger support_ticket_messages_first_admin_response
after insert on public.support_ticket_messages
for each row execute function public.set_support_first_admin_response();

update public.support_tickets
set category = coalesce(category, 'general'),
    first_response_due_at = coalesce(first_response_due_at, created_at + make_interval(hours => public.support_sla_hours(coalesce(category, 'general')))),
    sla_policy_key = coalesce(sla_policy_key, coalesce(category, 'general')),
    sla_status = public.compute_support_sla_status(
      coalesce(first_response_due_at, created_at + make_interval(hours => public.support_sla_hours(coalesce(category, 'general')))),
      first_response_at
    );

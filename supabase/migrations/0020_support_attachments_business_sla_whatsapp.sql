-- 0020_support_attachments_business_sla_whatsapp.sql
-- Complete support ticket operations: private attachments, exact business-hour SLA and WhatsApp-ready config.

alter table public.support_tickets
  add column if not exists attachment_bucket text null,
  add column if not exists attachment_path text null,
  add column if not exists attachment_name text null,
  add column if not exists attachment_mime_type text null,
  add column if not exists attachment_size_bytes integer null;

alter table public.support_ticket_messages
  add column if not exists attachment_bucket text null,
  add column if not exists attachment_path text null,
  add column if not exists attachment_name text null,
  add column if not exists attachment_mime_type text null,
  add column if not exists attachment_size_bytes integer null;

alter table public.support_tickets
  drop constraint if exists support_tickets_attachment_size_check;
alter table public.support_tickets
  add constraint support_tickets_attachment_size_check
  check (attachment_size_bytes is null or attachment_size_bytes between 1 and 10485760);

alter table public.support_ticket_messages
  drop constraint if exists support_ticket_messages_attachment_size_check;
alter table public.support_ticket_messages
  add constraint support_ticket_messages_attachment_size_check
  check (attachment_size_bytes is null or attachment_size_bytes between 1 and 10485760);

insert into public.site_config (config_key, config_value, description, is_public)
values
  (
    'support_sla_config',
    '{
      "categories": [
        { "key": "payment", "label": "Pagamentos", "first_response_hours": 2, "position": 1, "description": "Primeira resposta em ate 2 horas uteis." },
        { "key": "technical", "label": "Problema tecnico", "first_response_hours": 24, "position": 2, "description": "Primeira resposta em ate 24 horas uteis." },
        { "key": "account", "label": "Conta e acesso", "first_response_hours": 24, "position": 3, "description": "Primeira resposta em ate 24 horas uteis." },
        { "key": "general", "label": "Duvida geral", "first_response_hours": 24, "position": 4, "description": "Primeira resposta em ate 24 horas uteis." }
      ],
      "public_note": "Os prazos acima se referem ao tempo da primeira resposta humana da equipe. Nao representam prazo de resolucao final."
    }'::jsonb,
    'Configuracao publica do SLA de primeira resposta do suporte.',
    true
  ),
  (
    'support_business_hours_config',
    '{
      "timezone": "Europe/Lisbon",
      "days_of_week": [1, 2, 3, 4, 5],
      "start_hour": 8,
      "end_hour": 18
    }'::jsonb,
    'Horario util usado para calcular SLA de primeira resposta do suporte.',
    true
  ),
  (
    'support_whatsapp_config',
    '{
      "enabled": false,
      "provider": "whatsapp_cloud_api",
      "status": "not_configured",
      "admin_phone_e164": null,
      "phone_number_id_secret": "WHATSAPP_PHONE_NUMBER_ID",
      "access_token_secret": "WHATSAPP_ACCESS_TOKEN",
      "template_new_ticket": null,
      "template_new_message": null,
      "template_ticket_closed": null
    }'::jsonb,
    'Configuracao operacional para ativacao futura de WhatsApp no suporte. Segredos devem ficar nas Edge Function Secrets.',
    false
  )
on conflict (config_key) do nothing;

create or replace function public.get_support_business_hours_config()
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select config_value
      from public.site_config
      where config_key = 'support_business_hours_config'
      limit 1
    ),
    '{
      "timezone": "Europe/Lisbon",
      "days_of_week": [1, 2, 3, 4, 5],
      "start_hour": 8,
      "end_hour": 18
    }'::jsonb
  );
$$;

create or replace function public.get_support_sla_config()
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select config_value
      from public.site_config
      where config_key = 'support_sla_config'
      limit 1
    ),
    '{
      "categories": [
        { "key": "payment", "first_response_hours": 2 },
        { "key": "technical", "first_response_hours": 24 },
        { "key": "account", "first_response_hours": 24 },
        { "key": "general", "first_response_hours": 24 }
      ]
    }'::jsonb
  );
$$;

create or replace function public.support_sla_hours(ticket_category text)
returns integer
language sql
stable
as $$
  select coalesce(
    (
      select nullif(category->>'first_response_hours', '')::integer
      from jsonb_array_elements(public.get_support_sla_config()->'categories') as category
      where category->>'key' = coalesce(ticket_category, 'general')
      limit 1
    ),
    case coalesce(ticket_category, 'general')
      when 'payment' then 2
      else 24
    end
  );
$$;

create or replace function public.is_support_business_minute(moment_at timestamptz)
returns boolean
language plpgsql
stable
as $$
declare
  config jsonb := public.get_support_business_hours_config();
  timezone_name text := coalesce(config->>'timezone', 'Europe/Lisbon');
  local_moment timestamp;
  local_dow integer;
  local_hour numeric;
  start_hour numeric := coalesce(nullif(config->>'start_hour', '')::numeric, 8);
  end_hour numeric := coalesce(nullif(config->>'end_hour', '')::numeric, 18);
begin
  local_moment := moment_at at time zone timezone_name;
  local_dow := extract(isodow from local_moment)::integer;
  local_hour := extract(hour from local_moment) + (extract(minute from local_moment) / 60.0);

  return exists (
    select 1
    from jsonb_array_elements_text(coalesce(config->'days_of_week', '[1,2,3,4,5]'::jsonb)) as day_value(value)
    where value::integer = local_dow
  )
  and local_hour >= start_hour
  and local_hour < end_hour;
end;
$$;

create or replace function public.align_support_business_start(moment_at timestamptz)
returns timestamptz
language plpgsql
stable
as $$
declare
  cursor_at timestamptz := date_trunc('minute', moment_at);
  guard integer := 0;
begin
  while not public.is_support_business_minute(cursor_at) and guard < 20160 loop
    cursor_at := cursor_at + interval '1 minute';
    guard := guard + 1;
  end loop;

  return cursor_at;
end;
$$;

create or replace function public.add_support_business_minutes(start_at timestamptz, minutes_to_add integer)
returns timestamptz
language plpgsql
stable
as $$
declare
  cursor_at timestamptz := public.align_support_business_start(start_at);
  remaining integer := greatest(coalesce(minutes_to_add, 0), 0);
  guard integer := 0;
begin
  while remaining > 0 and guard < 100000 loop
    if public.is_support_business_minute(cursor_at) then
      remaining := remaining - 1;
    end if;

    cursor_at := cursor_at + interval '1 minute';
    guard := guard + 1;

    if remaining > 0 and not public.is_support_business_minute(cursor_at) then
      cursor_at := public.align_support_business_start(cursor_at);
    end if;
  end loop;

  return cursor_at;
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

  if tg_op = 'INSERT' then
    new.first_response_due_at := public.add_support_business_minutes(
      coalesce(new.created_at, now()),
      public.support_sla_hours(target_category) * 60
    );
  elsif new.first_response_due_at is null or new.category is distinct from old.category then
    new.first_response_due_at := public.add_support_business_minutes(
      coalesce(new.created_at, now()),
      public.support_sla_hours(target_category) * 60
    );
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

update public.support_tickets
set first_response_due_at = public.add_support_business_minutes(created_at, public.support_sla_hours(coalesce(category, 'general')) * 60),
    sla_policy_key = coalesce(category, 'general'),
    sla_status = public.compute_support_sla_status(
      public.add_support_business_minutes(created_at, public.support_sla_hours(coalesce(category, 'general')) * 60),
      first_response_at
    )
where first_response_at is null;

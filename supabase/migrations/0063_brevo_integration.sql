-- Brevo is the platform email transport and the explicit checkout opt-in sink.
-- Secrets remain in private storage and are only read through service-role RPCs.

create schema if not exists private;

create table if not exists private.brevo_credentials (
  singleton_key boolean primary key default true check (singleton_key),
  api_key_ciphertext text not null,
  configured_by uuid null references public.profiles(id) on delete set null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on private.brevo_credentials from public, anon, authenticated;

create table if not exists public.brevo_integration_settings (
  singleton_key boolean primary key default true check (singleton_key),
  enabled boolean not null default false,
  sender_name text null,
  sender_email text null,
  reply_to text null,
  lead_list_id bigint null,
  consent_group_id bigint null,
  attribute_mapping jsonb not null default '{"first_name":"FIRSTNAME","last_name":"LASTNAME","full_name":"FULLNAME","nif":"NIF","user_id":"MARIANA_USER_ID","lead_source":"LEAD_SOURCE","opt_in":"OPT_IN","opt_in_at":"OPT_IN_AT","product":"PRODUCT","order_id":"ORDER_ID","payment_environment":"PAYMENT_ENVIRONMENT"}'::jsonb,
  last_account jsonb null,
  last_connection_check_at timestamptz null,
  last_connection_error text null,
  configured_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_email is null or sender_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  check (reply_to is null or reply_to ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

alter table public.profiles
  add column if not exists content_updates_consent_at timestamptz null,
  add column if not exists content_updates_consent_source text null,
  add column if not exists content_updates_consent_evidence jsonb not null default '{}'::jsonb;

insert into public.brevo_integration_settings (singleton_key)
values (true)
on conflict (singleton_key) do nothing;

create table if not exists public.brevo_contact_syncs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  email text not null,
  brevo_contact_id bigint null,
  list_id bigint null,
  consent_group_id bigint null,
  consent_granted boolean not null default true check (consent_granted),
  consent_at timestamptz not null,
  consent_source text not null,
  consent_evidence jsonb not null default '{}'::jsonb,
  source_product_id uuid null references public.products(id) on delete set null,
  source_order_id uuid null references public.orders(id) on delete set null,
  attributes jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'synced', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_synced_at timestamptz null,
  last_error text null,
  remote_snapshot jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);
create index if not exists brevo_contact_syncs_status_idx
  on public.brevo_contact_syncs (status, next_attempt_at);
create index if not exists brevo_contact_syncs_email_idx
  on public.brevo_contact_syncs (lower(email));
create index if not exists brevo_contact_syncs_created_at_idx
  on public.brevo_contact_syncs (created_at desc);

create table if not exists public.brevo_email_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  message_id text null,
  email text null,
  subject text null,
  event text not null,
  reason text null,
  event_at timestamptz null,
  source text not null default 'api_reconciliation',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists brevo_email_events_message_id_idx on public.brevo_email_events (message_id);
create index if not exists brevo_email_events_event_at_idx on public.brevo_email_events (event_at desc);
create index if not exists brevo_email_events_event_idx on public.brevo_email_events (event);

alter table public.email_deliveries
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_event_at timestamptz null,
  add column if not exists last_event text null,
  add column if not exists origin text null;
create index if not exists email_deliveries_provider_message_idx
  on public.email_deliveries (provider_message_id);
create index if not exists email_deliveries_created_at_desc_idx
  on public.email_deliveries (created_at desc);

create or replace function public.get_brevo_credentials()
returns table (api_key_ciphertext text, configured_at timestamptz)
language sql security definer
set search_path = private, public, pg_temp
as $$
  select c.api_key_ciphertext, c.configured_at
  from private.brevo_credentials c
  where c.singleton_key = true;
$$;

create or replace function public.store_brevo_credentials(
  p_api_key_ciphertext text,
  p_actor_user_id uuid
)
returns void
language plpgsql security definer
set search_path = private, public, pg_temp
as $$
begin
  if nullif(trim(p_api_key_ciphertext), '') is null then
    raise exception 'API key Brevo não informada';
  end if;
  insert into private.brevo_credentials (singleton_key, api_key_ciphertext, configured_by)
  values (true, trim(p_api_key_ciphertext), p_actor_user_id)
  on conflict (singleton_key) do update set
    api_key_ciphertext = excluded.api_key_ciphertext,
    configured_by = excluded.configured_by,
    configured_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.get_brevo_credentials() from public, anon, authenticated;
revoke all on function public.store_brevo_credentials(text, uuid) from public, anon, authenticated;
grant execute on function public.get_brevo_credentials() to service_role;
grant execute on function public.store_brevo_credentials(text, uuid) to service_role;

create or replace function public.set_brevo_integration_updated_at()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists brevo_settings_updated_at on public.brevo_integration_settings;
create trigger brevo_settings_updated_at before update on public.brevo_integration_settings
for each row execute function public.set_brevo_integration_updated_at();
drop trigger if exists brevo_contact_syncs_updated_at on public.brevo_contact_syncs;
create trigger brevo_contact_syncs_updated_at before update on public.brevo_contact_syncs
for each row execute function public.set_brevo_integration_updated_at();

alter table public.brevo_integration_settings enable row level security;
alter table public.brevo_contact_syncs enable row level security;
alter table public.brevo_email_events enable row level security;
drop policy if exists brevo_settings_admin_select on public.brevo_integration_settings;
create policy brevo_settings_admin_select on public.brevo_integration_settings for select using (public.is_admin());
drop policy if exists brevo_contacts_admin_select on public.brevo_contact_syncs;
create policy brevo_contacts_admin_select on public.brevo_contact_syncs for select using (public.is_admin());
drop policy if exists brevo_events_admin_select on public.brevo_email_events;
create policy brevo_events_admin_select on public.brevo_email_events for select using (public.is_admin());

comment on table private.brevo_credentials is 'Brevo API key encrypted with BREVO_TOKEN_ENCRYPTION_KEY and never exposed through the client.';
comment on table public.brevo_contact_syncs is 'Idempotent explicit checkout opt-in synchronization queue.';
comment on table public.brevo_email_events is 'Sanitized official Brevo transactional event history.';

do $$
declare v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'mariana-cron-process-brevo-contact-syncs' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'mariana-cron-process-brevo-contact-syncs',
    '*/10 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-process-brevo-contact-syncs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"batchSize":20,"source":"pg_cron"}'::jsonb
      );
    $command$
  );
exception when undefined_table or undefined_function then
  raise notice 'Cron extension not available while applying Brevo migration';
end;
$$;

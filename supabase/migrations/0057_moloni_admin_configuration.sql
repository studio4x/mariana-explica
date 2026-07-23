-- Complete administrative control plane for the Stripe + Moloni integration.
-- Fiscal emission remains disabled until the backend activation gate succeeds.

create table if not exists private.moloni_app_credentials (
  singleton_key boolean primary key default true check (singleton_key),
  client_id_ciphertext text not null,
  client_secret_ciphertext text not null,
  callback_uri text not null check (callback_uri ~ '^https://'),
  configured_by uuid null references public.profiles(id) on delete set null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on private.moloni_app_credentials from public, anon, authenticated;

create table if not exists public.moloni_fiscal_checklist_items (
  id uuid primary key default gen_random_uuid(),
  payment_environment text not null
    references public.moloni_fiscal_settings(payment_environment) on delete cascade,
  item_key text not null,
  title text not null,
  description text not null,
  is_blocking boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'filled', 'approved')),
  configuration jsonb null,
  notes text null,
  approved_by uuid null references public.profiles(id) on delete set null,
  approved_at timestamptz null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_environment, item_key),
  check (
    (status = 'approved' and approved_by is not null and approved_at is not null)
    or
    (status <> 'approved' and approved_by is null and approved_at is null)
  ),
  check (
    status = 'pending'
    or configuration is not null
    or nullif(trim(notes), '') is not null
  )
);
create index if not exists moloni_fiscal_checklist_status_idx
  on public.moloni_fiscal_checklist_items (payment_environment, status, is_blocking);

with checklist(item_key, title, description) as (
  values
    ('immediate_payment_document', 'Documento para pagamento imediato', 'Definir fatura-recibo ou fatura seguida de recibo.'),
    ('buyer_without_vat', 'Comprador sem NIF', 'Definir a regra fiscal aplicável quando o comprador não indicar NIF.'),
    ('individual_required_data', 'Dados de pessoa singular', 'Definir os dados obrigatórios para compradores particulares.'),
    ('company_required_data', 'Dados de empresa', 'Definir os dados obrigatórios para compradores empresariais.'),
    ('production_document_set', 'Série de produção', 'Confirmar a série documental que será usada em produção.'),
    ('homologation_strategy', 'Estratégia de homologação', 'Definir empresa, série e regra de rascunho para testes seguros.'),
    ('eac', 'CAE aplicável', 'Confirmar o CAE aplicável ou registar que não se aplica.'),
    ('moloni_products', 'Artigos Moloni', 'Confirmar os artigos correspondentes aos produtos digitais.'),
    ('portugal_vat', 'IVA em Portugal', 'Definir a taxa e a regra de IVA para vendas em Portugal.'),
    ('international_sales', 'Vendas internacionais', 'Definir o tratamento fiscal de compradores de outros países.'),
    ('eu_b2b_b2c_oss', 'B2B/B2C intracomunitário e OSS', 'Definir as regras intracomunitárias e eventual utilização de OSS.'),
    ('exemptions', 'Isenções', 'Definir os motivos legais de isenção ou registar que não se aplicam.'),
    ('full_refund', 'Reembolso total', 'Definir o documento retificativo exigido num reembolso total.'),
    ('partial_refund', 'Reembolso parcial', 'Definir o documento retificativo exigido num reembolso parcial.'),
    ('chargeback', 'Chargeback e disputa', 'Definir o tratamento contabilístico de disputas e perdas definitivas.'),
    ('automatic_closing', 'Fechamento automático', 'Definir se o documento deve ser fechado ou permanecer em rascunho.'),
    ('tax_authority_communication', 'Comunicação à Autoridade Tributária', 'Confirmar a configuração de comunicação fiscal na conta Moloni.'),
    ('customer_pdf_delivery', 'Envio do PDF ao cliente', 'Definir a política de disponibilização do documento fiscal.')
),
environments(payment_environment) as (
  values ('test'::text), ('live'::text)
)
insert into public.moloni_fiscal_checklist_items (
  payment_environment,
  item_key,
  title,
  description
)
select environments.payment_environment, checklist.item_key, checklist.title, checklist.description
from environments
cross join checklist
on conflict (payment_environment, item_key) do update set
  title = excluded.title,
  description = excluded.description;

create table if not exists public.moloni_validation_runs (
  id uuid primary key default gen_random_uuid(),
  payment_environment text not null
    references public.moloni_fiscal_settings(payment_environment) on delete cascade,
  validation_type text not null check (validation_type in (
    'credentials',
    'oauth',
    'company',
    'document_sets',
    'products',
    'taxes',
    'payment_method',
    'mappings',
    'draft_document'
  )),
  status text not null check (status in ('passed', 'failed')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists moloni_validation_runs_latest_idx
  on public.moloni_validation_runs (payment_environment, validation_type, created_at desc);

create table if not exists public.moloni_activation_events (
  id uuid primary key default gen_random_uuid(),
  payment_environment text not null
    references public.moloni_fiscal_settings(payment_environment) on delete restrict,
  action text not null check (action in ('enabled', 'disabled')),
  configuration_snapshot jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists moloni_activation_events_environment_idx
  on public.moloni_activation_events (payment_environment, created_at desc);

create or replace function public.prevent_moloni_activation_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'O histórico de ativação Moloni é imutável';
end;
$$;

create trigger moloni_activation_events_immutable
before update or delete on public.moloni_activation_events
for each row execute function public.prevent_moloni_activation_event_mutation();

alter table public.moloni_fiscal_settings
  add column if not exists activated_by uuid null references public.profiles(id) on delete set null,
  add column if not exists activated_at timestamptz null,
  add column if not exists deactivated_by uuid null references public.profiles(id) on delete set null,
  add column if not exists deactivated_at timestamptz null;

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  where con.conrelid = 'public.moloni_fiscal_settings'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%moloni_environment <> ''live''%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.moloni_fiscal_settings drop constraint %I',
      constraint_name
    );
  end if;
end;
$$;

alter table public.moloni_fiscal_settings
  drop constraint if exists moloni_fiscal_settings_live_environment_check;
alter table public.moloni_fiscal_settings
  add constraint moloni_fiscal_settings_live_environment_check
  check (
    moloni_environment <> 'live'
    or (
      payment_environment = 'live'
      and document_status = 1
    )
  );

alter table public.moloni_product_mappings
  add column if not exists moloni_product_name text null,
  add column if not exists moloni_document_set_name text null,
  add column if not exists moloni_tax_name text null,
  add column if not exists moloni_payment_method_name text null;

alter table public.moloni_document_jobs
  add column if not exists last_admin_action text null
    check (last_admin_action is null or last_admin_action in ('retry', 'unblock', 'reconcile', 'cancel')),
  add column if not exists last_admin_action_by uuid null references public.profiles(id) on delete set null,
  add column if not exists last_admin_action_at timestamptz null,
  add column if not exists cancelled_at timestamptz null;

create or replace function public.get_moloni_app_credentials()
returns table (
  client_id_ciphertext text,
  client_secret_ciphertext text,
  callback_uri text,
  configured_at timestamptz
)
language sql
security definer
set search_path = private, public, pg_temp
as $$
  select
    credentials.client_id_ciphertext,
    credentials.client_secret_ciphertext,
    credentials.callback_uri,
    credentials.configured_at
  from private.moloni_app_credentials credentials
  where credentials.singleton_key = true;
$$;

create or replace function public.store_moloni_app_credentials(
  p_client_id_ciphertext text,
  p_client_secret_ciphertext text,
  p_callback_uri text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  v_existing private.moloni_app_credentials%rowtype;
begin
  if p_callback_uri is null or p_callback_uri !~ '^https://' then
    raise exception 'Callback Moloni inválido';
  end if;

  select * into v_existing
  from private.moloni_app_credentials
  where singleton_key = true
  for update;

  if not found and (
    nullif(trim(p_client_id_ciphertext), '') is null
    or nullif(trim(p_client_secret_ciphertext), '') is null
  ) then
    raise exception 'Client ID e Client Secret são obrigatórios na primeira configuração';
  end if;

  insert into private.moloni_app_credentials (
    singleton_key,
    client_id_ciphertext,
    client_secret_ciphertext,
    callback_uri,
    configured_by,
    configured_at,
    updated_at
  )
  values (
    true,
    coalesce(nullif(trim(p_client_id_ciphertext), ''), v_existing.client_id_ciphertext),
    coalesce(nullif(trim(p_client_secret_ciphertext), ''), v_existing.client_secret_ciphertext),
    p_callback_uri,
    p_actor_user_id,
    now(),
    now()
  )
  on conflict (singleton_key) do update set
    client_id_ciphertext = coalesce(
      nullif(trim(excluded.client_id_ciphertext), ''),
      private.moloni_app_credentials.client_id_ciphertext
    ),
    client_secret_ciphertext = coalesce(
      nullif(trim(excluded.client_secret_ciphertext), ''),
      private.moloni_app_credentials.client_secret_ciphertext
    ),
    callback_uri = excluded.callback_uri,
    configured_by = excluded.configured_by,
    configured_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.refresh_moloni_checklist_approval(p_payment_environment text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approved boolean;
begin
  select
    count(*) > 0
    and count(*) filter (where is_blocking and status <> 'approved') = 0
  into v_approved
  from public.moloni_fiscal_checklist_items
  where payment_environment = p_payment_environment
    and is_blocking;

  update public.moloni_fiscal_settings
  set
    fiscal_checklist_approved = coalesce(v_approved, false),
    emission_enabled = case
      when coalesce(v_approved, false) then emission_enabled
      else false
    end,
    deactivated_at = case
      when not coalesce(v_approved, false) and emission_enabled then now()
      else deactivated_at
    end
  where payment_environment = p_payment_environment;

  return coalesce(v_approved, false);
end;
$$;

create or replace function public.sync_moloni_checklist_approval_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_moloni_checklist_approval(old.payment_environment);
    return old;
  end if;

  perform public.refresh_moloni_checklist_approval(new.payment_environment);
  return new;
end;
$$;

drop trigger if exists moloni_checklist_sync_approval
  on public.moloni_fiscal_checklist_items;
create trigger moloni_checklist_sync_approval
after insert or update or delete on public.moloni_fiscal_checklist_items
for each row execute function public.sync_moloni_checklist_approval_trigger();

create or replace function public.admin_transition_moloni_job(
  p_fiscal_document_id uuid,
  p_action text,
  p_actor_user_id uuid
)
returns table (
  job_id uuid,
  job_status text,
  document_status text,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.fiscal_documents%rowtype;
  v_job public.moloni_document_jobs%rowtype;
  v_previous_status text;
begin
  if p_action not in ('retry', 'unblock', 'reconcile', 'cancel') then
    raise exception 'Ação fiscal inválida';
  end if;

  select * into v_document
  from public.fiscal_documents
  where id = p_fiscal_document_id
  for update;

  if not found then
    raise exception 'Documento fiscal não encontrado';
  end if;

  if v_document.status in ('issued', 'credited') or v_document.moloni_document_id is not null then
    raise exception 'Documento já emitido; a operação foi bloqueada';
  end if;

  select * into v_job
  from public.moloni_document_jobs
  where fiscal_document_id = p_fiscal_document_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Tarefa fiscal não encontrada';
  end if;

  v_previous_status := v_job.status;

  if p_action = 'cancel' then
    if v_job.status not in ('pending', 'retry', 'blocked', 'failed', 'cancelled') then
      raise exception 'A tarefa em processamento ou concluída não pode ser cancelada';
    end if;
    update public.moloni_document_jobs
    set
      status = 'cancelled',
      locked_at = null,
      locked_by = null,
      cancelled_at = coalesce(cancelled_at, now()),
      last_admin_action = 'cancel',
      last_admin_action_by = p_actor_user_id,
      last_admin_action_at = now()
    where id = v_job.id;

    update public.fiscal_documents
    set
      status = 'cancelled_before_issue',
      last_error_code = 'ADMIN_CANCELLED',
      last_error_message = 'Emissão cancelada de forma segura por uma administradora.'
    where id = v_document.id;
  else
    if v_job.status in ('processing', 'completed', 'cancelled') then
      raise exception 'A tarefa não pode ser alterada no estado atual';
    end if;
    update public.moloni_document_jobs
    set
      job_type = case when p_action = 'reconcile' then 'reconcile_document' else job_type end,
      status = 'retry',
      available_at = now(),
      locked_at = null,
      locked_by = null,
      last_error_code = null,
      last_error = null,
      last_admin_action = p_action,
      last_admin_action_by = p_actor_user_id,
      last_admin_action_at = now()
    where id = v_job.id;

    update public.fiscal_documents
    set
      status = 'pending',
      last_error_code = null,
      last_error_message = null
    where id = v_document.id;
  end if;

  return query
  select
    jobs.id,
    jobs.status,
    documents.status,
    v_previous_status is distinct from jobs.status
  from public.moloni_document_jobs jobs
  join public.fiscal_documents documents on documents.id = jobs.fiscal_document_id
  where jobs.id = v_job.id;
end;
$$;

create or replace function public.activate_moloni_live(
  p_actor_user_id uuid
)
returns table (
  activation_event_id uuid,
  activated_at timestamptz,
  changed boolean
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_settings public.moloni_fiscal_settings%rowtype;
  v_connection public.moloni_connections%rowtype;
  v_validation public.moloni_validation_runs%rowtype;
  v_validation_type text;
  v_event_id uuid;
  v_activated_at timestamptz;
  v_required_count integer;
  v_approved_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('moloni-live-activation'));

  select *
  into v_settings
  from public.moloni_fiscal_settings
  where payment_environment = 'live'
  for update;

  if not found then
    raise exception 'Configuração Moloni live não encontrada';
  end if;

  if v_settings.emission_enabled then
    return query select null::uuid, v_settings.activated_at, false;
    return;
  end if;

  if not exists (
    select 1
    from private.moloni_app_credentials
    where singleton_key = true
      and nullif(trim(client_id_ciphertext), '') is not null
      and nullif(trim(client_secret_ciphertext), '') is not null
  ) then
    raise exception 'Credenciais Moloni não configuradas';
  end if;

  select *
  into v_connection
  from public.moloni_connections
  where environment = 'live'
  for update;

  if not found
    or v_connection.status <> 'connected'
    or not (
      coalesce(v_connection.token_expires_at > now(), false)
      or v_connection.refresh_token_expires_at is null
      or v_connection.refresh_token_expires_at > now()
    )
  then
    raise exception 'Ligação OAuth Moloni live inválida';
  end if;

  if v_settings.moloni_environment <> 'live'
    or v_settings.document_status <> 1
    or v_settings.document_kind is null
    or v_settings.moloni_company_id is null
  then
    raise exception 'Configuração fiscal Moloni live incompleta';
  end if;

  select
    count(*)::integer,
    count(*) filter (where status = 'approved')::integer
  into v_required_count, v_approved_count
  from public.moloni_fiscal_checklist_items
  where payment_environment = 'live'
    and is_blocking;

  if v_required_count = 0 or v_required_count <> v_approved_count then
    raise exception 'Checklist fiscal Moloni incompleto';
  end if;

  foreach v_validation_type in array array[
    'company',
    'document_sets',
    'products',
    'taxes',
    'payment_method',
    'mappings'
  ]
  loop
    select *
    into v_validation
    from public.moloni_validation_runs
    where payment_environment = 'live'
      and validation_type = v_validation_type
    order by created_at desc
    limit 1;

    if not found
      or v_validation.status <> 'passed'
      or nullif(v_validation.details ->> 'company_id', '')::integer
        is distinct from v_settings.moloni_company_id
    then
      raise exception 'Validação Moloni live ausente ou desatualizada: %', v_validation_type;
    end if;
  end loop;

  select *
  into v_validation
  from public.moloni_validation_runs
  where payment_environment = 'test'
    and validation_type = 'draft_document'
  order by created_at desc
  limit 1;

  if not found or v_validation.status <> 'passed' then
    raise exception 'Homologação em rascunho ainda não concluída';
  end if;

  if exists (
    select 1
    from public.products products
    where products.status = 'published'
      and products.product_type in ('paid', 'hybrid')
      and not exists (
        select 1
        from public.moloni_product_mappings mappings
        where mappings.product_id = products.id
          and mappings.payment_environment = 'live'
          and mappings.is_active
      )
  ) then
    raise exception 'Existem produtos pagos sem mapeamento fiscal live';
  end if;

  if exists (
    select 1
    from public.fiscal_documents
    where source_payment_environment = 'live'
      and last_error_code in ('MOLONI_TOTAL_MISMATCH', 'ORDER_ITEM_TOTAL_MISMATCH')
  ) then
    raise exception 'Existem divergências monetárias por resolver';
  end if;

  v_activated_at := now();
  update public.moloni_fiscal_settings
  set
    emission_enabled = true,
    activated_by = p_actor_user_id,
    activated_at = v_activated_at,
    deactivated_by = null,
    deactivated_at = null,
    updated_by = p_actor_user_id
  where payment_environment = 'live';

  insert into public.moloni_activation_events (
    payment_environment,
    action,
    configuration_snapshot,
    actor_user_id
  )
  values (
    'live',
    'enabled',
    jsonb_build_object(
      'moloni_environment', v_settings.moloni_environment,
      'company_id', v_settings.moloni_company_id,
      'document_kind', v_settings.document_kind,
      'document_status', v_settings.document_status,
      'mapping_count', (
        select count(*)
        from public.moloni_product_mappings
        where payment_environment = 'live' and is_active
      ),
      'checklist_approved', true,
      'historical_reprocessing', false
    ),
    p_actor_user_id
  )
  returning id into v_event_id;

  return query select v_event_id, v_activated_at, true;
end;
$$;

create or replace function public.deactivate_moloni_emission(
  p_payment_environment text,
  p_actor_user_id uuid
)
returns table (
  activation_event_id uuid,
  deactivated_at timestamptz,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.moloni_fiscal_settings%rowtype;
  v_event_id uuid;
  v_deactivated_at timestamptz;
begin
  if p_payment_environment not in ('test', 'live') then
    raise exception 'Ambiente de pagamento inválido';
  end if;

  perform pg_advisory_xact_lock(hashtext('moloni-emission-' || p_payment_environment));

  select *
  into v_settings
  from public.moloni_fiscal_settings
  where payment_environment = p_payment_environment
  for update;

  if not found then
    raise exception 'Configuração fiscal Moloni não encontrada';
  end if;

  if not v_settings.emission_enabled then
    return query select null::uuid, v_settings.deactivated_at, false;
    return;
  end if;

  v_deactivated_at := now();
  update public.moloni_fiscal_settings
  set
    emission_enabled = false,
    deactivated_by = p_actor_user_id,
    deactivated_at = v_deactivated_at,
    updated_by = p_actor_user_id
  where payment_environment = p_payment_environment;

  insert into public.moloni_activation_events (
    payment_environment,
    action,
    configuration_snapshot,
    actor_user_id
  )
  values (
    p_payment_environment,
    'disabled',
    jsonb_build_object(
      'moloni_environment', v_settings.moloni_environment,
      'company_id', v_settings.moloni_company_id,
      'document_kind', v_settings.document_kind,
      'document_status', v_settings.document_status,
      'documents_preserved', true,
      'jobs_preserved', true,
      'stripe_and_grants_unchanged', true
    ),
    p_actor_user_id
  )
  returning id into v_event_id;

  return query select v_event_id, v_deactivated_at, true;
end;
$$;

revoke all on function public.get_moloni_app_credentials() from public, anon, authenticated;
revoke all on function public.store_moloni_app_credentials(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.refresh_moloni_checklist_approval(text) from public, anon, authenticated;
revoke all on function public.admin_transition_moloni_job(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.activate_moloni_live(uuid) from public, anon, authenticated;
revoke all on function public.prevent_moloni_activation_event_mutation() from public, anon, authenticated;
revoke all on function public.deactivate_moloni_emission(text, uuid) from public, anon, authenticated;
grant execute on function public.get_moloni_app_credentials() to service_role;
grant execute on function public.store_moloni_app_credentials(text, text, text, uuid) to service_role;
grant execute on function public.refresh_moloni_checklist_approval(text) to service_role;
grant execute on function public.admin_transition_moloni_job(uuid, text, uuid) to service_role;
grant execute on function public.activate_moloni_live(uuid) to service_role;
grant execute on function public.deactivate_moloni_emission(text, uuid) to service_role;

alter table public.moloni_fiscal_checklist_items enable row level security;
alter table public.moloni_validation_runs enable row level security;
alter table public.moloni_activation_events enable row level security;

create policy moloni_checklist_select_admin
  on public.moloni_fiscal_checklist_items for select
  using (public.is_admin());
create policy moloni_validation_runs_select_admin
  on public.moloni_validation_runs for select
  using (public.is_admin());
create policy moloni_activation_events_select_admin
  on public.moloni_activation_events for select
  using (public.is_admin());

create trigger moloni_fiscal_checklist_items_updated_at
  before update on public.moloni_fiscal_checklist_items
  for each row execute function public.set_updated_at();

select public.refresh_moloni_checklist_approval('test');
select public.refresh_moloni_checklist_approval('live');

comment on table private.moloni_app_credentials is
  'Application credentials encrypted with the externally managed Moloni root key.';
comment on table public.moloni_fiscal_checklist_items is
  'Accountant-approved decisions that gate automatic fiscal emission.';
comment on table public.moloni_validation_runs is
  'Sanitized evidence from administrative Moloni diagnostics and draft homologation.';
comment on table public.moloni_activation_events is
  'Immutable activation/deactivation history; never triggers historical reprocessing.';

alter table public.moloni_oauth_states
  alter column redirect_path set default '/admin/integracoes/moloni';

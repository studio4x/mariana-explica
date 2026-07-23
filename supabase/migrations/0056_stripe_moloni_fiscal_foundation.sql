-- Stripe + Moloni fiscal foundation.
--
-- Design decisions:
-- 1. A trigger plans a fiscal outbox entry for every paid Stripe order, regardless
--    of whether payment came from the webhook, reconciliation or an authorised
--    operational correction.
-- 2. Until the accountant-approved checklist is complete, the planned document
--    remains `pending_decision`/`blocked_data`. This is an operational state, not
--    a fiscal document type, and prevents the platform from inventing tax rules.
-- 3. Moloni tokens live in a private schema as application-encrypted ciphertext.
--    Only service_role-only RPCs can read or mutate that ciphertext.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.order_billing_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  customer_type text not null default 'individual'
    check (customer_type in ('individual', 'company')),
  legal_name text null,
  email text null,
  vat_number text null,
  vat_country text null check (vat_country is null or vat_country ~ '^[A-Z]{2}$'),
  address_line1 text null,
  address_line2 text null,
  postal_code text null,
  city text null,
  state text null,
  country_code text null check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  stripe_customer_id text null,
  stripe_tax_id_type text null,
  source text not null default 'platform' check (source in ('platform', 'stripe', 'merged')),
  review_status text not null default 'incomplete'
    check (review_status in ('incomplete', 'complete', 'requires_review')),
  review_reason text null,
  snapshot_hash text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vat_number is null or vat_number ~ '^[A-Z0-9]{2,32}$'),
  check (email is null or length(email) <= 320)
);

create index if not exists order_billing_details_user_id_idx
  on public.order_billing_details (user_id);
create index if not exists order_billing_details_review_status_idx
  on public.order_billing_details (review_status);

create table if not exists public.moloni_fiscal_settings (
  payment_environment text primary key check (payment_environment in ('test', 'live')),
  moloni_environment text not null check (moloni_environment in ('draft', 'live')),
  emission_enabled boolean not null default false,
  fiscal_checklist_approved boolean not null default false,
  document_kind text null
    check (document_kind is null or document_kind in ('invoice', 'invoice_receipt')),
  refund_document_kind text null
    check (refund_document_kind is null or refund_document_kind in ('credit_note', 'payment_return')),
  document_status integer not null default 0 check (document_status in (0, 1)),
  moloni_company_id integer null check (moloni_company_id is null or moloni_company_id > 0),
  customer_email_fallback_enabled boolean not null default false,
  customer_without_vat_rule text null,
  customer_country_id integer null check (customer_country_id is null or customer_country_id > 0),
  customer_language_id integer null check (customer_language_id is null or customer_language_id > 0),
  customer_maturity_date_id integer null check (customer_maturity_date_id is null or customer_maturity_date_id > 0),
  customer_payment_method_id integer null check (customer_payment_method_id is null or customer_payment_method_id > 0),
  pdf_delivery_policy text not null default 'private_storage'
    check (pdf_delivery_policy in ('private_storage', 'backend_proxy')),
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_environment <> 'test' or moloni_environment = 'draft'),
  check (payment_environment <> 'test' or document_status = 0),
  check (
    emission_enabled = false
    or (
      fiscal_checklist_approved = true
      and document_kind is not null
      and moloni_company_id is not null
    )
  ),
  check (
    moloni_environment <> 'live'
    or (
      payment_environment = 'live'
      and fiscal_checklist_approved = true
      and document_status = 1
    )
  )
);

insert into public.moloni_fiscal_settings (
  payment_environment,
  moloni_environment,
  emission_enabled,
  fiscal_checklist_approved,
  document_status
)
values
  ('test', 'draft', false, false, 0),
  ('live', 'draft', false, false, 0)
on conflict (payment_environment) do nothing;

create table if not exists public.moloni_connections (
  id uuid primary key default gen_random_uuid(),
  environment text not null unique check (environment in ('draft', 'live')),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'refreshing', 'reconnect_required')),
  moloni_company_id integer null check (moloni_company_id is null or moloni_company_id > 0),
  company_name text null,
  token_expires_at timestamptz null,
  refresh_token_expires_at timestamptz null,
  last_success_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  connected_by uuid null references public.profiles(id) on delete set null,
  connected_at timestamptz null,
  disconnected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.moloni_connections (environment, status)
values ('draft', 'disconnected'), ('live', 'disconnected')
on conflict (environment) do nothing;

create table if not exists private.moloni_credentials (
  environment text primary key check (environment in ('draft', 'live')),
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  encryption_version integer not null default 1 check (encryption_version > 0),
  refresh_locked_at timestamptz null,
  refresh_locked_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on private.moloni_credentials from public, anon, authenticated;

create table if not exists private.admin_integration_rate_limits (
  actor_user_id uuid not null,
  action_key text not null,
  minute_bucket timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (actor_user_id, action_key, minute_bucket)
);
revoke all on private.admin_integration_rate_limits from public, anon, authenticated;

create table if not exists public.moloni_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  environment text not null check (environment in ('draft', 'live')),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  redirect_path text not null default '/admin/pagamentos',
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  check (redirect_path like '/admin/%')
);
create index if not exists moloni_oauth_states_expires_at_idx
  on public.moloni_oauth_states (expires_at);

create table if not exists public.moloni_product_mappings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  payment_environment text not null references public.moloni_fiscal_settings(payment_environment) on delete cascade,
  moloni_company_id integer not null check (moloni_company_id > 0),
  moloni_product_id integer not null check (moloni_product_id > 0),
  moloni_document_set_id integer not null check (moloni_document_set_id > 0),
  moloni_tax_id integer null check (moloni_tax_id is null or moloni_tax_id > 0),
  tax_value numeric(8,4) null check (tax_value is null or tax_value >= 0),
  exemption_reason text null,
  eac_id integer null check (eac_id is null or eac_id > 0),
  moloni_payment_method_id integer null check (moloni_payment_method_id is null or moloni_payment_method_id > 0),
  is_active boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, payment_environment),
  check (moloni_tax_id is not null or nullif(trim(exemption_reason), '') is not null)
);
create index if not exists moloni_product_mappings_active_idx
  on public.moloni_product_mappings (payment_environment, is_active);

create table if not exists public.moloni_customer_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  environment text not null check (environment in ('draft', 'live')),
  moloni_company_id integer not null check (moloni_company_id > 0),
  moloni_customer_id integer not null check (moloni_customer_id > 0),
  vat_number_snapshot text null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment, moloni_company_id, moloni_customer_id),
  unique (user_id, environment, moloni_company_id)
);
create unique index if not exists moloni_customer_links_vat_unique_idx
  on public.moloni_customer_links (environment, moloni_company_id, vat_number_snapshot)
  where vat_number_snapshot is not null;

create table if not exists public.moloni_customer_locks (
  lock_key text primary key,
  locked_until timestamptz not null,
  locked_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'moloni' check (provider = 'moloni'),
  document_kind text not null
    check (document_kind in (
      'pending_decision',
      'invoice',
      'invoice_receipt',
      'receipt',
      'credit_note',
      'payment_return'
    )),
  status text not null default 'pending'
    check (status in (
      'pending',
      'processing',
      'blocked_data',
      'issued',
      'failed_retryable',
      'failed_permanent',
      'credit_pending',
      'credited',
      'cancelled_before_issue',
      'requires_review'
    )),
  environment text not null check (environment in ('draft', 'live')),
  source_payment_environment text not null check (source_payment_environment in ('test', 'live')),
  moloni_company_id integer null,
  moloni_customer_id integer null,
  moloni_document_id integer null,
  moloni_document_set_id integer null,
  document_number text null,
  original_fiscal_document_id uuid null references public.fiscal_documents(id) on delete restrict,
  currency text not null,
  net_amount_cents integer not null check (net_amount_cents >= 0),
  tax_amount_cents integer not null check (tax_amount_cents >= 0),
  total_amount_cents integer not null check (total_amount_cents >= 0),
  payment_reference text null,
  your_reference text not null,
  payload_hash text not null,
  remote_status integer null,
  storage_bucket text null,
  storage_path text null,
  issued_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_amount_cents = net_amount_cents + tax_amount_cents),
  check (
    status not in ('issued', 'credited')
    or (
      moloni_document_id is not null
      and document_number is not null
      and issued_at is not null
    )
  ),
  check (
    document_kind not in ('credit_note', 'payment_return')
    or original_fiscal_document_id is not null
  ),
  check (
    source_payment_environment <> 'test'
    or environment = 'draft'
  ),
  check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  )
);
create unique index if not exists fiscal_documents_main_order_unique_idx
  on public.fiscal_documents (order_id, provider)
  where original_fiscal_document_id is null;
create unique index if not exists fiscal_documents_moloni_id_unique_idx
  on public.fiscal_documents (environment, moloni_company_id, moloni_document_id)
  where moloni_document_id is not null;
create unique index if not exists fiscal_documents_reference_unique_idx
  on public.fiscal_documents (environment, your_reference);
create index if not exists fiscal_documents_user_id_idx
  on public.fiscal_documents (user_id, created_at desc);
create index if not exists fiscal_documents_status_idx
  on public.fiscal_documents (status, created_at);

create table if not exists public.moloni_document_jobs (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  job_type text not null check (job_type in ('issue_document', 'reconcile_document')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'blocked', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 6 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz null,
  locked_by text null,
  result_uncertain boolean not null default false,
  last_http_status integer null,
  last_error_code text null,
  last_error text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists moloni_document_jobs_claim_idx
  on public.moloni_document_jobs (status, available_at, created_at)
  where status in ('pending', 'retry', 'processing');
create unique index if not exists moloni_document_jobs_active_document_idx
  on public.moloni_document_jobs (fiscal_document_id)
  where status in ('pending', 'processing', 'retry', 'blocked');

create table if not exists public.fiscal_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  original_fiscal_document_id uuid null references public.fiscal_documents(id) on delete restrict,
  stripe_event_id text null,
  stripe_refund_id text null,
  adjustment_type text not null check (adjustment_type in ('refund_partial', 'refund_full', 'chargeback')),
  status text not null default 'requires_review'
    check (status in ('requires_review', 'approved', 'processing', 'completed', 'rejected')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  approved_document_kind text null
    check (approved_document_kind is null or approved_document_kind in ('credit_note', 'payment_return')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists fiscal_adjustment_requests_stripe_event_unique_idx
  on public.fiscal_adjustment_requests (stripe_event_id);
create unique index if not exists fiscal_adjustment_requests_refund_unique_idx
  on public.fiscal_adjustment_requests (stripe_refund_id);
create unique index if not exists fiscal_adjustment_requests_terminal_order_unique_idx
  on public.fiscal_adjustment_requests (order_id, adjustment_type)
  where adjustment_type in ('refund_full', 'chargeback');
create index if not exists fiscal_adjustment_requests_review_idx
  on public.fiscal_adjustment_requests (status, created_at);

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  locked_at timestamptz not null default now(),
  completed_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stripe_processed_events_status_idx
  on public.stripe_processed_events (status, locked_at);

create or replace function public.ensure_order_fiscal_outbox(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.moloni_fiscal_settings%rowtype;
  v_document_id uuid;
  v_environment text;
  v_total integer;
  v_tax integer;
  v_net integer;
  v_kind text;
  v_status text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status <> 'paid' or coalesce(v_order.payment_provider, '') <> 'stripe' then
    return null;
  end if;

  select * into v_settings
  from public.moloni_fiscal_settings
  where payment_environment = coalesce(v_order.payment_environment, 'test');

  v_environment := case
    when coalesce(v_order.payment_environment, 'test') = 'test' then 'draft'
    else coalesce(v_settings.moloni_environment, 'draft')
  end;
  v_total := coalesce(v_order.total_paid_cents, v_order.final_price_cents, 0);
  v_tax := least(greatest(coalesce(v_order.tax_amount_cents, 0), 0), v_total);
  v_net := v_total - v_tax;
  v_kind := coalesce(v_settings.document_kind, 'pending_decision');
  v_status := case
    when v_order.total_paid_cents is null then 'blocked_data'
    when v_settings.payment_environment is null
      or v_settings.emission_enabled = false
      or v_settings.fiscal_checklist_approved = false
      or v_settings.document_kind is null
      or v_settings.moloni_company_id is null
      then 'blocked_data'
    else 'pending'
  end;

  insert into public.order_billing_details (order_id, user_id, source, review_status)
  values (v_order.id, v_order.user_id, 'stripe', 'incomplete')
  on conflict (order_id) do nothing;

  insert into public.fiscal_documents (
    order_id,
    user_id,
    document_kind,
    status,
    environment,
    source_payment_environment,
    moloni_company_id,
    currency,
    net_amount_cents,
    tax_amount_cents,
    total_amount_cents,
    payment_reference,
    your_reference,
    payload_hash,
    last_error_code,
    last_error_message
  )
  values (
    v_order.id,
    v_order.user_id,
    v_kind,
    v_status,
    v_environment,
    coalesce(v_order.payment_environment, 'test'),
    v_settings.moloni_company_id,
    upper(v_order.currency),
    v_net,
    v_tax,
    v_total,
    v_order.payment_reference,
    'mariana:' || v_order.id::text || ':sale:v1',
    encode(extensions.digest(
      concat_ws('|', v_order.id::text, v_total::text, v_tax::text, upper(v_order.currency), v_kind),
      'sha256'
    ), 'hex'),
    case when v_status = 'blocked_data' then 'FISCAL_CONFIGURATION_INCOMPLETE' else null end,
    case when v_status = 'blocked_data'
      then 'Emissão desativada até conclusão e aprovação do checklist fiscal.'
      else null end
  )
  on conflict (order_id, provider) where original_fiscal_document_id is null
  do update set
    net_amount_cents = excluded.net_amount_cents,
    tax_amount_cents = excluded.tax_amount_cents,
    total_amount_cents = excluded.total_amount_cents,
    payment_reference = excluded.payment_reference,
    payload_hash = excluded.payload_hash,
    updated_at = now()
  returning id into v_document_id;

  if v_document_id is null then
    select id into v_document_id
    from public.fiscal_documents
    where order_id = v_order.id and provider = 'moloni' and original_fiscal_document_id is null;
  end if;

  insert into public.moloni_document_jobs (
    fiscal_document_id,
    job_type,
    status,
    idempotency_key,
    available_at,
    last_error_code,
    last_error
  )
  values (
    v_document_id,
    'issue_document',
    case when v_status = 'blocked_data' then 'blocked' else 'pending' end,
    'moloni:' || v_environment || ':' || v_order.id::text || ':sale:v1',
    now(),
    case when v_status = 'blocked_data' then 'FISCAL_CONFIGURATION_INCOMPLETE' else null end,
    case when v_status = 'blocked_data'
      then 'Emissão desativada até conclusão e aprovação do checklist fiscal.'
      else null end
  )
  on conflict (idempotency_key) do nothing;

  return v_document_id;
end;
$$;

create or replace function public.plan_order_fiscal_outbox_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and coalesce(new.payment_provider, '') = 'stripe' then
    if tg_op = 'INSERT'
      or old.status is distinct from new.status
      or old.total_paid_cents is distinct from new.total_paid_cents
    then
      perform public.ensure_order_fiscal_outbox(new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_plan_fiscal_outbox on public.orders;
create trigger orders_plan_fiscal_outbox
after insert or update of status, total_paid_cents, tax_amount_cents on public.orders
for each row execute function public.plan_order_fiscal_outbox_trigger();

do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select id
    from public.orders
    where status = 'paid'
      and payment_provider = 'stripe'
  loop
    perform public.ensure_order_fiscal_outbox(v_order_id);
  end loop;
end;
$$;

create or replace function public.claim_moloni_document_jobs(
  p_worker_id text,
  p_batch_size integer default 10
)
returns setof public.moloni_document_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;

  update public.moloni_document_jobs
  set
    status = 'retry',
    locked_at = null,
    locked_by = null,
    available_at = now(),
    last_error_code = 'STALE_LOCK_RECOVERED',
    last_error = 'Bloqueio expirado recuperado automaticamente.',
    updated_at = now()
  where status = 'processing'
    and locked_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select id
    from public.moloni_document_jobs
    where status in ('pending', 'retry')
      and available_at <= now()
      and attempt_count < max_attempts
    order by available_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 10), 50))
  )
  update public.moloni_document_jobs jobs
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    attempt_count = jobs.attempt_count + 1,
    updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

create or replace function public.claim_stripe_event(
  p_event_id text,
  p_event_type text,
  p_lock_timeout_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  insert into public.stripe_processed_events (event_id, event_type, status, locked_at)
  values (p_event_id, p_event_type, 'processing', now())
  on conflict (event_id) do nothing
  returning status into v_status;

  if found then
    return 'claimed';
  end if;

  select status into v_status
  from public.stripe_processed_events
  where event_id = p_event_id
  for update;

  if v_status = 'completed' then
    return 'completed';
  end if;

  update public.stripe_processed_events
  set status = 'processing', locked_at = now(), last_error = null, updated_at = now()
  where event_id = p_event_id
    and (
      status = 'failed'
      or locked_at < now() - make_interval(secs => greatest(p_lock_timeout_seconds, 30))
    );

  if found then
    return 'claimed';
  end if;

  return 'busy';
end;
$$;

create or replace function public.claim_moloni_customer_lock(
  p_lock_key text,
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.moloni_customer_locks (lock_key, locked_until, locked_by)
  values (
    p_lock_key,
    now() + make_interval(secs => greatest(30, least(p_lease_seconds, 300))),
    p_worker_id
  )
  on conflict (lock_key) do update set
    locked_until = excluded.locked_until,
    locked_by = excluded.locked_by,
    updated_at = now()
  where public.moloni_customer_locks.locked_until < now()
     or public.moloni_customer_locks.locked_by = p_worker_id;
  return found;
end;
$$;

create or replace function public.release_moloni_customer_lock(p_lock_key text, p_worker_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.moloni_customer_locks
  where lock_key = p_lock_key and locked_by = p_worker_id;
$$;

create or replace function public.complete_stripe_event(p_event_id text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stripe_processed_events
  set status = 'completed', completed_at = now(), last_error = null, updated_at = now()
  where event_id = p_event_id;
$$;

create or replace function public.fail_stripe_event(p_event_id text, p_error text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.stripe_processed_events
  set status = 'failed', last_error = left(coalesce(p_error, 'unknown error'), 500), updated_at = now()
  where event_id = p_event_id;
$$;

create or replace function public.get_moloni_credentials(p_environment text)
returns table (
  environment text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  encryption_version integer,
  refresh_locked_at timestamptz,
  refresh_locked_by text
)
language sql
security definer
set search_path = private, public, pg_temp
as $$
  select
    c.environment,
    c.access_token_ciphertext,
    c.refresh_token_ciphertext,
    c.encryption_version,
    c.refresh_locked_at,
    c.refresh_locked_by
  from private.moloni_credentials c
  where c.environment = p_environment;
$$;

create or replace function public.store_moloni_credentials(
  p_environment text,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_encryption_version integer default 1
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  insert into private.moloni_credentials (
    environment,
    access_token_ciphertext,
    refresh_token_ciphertext,
    encryption_version,
    refresh_locked_at,
    refresh_locked_by
  )
  values (
    p_environment,
    p_access_token_ciphertext,
    p_refresh_token_ciphertext,
    p_encryption_version,
    null,
    null
  )
  on conflict (environment) do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    encryption_version = excluded.encryption_version,
    refresh_locked_at = null,
    refresh_locked_by = null,
    updated_at = now();
end;
$$;

create or replace function public.claim_moloni_token_refresh(p_environment text, p_worker_id text)
returns boolean
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  update private.moloni_credentials
  set refresh_locked_at = now(), refresh_locked_by = p_worker_id, updated_at = now()
  where environment = p_environment
    and (refresh_locked_at is null or refresh_locked_at < now() - interval '2 minutes');
  return found;
end;
$$;

create or replace function public.release_moloni_token_refresh(p_environment text, p_worker_id text)
returns void
language sql
security definer
set search_path = private, public, pg_temp
as $$
  update private.moloni_credentials
  set refresh_locked_at = null, refresh_locked_by = null, updated_at = now()
  where environment = p_environment and refresh_locked_by = p_worker_id;
$$;

create or replace function public.delete_moloni_credentials(p_environment text)
returns void
language sql
security definer
set search_path = private, public, pg_temp
as $$
  delete from private.moloni_credentials where environment = p_environment;
$$;

create or replace function public.claim_admin_integration_rate_limit(
  p_actor_user_id uuid,
  p_action_key text,
  p_limit integer default 20
)
returns boolean
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  delete from private.admin_integration_rate_limits
  where minute_bucket < date_trunc('minute', now()) - interval '10 minutes';

  insert into private.admin_integration_rate_limits (
    actor_user_id,
    action_key,
    minute_bucket,
    request_count
  )
  values (
    p_actor_user_id,
    left(coalesce(nullif(trim(p_action_key), ''), 'unknown'), 100),
    date_trunc('minute', now()),
    1
  )
  on conflict (actor_user_id, action_key, minute_bucket) do update
  set request_count = private.admin_integration_rate_limits.request_count + 1
  where private.admin_integration_rate_limits.request_count < greatest(1, least(p_limit, 100));

  return found;
end;
$$;

revoke all on function public.ensure_order_fiscal_outbox(uuid) from public, anon, authenticated;
revoke all on function public.claim_moloni_document_jobs(text, integer) from public, anon, authenticated;
revoke all on function public.claim_stripe_event(text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_stripe_event(text) from public, anon, authenticated;
revoke all on function public.fail_stripe_event(text, text) from public, anon, authenticated;
revoke all on function public.claim_moloni_customer_lock(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_moloni_customer_lock(text, text) from public, anon, authenticated;
revoke all on function public.get_moloni_credentials(text) from public, anon, authenticated;
revoke all on function public.store_moloni_credentials(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.claim_moloni_token_refresh(text, text) from public, anon, authenticated;
revoke all on function public.release_moloni_token_refresh(text, text) from public, anon, authenticated;
revoke all on function public.delete_moloni_credentials(text) from public, anon, authenticated;
revoke all on function public.claim_admin_integration_rate_limit(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.ensure_order_fiscal_outbox(uuid) to service_role;
grant execute on function public.claim_moloni_document_jobs(text, integer) to service_role;
grant execute on function public.claim_stripe_event(text, text, integer) to service_role;
grant execute on function public.complete_stripe_event(text) to service_role;
grant execute on function public.fail_stripe_event(text, text) to service_role;
grant execute on function public.claim_moloni_customer_lock(text, text, integer) to service_role;
grant execute on function public.release_moloni_customer_lock(text, text) to service_role;
grant execute on function public.get_moloni_credentials(text) to service_role;
grant execute on function public.store_moloni_credentials(text, text, text, integer) to service_role;
grant execute on function public.claim_moloni_token_refresh(text, text) to service_role;
grant execute on function public.release_moloni_token_refresh(text, text) to service_role;
grant execute on function public.delete_moloni_credentials(text) to service_role;
grant execute on function public.claim_admin_integration_rate_limit(uuid, text, integer) to service_role;

alter table public.order_billing_details enable row level security;
alter table public.moloni_fiscal_settings enable row level security;
alter table public.moloni_connections enable row level security;
alter table public.moloni_oauth_states enable row level security;
alter table public.moloni_product_mappings enable row level security;
alter table public.moloni_customer_links enable row level security;
alter table public.moloni_customer_locks enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.moloni_document_jobs enable row level security;
alter table public.fiscal_adjustment_requests enable row level security;
alter table public.stripe_processed_events enable row level security;

create policy order_billing_details_select_own
  on public.order_billing_details for select
  using (user_id = auth.uid() and public.is_active_profile());
create policy order_billing_details_select_admin
  on public.order_billing_details for select
  using (public.is_admin());

create policy fiscal_documents_select_own
  on public.fiscal_documents for select
  using (user_id = auth.uid() and public.is_active_profile());
create policy fiscal_documents_select_admin
  on public.fiscal_documents for select
  using (public.is_admin());

create policy fiscal_adjustments_select_own
  on public.fiscal_adjustment_requests for select
  using (user_id = auth.uid() and public.is_active_profile());
create policy fiscal_adjustments_select_admin
  on public.fiscal_adjustment_requests for select
  using (public.is_admin());

create policy moloni_settings_select_admin
  on public.moloni_fiscal_settings for select
  using (public.is_admin());
create policy moloni_connections_select_admin
  on public.moloni_connections for select
  using (public.is_admin());
create policy moloni_mappings_select_admin
  on public.moloni_product_mappings for select
  using (public.is_admin());
create policy moloni_customer_links_select_admin
  on public.moloni_customer_links for select
  using (public.is_admin());
create policy moloni_jobs_select_admin
  on public.moloni_document_jobs for select
  using (public.is_admin());

create trigger order_billing_details_updated_at
  before update on public.order_billing_details
  for each row execute function public.set_updated_at();
create trigger moloni_fiscal_settings_updated_at
  before update on public.moloni_fiscal_settings
  for each row execute function public.set_updated_at();
create trigger moloni_connections_updated_at
  before update on public.moloni_connections
  for each row execute function public.set_updated_at();
create trigger moloni_product_mappings_updated_at
  before update on public.moloni_product_mappings
  for each row execute function public.set_updated_at();
create trigger moloni_customer_links_updated_at
  before update on public.moloni_customer_links
  for each row execute function public.set_updated_at();
create trigger moloni_customer_locks_updated_at
  before update on public.moloni_customer_locks
  for each row execute function public.set_updated_at();
create trigger fiscal_documents_updated_at
  before update on public.fiscal_documents
  for each row execute function public.set_updated_at();
create trigger moloni_document_jobs_updated_at
  before update on public.moloni_document_jobs
  for each row execute function public.set_updated_at();
create trigger fiscal_adjustment_requests_updated_at
  before update on public.fiscal_adjustment_requests
  for each row execute function public.set_updated_at();
create trigger stripe_processed_events_updated_at
  before update on public.stripe_processed_events
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fiscal-documents', 'fiscal-documents', false, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job where jobname = 'mariana-cron-process-moloni-documents'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'mariana-cron-process-moloni-documents',
    '*/5 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-process-moloni-documents',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"batchSize":10,"source":"pg_cron"}'::jsonb
      );
    $command$
  );
end;
$$;

comment on table public.order_billing_details is
  'Immutable-per-sale fiscal customer snapshot; backend writes only.';
comment on table public.fiscal_documents is
  'Local source of truth for Moloni document issuance state, not payment or access.';
comment on table public.moloni_document_jobs is
  'Durable fiscal outbox claimed with FOR UPDATE SKIP LOCKED.';
comment on table public.fiscal_adjustment_requests is
  'Refund/chargeback fiscal review queue. No correction document is inferred automatically.';
comment on column public.fiscal_documents.document_kind is
  'pending_decision is an operational placeholder used while accountant decisions are absent.';

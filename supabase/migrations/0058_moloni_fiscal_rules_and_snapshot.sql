-- Moloni fiscal hardening: official tax rates, contextual rules and immutable snapshots.
-- Existing product mappings remain valid as a compatibility fallback until explicit rules exist.

alter table public.moloni_product_mappings
  add column if not exists mapping_status text not null default 'valid'
    check (mapping_status in ('valid', 'requires_review')),
  add column if not exists mapping_review_reason text null,
  add column if not exists tax_verified_at timestamptz null;

create index if not exists moloni_product_mappings_review_idx
  on public.moloni_product_mappings (payment_environment, mapping_status)
  where is_active;

create table if not exists public.moloni_fiscal_rules (
  id uuid primary key default gen_random_uuid(),
  payment_environment text not null references public.moloni_fiscal_settings(payment_environment) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  moloni_company_id integer not null check (moloni_company_id > 0),
  billing_country_code text null check (billing_country_code is null or billing_country_code ~ '^[A-Z]{2}$'),
  customer_type text null check (customer_type is null or customer_type in ('individual', 'company')),
  moloni_tax_id integer null check (moloni_tax_id is null or moloni_tax_id > 0),
  tax_value numeric(8,4) null check (tax_value is null or (tax_value >= 0 and tax_value <= 100)),
  exemption_reason text null,
  priority integer not null default 100 check (priority between 0 and 100000),
  is_default boolean not null default false,
  is_active boolean not null default true,
  tax_verified_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (moloni_tax_id is not null or nullif(trim(exemption_reason), '') is not null),
  check (moloni_tax_id is null or tax_value is not null),
  check (not is_default or (billing_country_code is null and customer_type is null))
);

create index if not exists moloni_fiscal_rules_selection_idx
  on public.moloni_fiscal_rules (
    payment_environment,
    product_id,
    moloni_company_id,
    is_active,
    priority,
    billing_country_code,
    customer_type
  );
create index if not exists moloni_fiscal_rules_review_idx
  on public.moloni_fiscal_rules (payment_environment, is_active, is_default);

alter table public.fiscal_documents
  add column if not exists selected_fiscal_rule_id uuid null references public.moloni_fiscal_rules(id) on delete restrict,
  add column if not exists fiscal_selection_reason text null,
  add column if not exists fiscal_snapshot jsonb null,
  add column if not exists fiscal_snapshot_locked_at timestamptz null;

create or replace function public.prevent_fiscal_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.fiscal_snapshot is not null and new.fiscal_snapshot is distinct from old.fiscal_snapshot then
    raise exception 'fiscal_snapshot is immutable after capture';
  end if;
  if old.fiscal_snapshot_locked_at is not null and new.fiscal_snapshot_locked_at is distinct from old.fiscal_snapshot_locked_at then
    raise exception 'fiscal_snapshot_locked_at is immutable after capture';
  end if;
  return new;
end;
$$;

drop trigger if exists fiscal_documents_snapshot_immutable on public.fiscal_documents;
create trigger fiscal_documents_snapshot_immutable
  before update on public.fiscal_documents
  for each row execute function public.prevent_fiscal_snapshot_mutation();

drop trigger if exists moloni_fiscal_rules_updated_at on public.moloni_fiscal_rules;
create trigger moloni_fiscal_rules_updated_at
  before update on public.moloni_fiscal_rules
  for each row execute function public.set_updated_at();

alter table public.moloni_fiscal_rules enable row level security;
drop policy if exists moloni_fiscal_rules_select_admin on public.moloni_fiscal_rules;
create policy moloni_fiscal_rules_select_admin
  on public.moloni_fiscal_rules for select
  using (public.is_admin());

comment on table public.moloni_fiscal_rules is
  'Explicit accountant-configured fiscal selection by environment, product, country and customer type.';
comment on column public.moloni_product_mappings.tax_value is
  'Official percentage read from Moloni; never a client-provided source of truth.';
comment on column public.fiscal_documents.fiscal_snapshot is
  'Immutable fiscal inputs and rule selection captured before Moloni emission.';

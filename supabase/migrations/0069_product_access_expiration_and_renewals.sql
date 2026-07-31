-- Configuração de vigência do acesso por material e rastreio de renovações.
-- A autorização continua a depender exclusivamente de access_grants.

alter table public.products
  add column if not exists access_expiration_mode text not null default 'lifetime',
  add column if not exists access_expires_at timestamptz null,
  add column if not exists access_duration_days integer null,
  add column if not exists renewal_enabled boolean not null default false,
  add column if not exists renewal_discount_enabled boolean not null default false,
  add column if not exists renewal_discount_percent numeric(5, 2) null;

alter table public.products
  drop constraint if exists products_access_expiration_mode_check;

alter table public.products
  add constraint products_access_expiration_mode_check
  check (access_expiration_mode in ('specific_date', 'days_after_enrollment_open', 'days_after_student_enrollment', 'lifetime'));

alter table public.products
  drop constraint if exists products_access_expiration_configuration_check;

alter table public.products
  add constraint products_access_expiration_configuration_check
  check (
    (access_expiration_mode = 'lifetime' and access_expires_at is null and access_duration_days is null)
    or (access_expiration_mode = 'specific_date' and access_expires_at is not null and access_duration_days is null)
    or (access_expiration_mode in ('days_after_enrollment_open', 'days_after_student_enrollment')
      and access_expires_at is null and access_duration_days is not null and access_duration_days > 0)
  );

alter table public.products
  drop constraint if exists products_renewal_discount_check;

alter table public.products
  add constraint products_renewal_discount_check
  check (
    (renewal_discount_enabled = false and renewal_discount_percent is null)
    or (renewal_discount_enabled = true and renewal_discount_percent is not null
      and renewal_discount_percent >= 0 and renewal_discount_percent <= 100)
  );

alter table public.orders
  add column if not exists access_renewal boolean not null default false;

create index if not exists orders_access_renewal_idx
  on public.orders (user_id, product_id, access_renewal, created_at desc);

alter table public.access_grants
  drop constraint if exists access_grants_source_type_check;

alter table public.access_grants
  add constraint access_grants_source_type_check
  check (source_type in ('purchase', 'renewal', 'free_claim', 'admin_grant', 'manual_adjustment'));

create index if not exists access_grants_expiration_idx
  on public.access_grants (user_id, product_id, expires_at)
  where status = 'active' and revoked_at is null and expires_at is not null;

comment on column public.products.access_expiration_mode is
  'Regra de término: data específica, dias após abertura das inscrições, dias após inscrição do aluno ou vitalício.';
comment on column public.orders.access_renewal is
  'Indica que o pedido foi criado exclusivamente para renovar um acesso expirado.';

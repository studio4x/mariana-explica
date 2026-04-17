alter table public.orders
  add column if not exists payment_environment text not null default 'test';

alter table public.orders
  drop constraint if exists orders_payment_environment_check;

alter table public.orders
  add constraint orders_payment_environment_check
  check (payment_environment in ('test', 'live'));

comment on column public.orders.payment_environment is
  'Ambiente Stripe usado no checkout: test ou live';


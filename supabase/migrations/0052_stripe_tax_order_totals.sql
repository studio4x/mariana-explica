alter table public.orders
  add column if not exists tax_amount_cents integer not null default 0,
  add column if not exists total_paid_cents integer null,
  add column if not exists stripe_invoice_id text null;

alter table public.orders
  drop constraint if exists orders_tax_amount_checks;

alter table public.orders
  add constraint orders_tax_amount_checks
  check (
    tax_amount_cents >= 0
    and (total_paid_cents is null or total_paid_cents >= 0)
  );

create index if not exists orders_stripe_invoice_id_idx
  on public.orders (stripe_invoice_id);

comment on column public.orders.tax_amount_cents is
  'Imposto calculado pela Stripe Tax, em centimos, conforme a Checkout Session concluida.';

comment on column public.orders.total_paid_cents is
  'Total efetivamente cobrado pela Stripe, incluindo imposto quando aplicavel, em centimos.';

comment on column public.orders.stripe_invoice_id is
  'Identificador da fatura Stripe criada para uma Checkout Session quando solicitado.';

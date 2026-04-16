alter table public.email_deliveries
  add column if not exists subject text null,
  add column if not exists html_content text null,
  add column if not exists text_content text null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

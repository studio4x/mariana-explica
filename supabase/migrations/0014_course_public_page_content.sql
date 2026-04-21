alter table public.products
  add column if not exists public_page_content jsonb not null default '{}'::jsonb;

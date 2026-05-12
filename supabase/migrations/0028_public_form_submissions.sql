-- 0028_public_form_submissions.sql
-- Persist public-site form submissions and allow admin visibility.

create table if not exists public.public_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_type text not null,
  source_page text not null,
  full_name text not null,
  email text not null,
  subject text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  notified_email_to text null,
  notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_form_submissions_form_type_check check (char_length(form_type) between 2 and 80),
  constraint public_form_submissions_source_page_check check (char_length(source_page) between 1 and 180),
  constraint public_form_submissions_full_name_check check (char_length(full_name) between 2 and 140),
  constraint public_form_submissions_email_check check (position('@' in email) > 1 and char_length(email) <= 180),
  constraint public_form_submissions_subject_check check (char_length(subject) between 2 and 180),
  constraint public_form_submissions_message_check check (char_length(message) between 8 and 5000)
);

create index if not exists public_form_submissions_created_at_idx
  on public.public_form_submissions (created_at desc);

create index if not exists public_form_submissions_form_type_idx
  on public.public_form_submissions (form_type, created_at desc);

create index if not exists public_form_submissions_email_idx
  on public.public_form_submissions (email);

drop trigger if exists public_form_submissions_updated_at on public.public_form_submissions;
create trigger public_form_submissions_updated_at
before update on public.public_form_submissions
for each row execute function public.set_updated_at();

alter table public.public_form_submissions enable row level security;

drop policy if exists public_form_submissions_insert_public on public.public_form_submissions;
create policy public_form_submissions_insert_public
  on public.public_form_submissions
  for insert
  with check (true);

drop policy if exists public_form_submissions_select_admin on public.public_form_submissions;
create policy public_form_submissions_select_admin
  on public.public_form_submissions
  for select
  using (public.is_admin());

drop policy if exists public_form_submissions_admin_manage on public.public_form_submissions;
create policy public_form_submissions_admin_manage
  on public.public_form_submissions
  for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.site_config (config_key, config_value, description, is_public)
values (
  'public_form_notifications',
  jsonb_build_object('notification_email', ''),
  'Endereco de email que recebe alertas dos formularios enviados no site publico.',
  false
)
on conflict (config_key) do nothing;

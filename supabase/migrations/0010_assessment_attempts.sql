create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id uuid not null references public.product_assessments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  module_id uuid null references public.product_modules(id) on delete set null,
  attempt_number integer not null,
  status text not null default 'in_progress',
  answers_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  auto_score_percent integer null,
  final_score_percent integer null,
  requires_manual_review boolean not null default false,
  passed boolean null,
  started_at timestamptz not null default now(),
  last_saved_at timestamptz not null default now(),
  submitted_at timestamptz null,
  evaluated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, assessment_id, attempt_number)
);

create index if not exists assessment_attempts_user_id_idx
  on public.assessment_attempts (user_id);
create index if not exists assessment_attempts_assessment_id_idx
  on public.assessment_attempts (assessment_id);
create index if not exists assessment_attempts_product_id_idx
  on public.assessment_attempts (product_id);
create index if not exists assessment_attempts_status_idx
  on public.assessment_attempts (status);
create index if not exists assessment_attempts_user_assessment_idx
  on public.assessment_attempts (user_id, assessment_id, created_at desc);
create unique index if not exists assessment_attempts_single_open_idx
  on public.assessment_attempts (user_id, assessment_id)
  where status = 'in_progress';

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_status_check;

alter table public.assessment_attempts
  add constraint assessment_attempts_status_check
  check (status in ('in_progress', 'submitted', 'passed', 'failed', 'pending_review'));

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_auto_score_check;

alter table public.assessment_attempts
  add constraint assessment_attempts_auto_score_check
  check (auto_score_percent is null or (auto_score_percent >= 0 and auto_score_percent <= 100));

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_final_score_check;

alter table public.assessment_attempts
  add constraint assessment_attempts_final_score_check
  check (final_score_percent is null or (final_score_percent >= 0 and final_score_percent <= 100));

alter table public.assessment_attempts
  drop constraint if exists assessment_attempts_attempt_number_check;

alter table public.assessment_attempts
  add constraint assessment_attempts_attempt_number_check
  check (attempt_number > 0);

create trigger assessment_attempts_updated_at before update on public.assessment_attempts
for each row execute function public.set_updated_at();

create or replace function public.can_access_product_assessment(
  target_assessment_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.product_assessments
    join public.products on products.id = product_assessments.product_id
    where product_assessments.id = target_assessment_id
      and product_assessments.is_active = true
      and products.status = 'published'
      and (
        public.is_admin()
        or (
          product_assessments.module_id is not null
          and public.can_access_product_module(product_assessments.module_id, target_user)
        )
        or (
          product_assessments.module_id is null
          and target_user is not null
          and public.is_active_profile(target_user)
          and public.has_active_grant(product_assessments.product_id, target_user)
        )
      )
  );
$$;

drop policy if exists product_assessments_select_accessible on public.product_assessments;
create policy product_assessments_select_accessible on public.product_assessments
for select using (public.can_access_product_assessment(id, auth.uid()));

alter table public.assessment_attempts enable row level security;
drop policy if exists assessment_attempts_select_own on public.assessment_attempts;
drop policy if exists assessment_attempts_admin_manage on public.assessment_attempts;
create policy assessment_attempts_select_own on public.assessment_attempts
for select using (
  user_id = auth.uid()
  and public.is_active_profile()
  and public.can_access_product_assessment(assessment_id, auth.uid())
);
create policy assessment_attempts_admin_manage on public.assessment_attempts
for all using (public.is_admin()) with check (public.is_admin());

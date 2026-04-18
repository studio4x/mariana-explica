alter table public.products
  add column if not exists launch_date date null,
  add column if not exists is_public boolean not null default true,
  add column if not exists creator_id uuid null references public.profiles(id) on delete set null,
  add column if not exists creator_commission_percent numeric(5, 2) null,
  add column if not exists workload_minutes integer not null default 0,
  add column if not exists has_linear_progression boolean not null default false,
  add column if not exists quiz_type_settings jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_creator_commission_check;

alter table public.products
  add constraint products_creator_commission_check
  check (
    creator_commission_percent is null
    or (creator_commission_percent >= 0 and creator_commission_percent <= 100)
  );

alter table public.products
  drop constraint if exists products_workload_minutes_check;

alter table public.products
  add constraint products_workload_minutes_check
  check (workload_minutes >= 0);

create index if not exists products_public_idx on public.products (is_public);
create index if not exists products_creator_idx on public.products (creator_id);
create index if not exists products_launch_date_idx on public.products (launch_date);

alter table public.product_modules
  add column if not exists position integer not null default 0,
  add column if not exists is_required boolean not null default true,
  add column if not exists starts_at timestamptz null,
  add column if not exists ends_at timestamptz null,
  add column if not exists release_days_after_enrollment integer null,
  add column if not exists module_pdf_storage_path text null,
  add column if not exists module_pdf_file_name text null,
  add column if not exists module_pdf_uploaded_at timestamptz null;

update public.product_modules
set position = sort_order
where position = 0
  and sort_order <> 0;

alter table public.product_modules
  drop constraint if exists product_modules_release_days_check;

alter table public.product_modules
  add constraint product_modules_release_days_check
  check (release_days_after_enrollment is null or release_days_after_enrollment >= 0);

create index if not exists product_modules_position_idx on public.product_modules (position);
create index if not exists product_modules_starts_at_idx on public.product_modules (starts_at);
create index if not exists product_modules_ends_at_idx on public.product_modules (ends_at);

create table if not exists public.product_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.product_modules(id) on delete cascade,
  title text not null,
  description text null,
  position integer not null default 0,
  is_required boolean not null default true,
  lesson_type text not null default 'text',
  youtube_url text null,
  text_content text null,
  estimated_minutes integer not null default 0,
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_lessons_module_id_idx on public.product_lessons (module_id);
create index if not exists product_lessons_position_idx on public.product_lessons (position);
create index if not exists product_lessons_status_idx on public.product_lessons (status);

alter table public.product_lessons
  drop constraint if exists product_lessons_lesson_type_check;

alter table public.product_lessons
  add constraint product_lessons_lesson_type_check
  check (lesson_type in ('video', 'text', 'hybrid'));

alter table public.product_lessons
  drop constraint if exists product_lessons_status_check;

alter table public.product_lessons
  add constraint product_lessons_status_check
  check (status in ('draft', 'published', 'archived'));

alter table public.product_lessons
  drop constraint if exists product_lessons_estimated_minutes_check;

alter table public.product_lessons
  add constraint product_lessons_estimated_minutes_check
  check (estimated_minutes >= 0);

create table if not exists public.product_assessments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  module_id uuid null references public.product_modules(id) on delete cascade,
  assessment_type text not null default 'module',
  title text not null,
  description text null,
  is_required boolean not null default false,
  passing_score integer not null default 70,
  max_attempts integer null,
  estimated_minutes integer not null default 0,
  is_active boolean not null default true,
  builder_payload jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_assessments_product_id_idx on public.product_assessments (product_id);
create index if not exists product_assessments_module_id_idx on public.product_assessments (module_id);
create index if not exists product_assessments_type_idx on public.product_assessments (assessment_type);
create index if not exists product_assessments_active_idx on public.product_assessments (is_active);

alter table public.product_assessments
  drop constraint if exists product_assessments_type_check;

alter table public.product_assessments
  add constraint product_assessments_type_check
  check (assessment_type in ('module', 'final'));

alter table public.product_assessments
  drop constraint if exists product_assessments_passing_score_check;

alter table public.product_assessments
  add constraint product_assessments_passing_score_check
  check (passing_score >= 0 and passing_score <= 100);

alter table public.product_assessments
  drop constraint if exists product_assessments_max_attempts_check;

alter table public.product_assessments
  add constraint product_assessments_max_attempts_check
  check (max_attempts is null or max_attempts > 0);

alter table public.product_assessments
  drop constraint if exists product_assessments_estimated_minutes_check;

alter table public.product_assessments
  add constraint product_assessments_estimated_minutes_check
  check (estimated_minutes >= 0);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.product_lessons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  module_id uuid not null references public.product_modules(id) on delete cascade,
  status text not null default 'not_started',
  progress_percent integer not null default 0,
  started_at timestamptz null,
  completed_at timestamptz null,
  last_accessed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create index if not exists lesson_progress_user_id_idx on public.lesson_progress (user_id);
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index if not exists lesson_progress_product_id_idx on public.lesson_progress (product_id);
create index if not exists lesson_progress_status_idx on public.lesson_progress (status);

alter table public.lesson_progress
  drop constraint if exists lesson_progress_status_check;

alter table public.lesson_progress
  add constraint lesson_progress_status_check
  check (status in ('not_started', 'in_progress', 'completed'));

alter table public.lesson_progress
  drop constraint if exists lesson_progress_percent_check;

alter table public.lesson_progress
  add constraint lesson_progress_percent_check
  check (progress_percent >= 0 and progress_percent <= 100);

create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.product_lessons(id) on delete cascade,
  note_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create index if not exists lesson_notes_user_id_idx on public.lesson_notes (user_id);
create index if not exists lesson_notes_lesson_id_idx on public.lesson_notes (lesson_id);

create trigger product_lessons_updated_at before update on public.product_lessons
for each row execute function public.set_updated_at();

create trigger product_assessments_updated_at before update on public.product_assessments
for each row execute function public.set_updated_at();

create trigger lesson_progress_updated_at before update on public.lesson_progress
for each row execute function public.set_updated_at();

create trigger lesson_notes_updated_at before update on public.lesson_notes
for each row execute function public.set_updated_at();

create or replace function public.can_access_product_module(
  target_module_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.product_modules
    join public.products on products.id = product_modules.product_id
    where product_modules.id = target_module_id
      and product_modules.status = 'published'
      and products.status = 'published'
      and (product_modules.starts_at is null or product_modules.starts_at <= now())
      and (product_modules.ends_at is null or product_modules.ends_at > now())
      and (
        public.is_admin()
        or product_modules.access_type = 'public'
        or product_modules.is_preview = true
        or (
          product_modules.access_type = 'registered'
          and target_user is not null
          and public.is_active_profile(target_user)
        )
        or (
          product_modules.access_type = 'paid_only'
          and target_user is not null
          and public.is_active_profile(target_user)
          and exists(
            select 1
            from public.access_grants
            where access_grants.product_id = product_modules.product_id
              and access_grants.user_id = target_user
              and access_grants.status = 'active'
              and access_grants.revoked_at is null
              and (access_grants.expires_at is null or access_grants.expires_at > now())
              and (
                product_modules.release_days_after_enrollment is null
                or now() >= access_grants.granted_at + make_interval(days => product_modules.release_days_after_enrollment)
              )
          )
        )
      )
  );
$$;

create or replace function public.can_access_product_lesson(
  target_lesson_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.product_lessons
    join public.product_modules on product_modules.id = product_lessons.module_id
    where product_lessons.id = target_lesson_id
      and product_lessons.status = 'published'
      and (product_lessons.starts_at is null or product_lessons.starts_at <= now())
      and (product_lessons.ends_at is null or product_lessons.ends_at > now())
      and public.can_access_product_module(product_modules.id, target_user)
  );
$$;

alter table public.product_lessons enable row level security;
drop policy if exists product_lessons_select_accessible on public.product_lessons;
drop policy if exists product_lessons_admin_manage on public.product_lessons;
create policy product_lessons_select_accessible on public.product_lessons
for select using (public.can_access_product_lesson(id));
create policy product_lessons_admin_manage on public.product_lessons
for all using (public.is_admin()) with check (public.is_admin());

alter table public.product_assessments enable row level security;
drop policy if exists product_assessments_select_accessible on public.product_assessments;
drop policy if exists product_assessments_admin_manage on public.product_assessments;
create policy product_assessments_select_accessible on public.product_assessments
for select using (
  is_active = true
  and exists(
    select 1
    from public.products
    where products.id = product_assessments.product_id
      and products.status = 'published'
  )
  and (
    public.is_admin()
    or (
      module_id is not null
      and public.can_access_product_module(module_id)
    )
    or (
      module_id is null
      and auth.uid() is not null
      and public.is_active_profile()
      and public.has_active_grant(product_id)
    )
  )
);
create policy product_assessments_admin_manage on public.product_assessments
for all using (public.is_admin()) with check (public.is_admin());

alter table public.lesson_progress enable row level security;
drop policy if exists lesson_progress_select_own on public.lesson_progress;
drop policy if exists lesson_progress_insert_own on public.lesson_progress;
drop policy if exists lesson_progress_update_own on public.lesson_progress;
drop policy if exists lesson_progress_admin_manage on public.lesson_progress;
create policy lesson_progress_select_own on public.lesson_progress
for select using (user_id = auth.uid() and public.is_active_profile());
create policy lesson_progress_insert_own on public.lesson_progress
for insert with check (
  user_id = auth.uid()
  and public.is_active_profile()
  and public.can_access_product_lesson(lesson_id, auth.uid())
);
create policy lesson_progress_update_own on public.lesson_progress
for update using (
  user_id = auth.uid()
  and public.is_active_profile()
)
with check (
  user_id = auth.uid()
  and public.is_active_profile()
  and public.can_access_product_lesson(lesson_id, auth.uid())
);
create policy lesson_progress_admin_manage on public.lesson_progress
for all using (public.is_admin()) with check (public.is_admin());

alter table public.lesson_notes enable row level security;
drop policy if exists lesson_notes_select_own on public.lesson_notes;
drop policy if exists lesson_notes_insert_own on public.lesson_notes;
drop policy if exists lesson_notes_update_own on public.lesson_notes;
drop policy if exists lesson_notes_admin_manage on public.lesson_notes;
create policy lesson_notes_select_own on public.lesson_notes
for select using (user_id = auth.uid() and public.is_active_profile());
create policy lesson_notes_insert_own on public.lesson_notes
for insert with check (
  user_id = auth.uid()
  and public.is_active_profile()
  and public.can_access_product_lesson(lesson_id, auth.uid())
);
create policy lesson_notes_update_own on public.lesson_notes
for update using (
  user_id = auth.uid()
  and public.is_active_profile()
)
with check (
  user_id = auth.uid()
  and public.is_active_profile()
  and public.can_access_product_lesson(lesson_id, auth.uid())
);
create policy lesson_notes_admin_manage on public.lesson_notes
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_modules_select_accessible on public.product_modules;
create policy product_modules_select_accessible on public.product_modules
for select using (public.can_access_product_module(id));

drop policy if exists module_assets_select_accessible on public.module_assets;
create policy module_assets_select_accessible on public.module_assets
for select using (
  status = 'active'
  and public.can_access_product_module(module_id)
);

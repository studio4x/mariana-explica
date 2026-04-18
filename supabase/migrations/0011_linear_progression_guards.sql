create or replace function public.has_completed_lesson(
  target_lesson_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.lesson_progress
    where lesson_progress.lesson_id = target_lesson_id
      and lesson_progress.user_id = target_user
      and lesson_progress.status = 'completed'
  );
$$;

create or replace function public.has_completed_required_lessons_before_module(
  target_module_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select not exists(
    select 1
    from public.product_modules target_module
    join public.product_modules previous_module
      on previous_module.product_id = target_module.product_id
    join public.product_lessons previous_lesson
      on previous_lesson.module_id = previous_module.id
    where target_module.id = target_module_id
      and previous_lesson.status = 'published'
      and previous_lesson.is_required = true
      and (previous_lesson.starts_at is null or previous_lesson.starts_at <= now())
      and (previous_lesson.ends_at is null or previous_lesson.ends_at > now())
      and (
        previous_module.position < target_module.position
        or (
          previous_module.position = target_module.position
          and previous_module.sort_order < target_module.sort_order
        )
      )
      and not public.has_completed_lesson(previous_lesson.id, target_user)
  );
$$;

create or replace function public.has_completed_required_lessons_before_lesson(
  target_lesson_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select not exists(
    select 1
    from public.product_lessons target_lesson
    join public.product_modules target_module
      on target_module.id = target_lesson.module_id
    join public.product_modules previous_module
      on previous_module.product_id = target_module.product_id
    join public.product_lessons previous_lesson
      on previous_lesson.module_id = previous_module.id
    where target_lesson.id = target_lesson_id
      and previous_lesson.status = 'published'
      and previous_lesson.is_required = true
      and (previous_lesson.starts_at is null or previous_lesson.starts_at <= now())
      and (previous_lesson.ends_at is null or previous_lesson.ends_at > now())
      and (
        previous_module.position < target_module.position
        or (
          previous_module.position = target_module.position
          and previous_lesson.position < target_lesson.position
        )
      )
      and not public.has_completed_lesson(previous_lesson.id, target_user)
  );
$$;

create or replace function public.has_completed_required_lessons_for_module(
  target_module_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select not exists(
    select 1
    from public.product_lessons
    where product_lessons.module_id = target_module_id
      and product_lessons.status = 'published'
      and product_lessons.is_required = true
      and (product_lessons.starts_at is null or product_lessons.starts_at <= now())
      and (product_lessons.ends_at is null or product_lessons.ends_at > now())
      and not public.has_completed_lesson(product_lessons.id, target_user)
  );
$$;

create or replace function public.has_completed_required_lessons_for_product(
  target_product_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select not exists(
    select 1
    from public.product_modules
    join public.product_lessons on product_lessons.module_id = product_modules.id
    where product_modules.product_id = target_product_id
      and product_lessons.status = 'published'
      and product_lessons.is_required = true
      and (product_lessons.starts_at is null or product_lessons.starts_at <= now())
      and (product_lessons.ends_at is null or product_lessons.ends_at > now())
      and not public.has_completed_lesson(product_lessons.id, target_user)
  );
$$;

create or replace function public.has_satisfied_required_module_assessments(
  target_product_id uuid,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
as $$
  select not exists(
    select 1
    from public.product_assessments
    where product_assessments.product_id = target_product_id
      and product_assessments.module_id is not null
      and product_assessments.assessment_type = 'module'
      and product_assessments.is_active = true
      and product_assessments.is_required = true
      and not exists(
        select 1
        from public.assessment_attempts
        where assessment_attempts.assessment_id = product_assessments.id
          and assessment_attempts.user_id = target_user
          and assessment_attempts.status in ('passed', 'pending_review')
      )
  );
$$;

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
      and (
        public.is_admin()
        or products.has_linear_progression = false
        or target_user is null
        or public.has_completed_required_lessons_before_module(product_modules.id, target_user)
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
    join public.products on products.id = product_modules.product_id
    where product_lessons.id = target_lesson_id
      and product_lessons.status = 'published'
      and (product_lessons.starts_at is null or product_lessons.starts_at <= now())
      and (product_lessons.ends_at is null or product_lessons.ends_at > now())
      and public.can_access_product_module(product_modules.id, target_user)
      and (
        public.is_admin()
        or products.has_linear_progression = false
        or target_user is null
        or public.has_completed_required_lessons_before_lesson(product_lessons.id, target_user)
      )
  );
$$;

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
      and (
        public.is_admin()
        or products.has_linear_progression = false
        or target_user is null
        or (
          product_assessments.assessment_type = 'module'
          and product_assessments.module_id is not null
          and public.has_completed_required_lessons_for_module(product_assessments.module_id, target_user)
        )
        or (
          product_assessments.assessment_type = 'final'
          and public.has_completed_required_lessons_for_product(product_assessments.product_id, target_user)
          and public.has_satisfied_required_module_assessments(product_assessments.product_id, target_user)
        )
      )
  );
$$;

drop policy if exists product_assessments_select_accessible on public.product_assessments;
create policy product_assessments_select_accessible on public.product_assessments
for select using (public.can_access_product_assessment(id, auth.uid()));

-- 0027_reviews_manual_author_name.sql
-- Supports admin reviews with manual student name (without linking to a user account).

alter table public.reviews
add column if not exists author_name text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and conname = 'reviews_author_name_length_check'
  ) then
    alter table public.reviews
    add constraint reviews_author_name_length_check
    check (author_name is null or char_length(trim(author_name)) between 2 and 120);
  end if;
end
$$;

drop index if exists public.reviews_author_target_active_idx;

create unique index if not exists reviews_author_target_name_active_idx
  on public.reviews (author_id, target_id, target_type, coalesce(author_name, ''))
  where deleted_at is null;

create index if not exists reviews_author_name_idx
  on public.reviews (lower(author_name))
  where author_name is not null;

drop function if exists public.get_homepage_reviews(integer);
drop function if exists public.get_public_course_reviews(uuid, integer);

create or replace function public.get_homepage_reviews(limit_count integer default 6)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  target_id uuid,
  target_type text,
  target_resource_id uuid,
  rating integer,
  title varchar(100),
  content text,
  is_verified_purchase boolean,
  is_moderated boolean,
  moderation_status text,
  moderation_reason varchar(255),
  helpful_count integer,
  unhelpful_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  profiles jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    r.author_id,
    r.author_name,
    r.target_id,
    r.target_type,
    r.target_resource_id,
    r.rating,
    r.title,
    r.content,
    r.is_verified_purchase,
    r.is_moderated,
    r.moderation_status,
    r.moderation_reason,
    r.helpful_count,
    r.unhelpful_count,
    r.created_at,
    r.updated_at,
    jsonb_build_object(
      'full_name', coalesce(nullif(trim(r.author_name), ''), p.full_name),
      'avatar_url', p.avatar_url
    ) as profiles
  from public.reviews r
  left join public.profiles p on p.id = r.author_id
  where r.moderation_status = 'approved'
    and r.deleted_at is null
  order by r.helpful_count desc, r.created_at desc
  limit greatest(coalesce(limit_count, 6), 0);
$$;

create or replace function public.get_public_course_reviews(target_product_id uuid, limit_count integer default 12)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  target_id uuid,
  target_type text,
  target_resource_id uuid,
  rating integer,
  title varchar(100),
  content text,
  is_verified_purchase boolean,
  is_moderated boolean,
  moderation_status text,
  moderation_reason varchar(255),
  helpful_count integer,
  unhelpful_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  profiles jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    r.author_id,
    r.author_name,
    r.target_id,
    r.target_type,
    r.target_resource_id,
    r.rating,
    r.title,
    r.content,
    r.is_verified_purchase,
    r.is_moderated,
    r.moderation_status,
    r.moderation_reason,
    r.helpful_count,
    r.unhelpful_count,
    r.created_at,
    r.updated_at,
    jsonb_build_object(
      'full_name', coalesce(nullif(trim(r.author_name), ''), p.full_name),
      'avatar_url', p.avatar_url
    ) as profiles
  from public.reviews r
  left join public.profiles p on p.id = r.author_id
  where r.target_id = target_product_id
    and r.target_type = 'course'
    and r.moderation_status = 'approved'
    and r.deleted_at is null
  order by r.helpful_count desc, r.created_at desc
  limit greatest(coalesce(limit_count, 12), 0);
$$;

grant execute on function public.get_homepage_reviews(integer) to anon, authenticated;
grant execute on function public.get_public_course_reviews(uuid, integer) to anon, authenticated;

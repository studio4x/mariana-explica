-- 0024_public_reviews_rpc.sql
-- Public, security-definer read helpers for homepage and course testimonials.

create or replace function public.get_homepage_reviews(limit_count integer default 6)
returns table (
  id uuid,
  author_id uuid,
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
      'full_name', p.full_name,
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
      'full_name', p.full_name,
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

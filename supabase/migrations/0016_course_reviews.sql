-- 0016_course_reviews.sql
-- Course review system with moderation, helpful votes and cached public stats.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.products(id) on delete cascade,
  target_type text not null default 'course',
  target_resource_id uuid null references public.products(id) on delete cascade,
  rating integer not null,
  title varchar(100) not null,
  content text not null,
  is_verified_purchase boolean not null default false,
  is_moderated boolean not null default false,
  moderation_status text not null default 'pending',
  moderation_reason varchar(255) null,
  helpful_count integer not null default 0,
  unhelpful_count integer not null default 0,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_target_type_check check (target_type in ('product', 'course')),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_title_length_check check (char_length(trim(title)) between 3 and 100),
  constraint reviews_content_length_check check (char_length(trim(content)) between 3 and 3000),
  constraint reviews_moderation_status_check check (moderation_status in ('pending', 'approved', 'rejected')),
  constraint reviews_vote_counts_check check (helpful_count >= 0 and unhelpful_count >= 0)
);

create unique index if not exists reviews_author_target_active_idx
  on public.reviews (author_id, target_id, target_type)
  where deleted_at is null;

create index if not exists reviews_target_idx
  on public.reviews (target_id, target_type, moderation_status, created_at desc)
  where deleted_at is null;

create index if not exists reviews_author_idx on public.reviews (author_id);
create index if not exists reviews_rating_idx on public.reviews (rating);
create index if not exists reviews_moderation_idx on public.reviews (moderation_status, created_at desc);

create table if not exists public.review_helpful_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_helpful boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists review_helpful_votes_review_id_idx on public.review_helpful_votes (review_id);
create index if not exists review_helpful_votes_user_id_idx on public.review_helpful_votes (user_id);

create table if not exists public.review_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reason text not null,
  description text null,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  moderated_by uuid null references public.profiles(id) on delete set null,
  status text not null default 'pending',
  action text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint review_reports_reason_check check (reason in ('spam', 'inappropriate', 'fake', 'dupe', 'other')),
  constraint review_reports_status_check check (status in ('pending', 'resolved')),
  constraint review_reports_action_check check (action is null or action in ('approve', 'reject', 'edit'))
);

create index if not exists review_reports_review_id_idx on public.review_moderation_reports (review_id);
create index if not exists review_reports_status_idx on public.review_moderation_reports (status, created_at desc);

create table if not exists public.review_stats (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.products(id) on delete cascade,
  target_type text not null default 'course',
  total_reviews integer not null default 0,
  avg_rating numeric(3,2) not null default 0,
  rating_distribution jsonb not null default '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (target_id, target_type),
  constraint review_stats_target_type_check check (target_type in ('product', 'course')),
  constraint review_stats_total_check check (total_reviews >= 0),
  constraint review_stats_avg_check check (avg_rating >= 0 and avg_rating <= 5)
);

create index if not exists review_stats_target_idx on public.review_stats (target_id, target_type);

create or replace function public.refresh_review_stats(target_product_id uuid, target_kind text default 'course')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total_count integer;
  average_rating numeric(3,2);
  distribution jsonb;
begin
  select
    count(*)::integer,
    coalesce(round(avg(rating)::numeric, 2), 0)::numeric(3,2),
    jsonb_build_object(
      '1', count(*) filter (where rating = 1),
      '2', count(*) filter (where rating = 2),
      '3', count(*) filter (where rating = 3),
      '4', count(*) filter (where rating = 4),
      '5', count(*) filter (where rating = 5)
    )
  into total_count, average_rating, distribution
  from public.reviews
  where target_id = target_product_id
    and target_type = target_kind
    and moderation_status = 'approved'
    and deleted_at is null;

  insert into public.review_stats (
    target_id,
    target_type,
    total_reviews,
    avg_rating,
    rating_distribution,
    updated_at
  )
  values (
    target_product_id,
    target_kind,
    total_count,
    average_rating,
    distribution,
    now()
  )
  on conflict (target_id, target_type)
  do update set
    total_reviews = excluded.total_reviews,
    avg_rating = excluded.avg_rating,
    rating_distribution = excluded.rating_distribution,
    updated_at = now();
end;
$$;

create or replace function public.refresh_review_stats_from_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_product_id uuid;
  target_kind text;
begin
  if tg_op = 'DELETE' then
    target_product_id := old.target_id;
    target_kind := coalesce(old.target_type, 'course');
  else
    target_product_id := new.target_id;
    target_kind := coalesce(new.target_type, 'course');
  end if;

  perform public.refresh_review_stats(target_product_id, target_kind);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.refresh_review_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_review_id uuid;
begin
  if tg_op = 'DELETE' then
    target_review_id := old.review_id;
  else
    target_review_id := new.review_id;
  end if;

  update public.reviews
  set
    helpful_count = (
      select count(*)::integer
      from public.review_helpful_votes
      where review_id = target_review_id
        and is_helpful = true
    ),
    unhelpful_count = (
      select count(*)::integer
      from public.review_helpful_votes
      where review_id = target_review_id
        and is_helpful = false
    ),
    updated_at = now()
  where id = target_review_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists review_votes_updated_at on public.review_helpful_votes;
create trigger review_votes_updated_at
before update on public.review_helpful_votes
for each row execute function public.set_updated_at();

drop trigger if exists reviews_refresh_stats_insert on public.reviews;
create trigger reviews_refresh_stats_insert
after insert on public.reviews
for each row execute function public.refresh_review_stats_from_review();

drop trigger if exists reviews_refresh_stats_update on public.reviews;
create trigger reviews_refresh_stats_update
after update of rating, moderation_status, deleted_at, target_id, target_type on public.reviews
for each row execute function public.refresh_review_stats_from_review();

drop trigger if exists reviews_refresh_stats_delete on public.reviews;
create trigger reviews_refresh_stats_delete
after delete on public.reviews
for each row execute function public.refresh_review_stats_from_review();

drop trigger if exists review_votes_refresh_counts_insert on public.review_helpful_votes;
create trigger review_votes_refresh_counts_insert
after insert on public.review_helpful_votes
for each row execute function public.refresh_review_vote_counts();

drop trigger if exists review_votes_refresh_counts_update on public.review_helpful_votes;
create trigger review_votes_refresh_counts_update
after update of is_helpful on public.review_helpful_votes
for each row execute function public.refresh_review_vote_counts();

drop trigger if exists review_votes_refresh_counts_delete on public.review_helpful_votes;
create trigger review_votes_refresh_counts_delete
after delete on public.review_helpful_votes
for each row execute function public.refresh_review_vote_counts();

alter table public.reviews enable row level security;
alter table public.review_helpful_votes enable row level security;
alter table public.review_moderation_reports enable row level security;
alter table public.review_stats enable row level security;

drop policy if exists reviews_select_public_approved on public.reviews;
create policy reviews_select_public_approved
on public.reviews for select
using (moderation_status = 'approved' and deleted_at is null);

drop policy if exists reviews_select_author on public.reviews;
create policy reviews_select_author
on public.reviews for select
using (author_id = auth.uid() and deleted_at is null);

drop policy if exists reviews_select_admin on public.reviews;
create policy reviews_select_admin
on public.reviews for select
using (public.is_admin());

drop policy if exists reviews_admin_manage on public.reviews;
create policy reviews_admin_manage
on public.reviews for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists review_votes_select_own on public.review_helpful_votes;
create policy review_votes_select_own
on public.review_helpful_votes for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists review_votes_insert_own on public.review_helpful_votes;
create policy review_votes_insert_own
on public.review_helpful_votes for insert
with check (user_id = auth.uid());

drop policy if exists review_votes_update_own on public.review_helpful_votes;
create policy review_votes_update_own
on public.review_helpful_votes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists review_reports_insert_own on public.review_moderation_reports;
create policy review_reports_insert_own
on public.review_moderation_reports for insert
with check (reported_by = auth.uid());

drop policy if exists review_reports_select_admin on public.review_moderation_reports;
create policy review_reports_select_admin
on public.review_moderation_reports for select
using (public.is_admin());

drop policy if exists review_reports_admin_manage on public.review_moderation_reports;
create policy review_reports_admin_manage
on public.review_moderation_reports for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists review_stats_select_public on public.review_stats;
create policy review_stats_select_public
on public.review_stats for select
using (true);

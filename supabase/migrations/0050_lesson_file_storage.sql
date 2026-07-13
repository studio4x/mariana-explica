alter table public.product_lessons
  add column if not exists lesson_file_storage_bucket text null,
  add column if not exists lesson_file_storage_path text null,
  add column if not exists lesson_file_storage_provider text null,
  add column if not exists lesson_file_name text null,
  add column if not exists lesson_file_mime_type text null,
  add column if not exists lesson_file_size_bytes bigint null;

alter table public.product_lessons
  drop constraint if exists product_lessons_lesson_file_storage_provider_check;

alter table public.product_lessons
  add constraint product_lessons_lesson_file_storage_provider_check
  check (
    lesson_file_storage_provider is null
    or lesson_file_storage_provider in ('supabase', 'r2')
  );

alter table public.product_lessons
  drop constraint if exists product_lessons_file_metadata_check;

alter table public.product_lessons
  add constraint product_lessons_file_metadata_check
  check (
    lesson_file_storage_path is null
    or (
      lesson_file_storage_bucket is not null
      and lesson_file_name is not null
      and lesson_file_mime_type = 'application/pdf'
      and lesson_file_size_bytes is not null
      and lesson_file_size_bytes >= 0
    )
  );

create index if not exists product_lessons_file_storage_path_idx
  on public.product_lessons (lesson_file_storage_path)
  where lesson_file_storage_path is not null;

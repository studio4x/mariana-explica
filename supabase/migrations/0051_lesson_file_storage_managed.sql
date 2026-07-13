alter table public.product_lessons
  add column if not exists lesson_file_storage_managed boolean not null default true;

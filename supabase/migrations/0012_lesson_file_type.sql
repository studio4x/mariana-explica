alter table public.product_lessons
  drop constraint if exists product_lessons_lesson_type_check;

alter table public.product_lessons
  add constraint product_lessons_lesson_type_check
  check (lesson_type in ('video', 'text', 'hybrid', 'file'));

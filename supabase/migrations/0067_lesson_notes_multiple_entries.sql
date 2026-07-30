-- Allow students to keep multiple independent notes per lesson.
alter table public.lesson_notes
  drop constraint if exists lesson_notes_user_id_lesson_id_key;

create index if not exists lesson_notes_user_lesson_created_idx
  on public.lesson_notes (user_id, lesson_id, created_at desc);

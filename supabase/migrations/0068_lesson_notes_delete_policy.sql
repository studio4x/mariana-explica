drop policy if exists lesson_notes_delete_own on public.lesson_notes;

create policy lesson_notes_delete_own on public.lesson_notes
for delete using (
  user_id = auth.uid()
  and public.is_active_profile()
);

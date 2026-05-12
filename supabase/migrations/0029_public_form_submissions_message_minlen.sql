-- 0029_public_form_submissions_message_minlen.sql
-- Relax form message minimum size to avoid false negatives on valid short requests.

alter table public.public_form_submissions
  drop constraint if exists public_form_submissions_message_check;

alter table public.public_form_submissions
  add constraint public_form_submissions_message_check
  check (char_length(message) between 2 and 5000);

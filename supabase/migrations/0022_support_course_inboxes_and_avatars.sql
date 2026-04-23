-- 0022_support_course_inboxes_and_avatars.sql
-- Link support tickets to courses for support context.

alter table public.support_tickets
  add column if not exists product_id uuid null references public.products(id) on delete set null;

create index if not exists support_tickets_product_id_idx on public.support_tickets (product_id);

-- 0055_course_chat_activation.sql
-- Controls whether the student material-doubts chat is available for each product.

alter table public.products
  add column if not exists course_chat_enabled boolean not null default false;

comment on column public.products.course_chat_enabled is
  'Permite abrir o chat de duvidas sobre este curso/material na area do aluno.';

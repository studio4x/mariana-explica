-- 0054_support_course_chat_category.sql
-- Adds the dedicated category used by the student course/material chat.

alter table public.support_tickets
  drop constraint if exists support_tickets_category_check;

alter table public.support_tickets
  add constraint support_tickets_category_check
  check (category in ('payment', 'technical', 'account', 'general', 'course_chat'));

update public.site_config
set config_value = jsonb_set(
  config_value,
  '{categories}',
  coalesce(config_value->'categories', '[]'::jsonb) ||
    '[{"key":"course_chat","label":"Chat do curso","first_response_hours":24,"position":5,"description":"Duvidas enviadas diretamente a partir de um curso ou material."}]'::jsonb
)
where config_key = 'support_sla_config'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(config_value->'categories', '[]'::jsonb)) as category
    where category->>'key' = 'course_chat'
  );

create or replace function public.get_support_sla_config()
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select config_value
      from public.site_config
      where config_key = 'support_sla_config'
      limit 1
    ),
    '{
      "categories": [
        { "key": "payment", "first_response_hours": 2 },
        { "key": "technical", "first_response_hours": 24 },
        { "key": "account", "first_response_hours": 24 },
        { "key": "general", "first_response_hours": 24 },
        { "key": "course_chat", "first_response_hours": 24 }
      ]
    }'::jsonb
  );
$$;

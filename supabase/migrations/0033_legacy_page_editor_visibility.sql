-- 0033_legacy_page_editor_visibility.sql
-- Controle da visibilidade do editor de páginas legado

insert into public.site_config (config_key, config_value, description, is_public)
values (
  'legacy_page_editor_config',
  '{"enabled": true}'::jsonb,
  'Controle da visibilidade do editor de páginas legado na plataforma admin.',
  false
)
on conflict (config_key) do update
set
  config_value = excluded.config_value,
  description = excluded.description;

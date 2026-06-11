-- 0035_ai_page_editor_provider_order.sql
-- Ajusta a ordem dos provedores do editor IA para OpenAI primário e Gemini fallback

update public.site_config
set config_value = jsonb_set(
  jsonb_set(config_value, '{primary_provider}', '"openai"'::jsonb, true),
  '{fallback_provider}',
  '"gemini"'::jsonb,
  true
)
where config_key = 'ai_page_editor_config';

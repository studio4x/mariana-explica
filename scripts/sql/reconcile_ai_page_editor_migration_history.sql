-- Reconciles the remote Supabase migration history for the managed public page rollout.
-- Run only after confirming that the functional effects of versions 0031-0038 already
-- exist in the target project and must not be re-executed.

insert into supabase_migrations.schema_migrations (version, name, created_by)
values
  ('0031', 'site_page_builder_foundation', null),
  ('0032', 'ai_page_editor', null),
  ('0033', 'legacy_page_editor_visibility', null),
  ('0034', 'ai_page_editor_usage_metrics', null),
  ('0035', 'ai_page_editor_provider_order', null),
  ('0036', 'ai_page_editor_base_prompt_refresh', null),
  ('0037', 'ai_page_editor_intent_contract', null),
  ('0038', 'managed_public_page_slugs', null)
on conflict (version) do update
set name = excluded.name
where supabase_migrations.schema_migrations.name is distinct from excluded.name;

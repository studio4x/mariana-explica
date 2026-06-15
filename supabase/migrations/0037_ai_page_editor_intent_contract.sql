-- 0037_ai_page_editor_intent_contract.sql
-- Contrato híbrido e telemetria de intenção do editor de páginas via IA

alter table public.ai_page_editor_usage_events
  add column if not exists mode text null,
  add column if not exists scope text null,
  add column if not exists risk_level text null,
  add column if not exists target_ids jsonb not null default '[]'::jsonb,
  add column if not exists requires_strict_confirmation boolean not null default false,
  add column if not exists contract_version text null,
  add column if not exists invariants jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_page_editor_usage_events_mode_check'
  ) then
    alter table public.ai_page_editor_usage_events
      add constraint ai_page_editor_usage_events_mode_check
      check (
        mode is null
        or mode in ('text_patch', 'style_patch', 'spacing_patch', 'section_layout_patch', 'section_replace')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_page_editor_usage_events_scope_check'
  ) then
    alter table public.ai_page_editor_usage_events
      add constraint ai_page_editor_usage_events_scope_check
      check (
        scope is null
        or scope in ('text', 'block', 'section', 'page', 'header', 'footer')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_page_editor_usage_events_risk_level_check'
  ) then
    alter table public.ai_page_editor_usage_events
      add constraint ai_page_editor_usage_events_risk_level_check
      check (
        risk_level is null
        or risk_level in ('low', 'medium', 'high')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_page_editor_usage_events_target_ids_array_check'
  ) then
    alter table public.ai_page_editor_usage_events
      add constraint ai_page_editor_usage_events_target_ids_array_check
      check (jsonb_typeof(target_ids) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_page_editor_usage_events_invariants_object_check'
  ) then
    alter table public.ai_page_editor_usage_events
      add constraint ai_page_editor_usage_events_invariants_object_check
      check (jsonb_typeof(invariants) = 'object');
  end if;
end
$$;

create index if not exists ai_page_editor_usage_events_mode_created_at_idx
  on public.ai_page_editor_usage_events (mode, created_at desc);

create index if not exists ai_page_editor_usage_events_scope_created_at_idx
  on public.ai_page_editor_usage_events (scope, created_at desc);

create index if not exists ai_page_editor_usage_events_risk_level_created_at_idx
  on public.ai_page_editor_usage_events (risk_level, created_at desc);


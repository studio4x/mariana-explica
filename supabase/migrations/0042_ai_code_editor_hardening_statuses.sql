-- 0042_ai_code_editor_hardening_statuses.sql
-- Status operacionais e configuracao endurecida do Editor IA Irrestrito

alter table public.ai_code_editor_tasks
  drop constraint if exists ai_code_editor_tasks_status_check;

alter table public.ai_code_editor_tasks
  add constraint ai_code_editor_tasks_status_check check (
    status in (
      'queued',
      'planning',
      'ready_for_review',
      'approved',
      'blocked_provider_quota',
      'ai_generation_unavailable',
      'rejected',
      'needs_adjustment',
      'published',
      'rollback_ready_for_review',
      'rolled_back',
      'failed'
    )
  );

-- 0041_ai_code_editor_worker_columns.sql
-- Campos adicionais para fluxo real do Editor IA Irrestrito

alter table public.ai_code_editor_tasks
  add column if not exists default_branch text null,
  add column if not exists pull_request_number bigint null,
  add column if not exists pull_request_status text null default 'not_opened',
  add column if not exists execution_error text null,
  add column if not exists last_execution_at timestamptz null,
  add column if not exists merged_at timestamptz null;

alter table public.ai_code_editor_file_changes
  add column if not exists diff_patch text null,
  add column if not exists before_sha text null,
  add column if not exists after_sha text null,
  add column if not exists language text null,
  add column if not exists risk_level text null,
  add column if not exists summary text null,
  add column if not exists previous_file_path text null;

alter table public.ai_code_editor_file_changes
  drop constraint if exists ai_code_editor_file_changes_change_type_check;

alter table public.ai_code_editor_file_changes
  add constraint ai_code_editor_file_changes_change_type_check
  check (change_type in ('create', 'modify', 'delete', 'created', 'modified', 'deleted', 'renamed'));

alter table public.ai_code_editor_deploys
  add column if not exists git_branch text null,
  add column if not exists commit_sha text null,
  add column if not exists ready_at timestamptz null,
  add column if not exists error_message text null;

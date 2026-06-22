-- 0040_unrestricted_ai_code_editor.sql
-- MVP do Editor IA Irrestrito / Admin AI Code Editor

create table if not exists public.ai_code_editor_tasks (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid null references public.profiles(id) on delete set null,
  prompt text not null,
  normalized_prompt text not null,
  title text not null,
  summary text not null,
  status text not null default 'ready_for_review',
  scope_classification text not null,
  risk_level text not null,
  worker_mode text not null default 'simulated',
  branch_name text not null,
  commit_message text not null,
  commit_sha text null,
  pull_request_url text null,
  preview_url text null,
  preview_status text not null default 'not_requested',
  test_status text not null default 'not_requested',
  build_status text not null default 'not_requested',
  files_analyzed jsonb not null default '[]'::jsonb,
  files_planned jsonb not null default '[]'::jsonb,
  plan_json jsonb not null default '{}'::jsonb,
  result_summary text null,
  sensitive_change boolean not null default false,
  sensitive_reasons jsonb not null default '[]'::jsonb,
  requires_explicit_publish_confirmation boolean not null default true,
  published_at timestamptz null,
  rolled_back_at timestamptz null,
  approved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_code_editor_tasks_status_check check (
    status in (
      'queued',
      'planning',
      'ready_for_review',
      'approved',
      'rejected',
      'needs_adjustment',
      'published',
      'rolled_back',
      'failed'
    )
  ),
  constraint ai_code_editor_tasks_risk_level_check check (risk_level in ('low', 'medium', 'high')),
  constraint ai_code_editor_tasks_worker_mode_check check (worker_mode in ('simulated', 'github_worker')),
  constraint ai_code_editor_tasks_preview_status_check check (
    preview_status in ('not_requested', 'pending', 'ready', 'failed')
  ),
  constraint ai_code_editor_tasks_test_status_check check (
    test_status in ('not_requested', 'pending', 'passed', 'failed')
  ),
  constraint ai_code_editor_tasks_build_status_check check (
    build_status in ('not_requested', 'pending', 'passed', 'failed')
  )
);

create table if not exists public.ai_code_editor_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_code_editor_tasks(id) on delete cascade,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_code_editor_file_changes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_code_editor_tasks(id) on delete cascade,
  file_path text not null,
  change_type text not null,
  status text not null default 'planned',
  rationale text null,
  diff_preview text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_code_editor_file_changes_change_type_check check (
    change_type in ('create', 'modify', 'delete')
  ),
  constraint ai_code_editor_file_changes_status_check check (
    status in ('planned', 'generated', 'applied', 'reverted')
  )
);

create table if not exists public.ai_code_editor_deploys (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.ai_code_editor_tasks(id) on delete cascade,
  provider text not null,
  environment text not null,
  deployment_id text null,
  deployment_url text null,
  status text not null default 'not_requested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_code_editor_deploys_provider_check check (provider in ('vercel', 'github', 'manual')),
  constraint ai_code_editor_deploys_status_check check (
    status in ('not_requested', 'pending', 'ready', 'failed', 'rolled_back')
  )
);

create index if not exists ai_code_editor_tasks_requested_by_idx
  on public.ai_code_editor_tasks (requested_by);

create index if not exists ai_code_editor_tasks_status_created_at_idx
  on public.ai_code_editor_tasks (status, created_at desc);

create index if not exists ai_code_editor_tasks_updated_at_idx
  on public.ai_code_editor_tasks (updated_at desc);

create index if not exists ai_code_editor_events_task_created_at_idx
  on public.ai_code_editor_events (task_id, created_at asc);

create index if not exists ai_code_editor_file_changes_task_idx
  on public.ai_code_editor_file_changes (task_id);

create index if not exists ai_code_editor_deploys_task_idx
  on public.ai_code_editor_deploys (task_id);

drop trigger if exists ai_code_editor_tasks_updated_at on public.ai_code_editor_tasks;
create trigger ai_code_editor_tasks_updated_at
before update on public.ai_code_editor_tasks
for each row execute function public.set_updated_at();

drop trigger if exists ai_code_editor_file_changes_updated_at on public.ai_code_editor_file_changes;
create trigger ai_code_editor_file_changes_updated_at
before update on public.ai_code_editor_file_changes
for each row execute function public.set_updated_at();

drop trigger if exists ai_code_editor_deploys_updated_at on public.ai_code_editor_deploys;
create trigger ai_code_editor_deploys_updated_at
before update on public.ai_code_editor_deploys
for each row execute function public.set_updated_at();

alter table public.ai_code_editor_tasks enable row level security;
alter table public.ai_code_editor_events enable row level security;
alter table public.ai_code_editor_file_changes enable row level security;
alter table public.ai_code_editor_deploys enable row level security;

drop policy if exists ai_code_editor_tasks_select_admin on public.ai_code_editor_tasks;
create policy ai_code_editor_tasks_select_admin
on public.ai_code_editor_tasks
for select
using (public.is_admin());

drop policy if exists ai_code_editor_tasks_manage_admin on public.ai_code_editor_tasks;
create policy ai_code_editor_tasks_manage_admin
on public.ai_code_editor_tasks
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists ai_code_editor_events_select_admin on public.ai_code_editor_events;
create policy ai_code_editor_events_select_admin
on public.ai_code_editor_events
for select
using (public.is_admin());

drop policy if exists ai_code_editor_events_manage_admin on public.ai_code_editor_events;
create policy ai_code_editor_events_manage_admin
on public.ai_code_editor_events
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists ai_code_editor_file_changes_select_admin on public.ai_code_editor_file_changes;
create policy ai_code_editor_file_changes_select_admin
on public.ai_code_editor_file_changes
for select
using (public.is_admin());

drop policy if exists ai_code_editor_file_changes_manage_admin on public.ai_code_editor_file_changes;
create policy ai_code_editor_file_changes_manage_admin
on public.ai_code_editor_file_changes
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists ai_code_editor_deploys_select_admin on public.ai_code_editor_deploys;
create policy ai_code_editor_deploys_select_admin
on public.ai_code_editor_deploys
for select
using (public.is_admin());

drop policy if exists ai_code_editor_deploys_manage_admin on public.ai_code_editor_deploys;
create policy ai_code_editor_deploys_manage_admin
on public.ai_code_editor_deploys
for all
using (public.is_admin())
with check (public.is_admin());

insert into public.site_config (config_key, config_value, description, is_public)
values (
  'ai_code_editor_config',
  '{
    "enabled": false,
    "make_default": false,
    "legacy_editor_fallback_enabled": true,
    "worker_mode": "simulated",
    "github_repository": "studio4x/mariana-explica",
    "vercel_project_name": "mariana-explica",
    "auto_run_tests": true,
    "auto_run_build": true,
    "request_preview_deploy": true,
    "require_explicit_publish_confirmation": true
  }'::jsonb,
  'Configuração do Editor IA Irrestrito / Admin AI Code Editor.',
  false
)
on conflict (config_key) do update
set
  config_value = excluded.config_value,
  description = excluded.description;

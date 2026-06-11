-- 0034_ai_page_editor_usage_metrics.sql
-- Telemetria de utilizacao e custo estimado do editor de paginas via IA

create table if not exists public.ai_page_editor_usage_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  provider text not null,
  model text not null,
  user_id uuid null references public.profiles(id) on delete set null,
  slug text null,
  path text null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) null,
  currency text not null default 'USD',
  request_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_page_editor_usage_events_action_check
    check (action in ('generate_proposal', 'test_providers')),
  constraint ai_page_editor_usage_events_provider_check
    check (provider in ('gemini', 'openai')),
  constraint ai_page_editor_usage_events_input_tokens_check
    check (input_tokens >= 0),
  constraint ai_page_editor_usage_events_output_tokens_check
    check (output_tokens >= 0),
  constraint ai_page_editor_usage_events_total_tokens_check
    check (total_tokens >= 0),
  constraint ai_page_editor_usage_events_estimated_cost_usd_check
    check (estimated_cost_usd is null or estimated_cost_usd >= 0)
);

create index if not exists ai_page_editor_usage_events_created_at_idx
  on public.ai_page_editor_usage_events (created_at desc);

create index if not exists ai_page_editor_usage_events_action_created_at_idx
  on public.ai_page_editor_usage_events (action, created_at desc);

create index if not exists ai_page_editor_usage_events_provider_model_idx
  on public.ai_page_editor_usage_events (provider, model);

create index if not exists ai_page_editor_usage_events_slug_idx
  on public.ai_page_editor_usage_events (slug);

create index if not exists ai_page_editor_usage_events_user_id_idx
  on public.ai_page_editor_usage_events (user_id);

alter table public.ai_page_editor_usage_events enable row level security;

drop policy if exists ai_page_editor_usage_events_select_admin on public.ai_page_editor_usage_events;
create policy ai_page_editor_usage_events_select_admin
on public.ai_page_editor_usage_events
for select
using (public.is_admin());


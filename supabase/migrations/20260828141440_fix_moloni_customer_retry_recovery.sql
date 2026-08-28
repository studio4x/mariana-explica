-- Restores safe admin retries and separates issue from reconciliation.
-- Customer response/fallback handling lives in the Edge Function so this
-- migration intentionally does not mutate or requeue existing fiscal jobs.

create or replace function public.admin_transition_moloni_job(
  p_fiscal_document_id uuid,
  p_action text,
  p_actor_user_id uuid
)
returns table (
  job_id uuid,
  job_status text,
  document_status text,
  changed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.fiscal_documents%rowtype;
  v_job public.moloni_document_jobs%rowtype;
  v_previous_status text;
  v_previous_attempt_count integer;
  v_previous_job_type text;
begin
  if p_action not in ('retry', 'unblock', 'reconcile', 'cancel') then
    raise exception 'Ação fiscal inválida';
  end if;

  select * into v_document
  from public.fiscal_documents
  where id = p_fiscal_document_id
  for update;

  if not found then
    raise exception 'Documento fiscal não encontrado';
  end if;

  if v_document.status in ('issued', 'credited') or v_document.moloni_document_id is not null then
    raise exception 'Documento já emitido; a operação foi bloqueada';
  end if;

  select * into v_job
  from public.moloni_document_jobs
  where fiscal_document_id = p_fiscal_document_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Tarefa fiscal não encontrada';
  end if;

  v_previous_status := v_job.status;
  v_previous_attempt_count := v_job.attempt_count;
  v_previous_job_type := v_job.job_type;

  if p_action = 'cancel' then
    if v_job.status not in ('pending', 'retry', 'blocked', 'failed', 'cancelled') then
      raise exception 'A tarefa em processamento ou concluída não pode ser cancelada';
    end if;
    update public.moloni_document_jobs
    set
      status = 'cancelled',
      locked_at = null,
      locked_by = null,
      cancelled_at = coalesce(cancelled_at, now()),
      last_admin_action = 'cancel',
      last_admin_action_by = p_actor_user_id,
      last_admin_action_at = now()
    where id = v_job.id;

    update public.fiscal_documents
    set
      status = 'cancelled_before_issue',
      last_error_code = 'ADMIN_CANCELLED',
      last_error_message = 'Emissão cancelada de forma segura por uma administradora.'
    where id = v_document.id;
  else
    if v_job.status in ('processing', 'completed', 'cancelled') then
      raise exception 'A tarefa não pode ser alterada no estado atual';
    end if;
    update public.moloni_document_jobs
    set
      job_type = case when p_action = 'reconcile' then 'reconcile_document' else 'issue_document' end,
      status = 'retry',
      attempt_count = 0,
      available_at = now(),
      locked_at = null,
      locked_by = null,
      result_uncertain = (p_action = 'reconcile'),
      last_admin_action = p_action,
      last_admin_action_by = p_actor_user_id,
      last_admin_action_at = now()
    where id = v_job.id;

    update public.fiscal_documents
    set status = 'pending'
    where id = v_document.id;
  end if;

  return query
  select
    jobs.id,
    jobs.status,
    documents.status,
    v_previous_status is distinct from jobs.status
      or v_previous_attempt_count is distinct from jobs.attempt_count
      or v_previous_job_type is distinct from jobs.job_type
  from public.moloni_document_jobs jobs
  join public.fiscal_documents documents on documents.id = jobs.fiscal_document_id
  where jobs.id = v_job.id;
end;
$$;

revoke all on function public.admin_transition_moloni_job(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_transition_moloni_job(uuid, text, uuid)
  to service_role;

comment on function public.admin_transition_moloni_job(uuid, text, uuid) is
  'Transitions an unissued fiscal job under lock; admin retries receive a fresh attempt budget, preserve diagnostics, and reconciliation never changes to issue mode.';

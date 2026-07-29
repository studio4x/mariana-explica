create or replace function public.prevent_fiscal_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_draft_homologation_reset boolean;
begin
  v_draft_homologation_reset :=
    coalesce(current_setting('app.allow_moloni_draft_snapshot_reset', true), '') = 'on'
    and old.source_payment_environment = 'test'
    and new.source_payment_environment = 'test'
    and old.environment = 'draft'
    and new.environment = 'draft'
    and old.moloni_document_id is null
    and new.moloni_document_id is null
    and old.status not in ('issued', 'credited')
    and new.status = 'pending'
    and new.fiscal_snapshot is null
    and new.fiscal_snapshot_locked_at is null;

  if old.fiscal_snapshot is not null
    and new.fiscal_snapshot is distinct from old.fiscal_snapshot
    and not v_draft_homologation_reset
  then
    raise exception 'fiscal_snapshot is immutable after capture';
  end if;

  if old.fiscal_snapshot_locked_at is not null
    and new.fiscal_snapshot_locked_at is distinct from old.fiscal_snapshot_locked_at
    and not v_draft_homologation_reset
  then
    raise exception 'fiscal_snapshot_locked_at is immutable after capture';
  end if;

  return new;
end;
$$;

create or replace function public.claim_moloni_draft_homologation(
  p_fiscal_document_id uuid,
  p_worker_id text,
  p_stale_after_seconds integer default 300
)
returns public.moloni_document_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document public.fiscal_documents%rowtype;
  v_job public.moloni_document_jobs%rowtype;
  v_stale_after_seconds integer;
begin
  if p_fiscal_document_id is null then
    raise exception 'Documento de teste não informado';
  end if;

  if nullif(trim(p_worker_id), '') is null then
    raise exception 'Identificador do processamento não informado';
  end if;

  v_stale_after_seconds := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 300), 3600)
  );

  select *
  into v_document
  from public.fiscal_documents
  where id = p_fiscal_document_id
  for update;

  if not found then
    raise exception 'Documento de teste não encontrado';
  end if;

  if v_document.source_payment_environment <> 'test'
    or v_document.environment <> 'draft'
    or v_document.moloni_document_id is not null
    or v_document.status in ('issued', 'credited')
  then
    raise exception 'A homologação aceita somente pedido Stripe test e documento Moloni não emitido em rascunho';
  end if;

  select *
  into v_job
  from public.moloni_document_jobs
  where fiscal_document_id = v_document.id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Tarefa fiscal de teste não encontrada';
  end if;

  if v_job.status = 'completed' then
    raise exception 'O documento de teste já foi concluído';
  end if;

  if v_job.status = 'cancelled' then
    raise exception 'O documento de teste foi cancelado';
  end if;

  if v_job.status = 'processing'
    and (
      coalesce(v_job.locked_by, '') not like 'admin-draft:%'
      or v_job.locked_at is null
      or v_job.locked_at >= now() - make_interval(secs => v_stale_after_seconds)
    )
  then
    raise exception 'O documento de teste já está em processamento';
  end if;

  if v_job.status not in ('pending', 'retry', 'blocked', 'failed', 'processing') then
    raise exception 'O documento de teste não pode ser processado no estado atual';
  end if;

  perform set_config('app.allow_moloni_draft_snapshot_reset', 'on', true);

  update public.fiscal_documents
  set
    status = 'pending',
    fiscal_snapshot = null,
    selected_fiscal_rule_id = null,
    fiscal_selection_reason = null,
    fiscal_snapshot_locked_at = null,
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
  where id = v_document.id;

  perform set_config('app.allow_moloni_draft_snapshot_reset', 'off', true);

  update public.moloni_document_jobs
  set
    status = 'processing',
    locked_at = now(),
    locked_by = trim(p_worker_id),
    attempt_count = attempt_count + 1,
    available_at = now(),
    result_uncertain = false,
    last_http_status = null,
    last_error_code = null,
    last_error = null,
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_moloni_draft_homologation(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_moloni_draft_homologation(uuid, text, integer)
  to service_role;

comment on function public.claim_moloni_draft_homologation(uuid, text, integer) is
  'Atomically resets an unissued Stripe-test/Moloni-draft fiscal snapshot and claims its job, recovering only stale admin homologation locks.';

comment on column public.fiscal_documents.fiscal_snapshot is
  'Immutable fiscal inputs captured before Moloni emission; reset is allowed only by the service-role draft homologation claim for an unissued Stripe test document.';

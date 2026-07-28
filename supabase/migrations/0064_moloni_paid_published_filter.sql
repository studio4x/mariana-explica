-- Keep automatic Moloni checklist verification scoped to paid published products only.

create or replace function public.sync_moloni_automatic_checklist(
  p_payment_environment text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.moloni_fiscal_settings%rowtype;
  v_test_settings public.moloni_fiscal_settings%rowtype;
  v_item public.moloni_fiscal_checklist_items%rowtype;
  v_key text;
  v_label text;
  v_reason text;
  v_evidence jsonb;
  v_hash text;
  v_approved jsonb := '[]'::jsonb;
  v_pending jsonb := '[]'::jsonb;
  v_updated_count integer := 0;
  v_total_count integer := 0;
  v_published_count integer := 0;
  v_mapped_count integer := 0;
  v_mapping_evidence jsonb := '[]'::jsonb;
  v_products_validated boolean := false;
  v_document_sets_validated boolean := false;
  v_mappings_validated boolean := false;
  v_draft_validation_id uuid;
  v_fiscal_checklist_approved boolean;
begin
  if p_payment_environment not in ('test', 'live') then
    raise exception 'Ambiente Moloni invalido';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('moloni-checklist-dependencies:' || p_payment_environment)
  );

  select * into v_settings
  from public.moloni_fiscal_settings
  where payment_environment = p_payment_environment
  for update;
  if not found then
    raise exception 'Configuracao fiscal Moloni nao encontrada';
  end if;

  select * into v_test_settings
  from public.moloni_fiscal_settings
  where payment_environment = 'test';

  select count(*) into v_published_count
  from public.products
  where status = 'published'
    and product_type in ('paid', 'hybrid')
    and coalesce(price_cents, 0) > 0;

  select count(*) into v_mapped_count
  from public.products products
  where products.status = 'published'
    and products.product_type in ('paid', 'hybrid')
    and coalesce(products.price_cents, 0) > 0
    and exists (
      select 1 from public.moloni_product_mappings mappings
      where mappings.product_id = products.id
        and mappings.payment_environment = p_payment_environment
        and mappings.is_active
        and mappings.moloni_company_id = v_settings.moloni_company_id
        and mappings.moloni_product_id > 0
        and mappings.moloni_document_set_id > 0
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', mappings.product_id,
        'moloni_product_id', mappings.moloni_product_id,
        'moloni_document_set_id', mappings.moloni_document_set_id
      ) order by mappings.product_id
    ),
    '[]'::jsonb
  ) into v_mapping_evidence
  from public.moloni_product_mappings mappings
  join public.products products on products.id = mappings.product_id
  where products.status = 'published'
    and products.product_type in ('paid', 'hybrid')
    and coalesce(products.price_cents, 0) > 0
    and mappings.payment_environment = p_payment_environment
    and mappings.is_active
    and mappings.moloni_company_id = v_settings.moloni_company_id;

  select coalesce((
    select case
      when validation.status = 'passed'
        and case
          when validation.details ->> 'company_id' ~ '^[0-9]+$'
            then (validation.details ->> 'company_id')::integer
          else null
        end is not distinct from v_settings.moloni_company_id
      then true else false end
    from public.moloni_validation_runs validation
    where validation.payment_environment = p_payment_environment
      and validation.validation_type = 'products'
    order by validation.created_at desc
    limit 1
  ), false) into v_products_validated;

  select coalesce((
    select case
      when validation.status = 'passed'
        and case
          when validation.details ->> 'company_id' ~ '^[0-9]+$'
            then (validation.details ->> 'company_id')::integer
          else null
        end is not distinct from v_settings.moloni_company_id
      then true else false end
    from public.moloni_validation_runs validation
    where validation.payment_environment = p_payment_environment
      and validation.validation_type = 'document_sets'
    order by validation.created_at desc
    limit 1
  ), false) into v_document_sets_validated;

  select coalesce((
    select case when validation.status = 'passed' then true else false end
    from public.moloni_validation_runs validation
    where validation.payment_environment = p_payment_environment
      and validation.validation_type = 'mappings'
    order by validation.created_at desc
    limit 1
  ), false) into v_mappings_validated;

  select validation.id into v_draft_validation_id
  from public.moloni_validation_runs validation
  where validation.payment_environment = 'test'
    and validation.validation_type = 'draft_document'
    and validation.status = 'passed'
  order by validation.created_at desc
  limit 1;

  for v_key in
    select unnest(array[
      'immediate_payment_document',
      'production_document_set',
      'homologation_strategy',
      'moloni_products',
      'automatic_closing',
      'customer_pdf_delivery'
    ])
  loop
    select * into v_item
    from public.moloni_fiscal_checklist_items
    where payment_environment = p_payment_environment
      and item_key = v_key
      and is_automatic
    for update;
    if not found then
      continue;
    end if;
    v_total_count := v_total_count + 1;
    v_label := null;
    v_reason := null;
    v_evidence := null;

    if v_key = 'immediate_payment_document' then
      if v_settings.document_kind is null then
        v_reason := 'Configure o documento fiscal para pagamento imediato.';
      else
        v_label := case v_settings.document_kind
          when 'invoice_receipt' then 'Fatura-recibo'
          else 'Fatura'
        end;
        v_evidence := jsonb_build_object(
          'policy_version', 'moloni-automatic-checklist-v1',
          'document_kind', v_settings.document_kind,
          'settings_updated_at', v_settings.updated_at
        );
      end if;
    elsif v_key = 'production_document_set' then
      if v_published_count = 0 then
        v_reason := 'Nao existem produtos pagos publicados para validar.';
      elsif v_mapped_count <> v_published_count or not v_document_sets_validated or not v_mappings_validated then
        v_reason := 'Todos os produtos pagos precisam de mapeamento, serie e validacoes Moloni atuais.';
      else
        v_label := format('%s serie(s) documental(is) validada(s)',
          (select count(distinct moloni_document_set_id)
           from public.moloni_product_mappings mappings
           join public.products products on products.id = mappings.product_id
           where products.status = 'published'
             and products.product_type in ('paid', 'hybrid')
             and coalesce(products.price_cents, 0) > 0
             and mappings.payment_environment = p_payment_environment
             and mappings.is_active));
        v_evidence := jsonb_build_object(
          'policy_version', 'moloni-automatic-checklist-v1',
          'company_id', v_settings.moloni_company_id,
          'published_product_count', v_published_count,
          'mapping_count', v_mapped_count,
          'mapping_evidence', v_mapping_evidence
        );
      end if;
    elsif v_key = 'homologation_strategy' then
      if v_test_settings.moloni_environment <> 'draft' or v_test_settings.document_status <> 0 then
        v_reason := 'O ambiente de teste precisa permanecer em rascunho para homologacao segura.';
      elsif v_draft_validation_id is null then
        v_reason := 'Conclua um teste documental aprovado em rascunho.';
      else
        v_label := 'Stripe teste isolado, documento em rascunho e homologacao concluida';
        v_evidence := jsonb_build_object(
          'policy_version', 'moloni-automatic-checklist-v1',
          'draft_validation_id', v_draft_validation_id,
          'test_settings_updated_at', v_test_settings.updated_at
        );
      end if;
    elsif v_key = 'moloni_products' then
      if v_published_count = 0 then
        v_reason := 'Nao existem produtos pagos publicados para validar.';
      elsif v_mapped_count <> v_published_count or not v_products_validated or not v_mappings_validated then
        v_reason := 'Todos os produtos pagos precisam de artigo Moloni e validacoes atuais.';
      else
        v_label := format('%s produto(s) pago(s) publicado(s) ligado(s) e validado(s)', v_published_count);
        v_evidence := jsonb_build_object(
          'policy_version', 'moloni-automatic-checklist-v1',
          'company_id', v_settings.moloni_company_id,
          'published_product_count', v_published_count,
          'mapping_count', v_mapped_count,
          'mapping_evidence', v_mapping_evidence
        );
      end if;
    elsif v_key = 'automatic_closing' then
      v_label := case v_settings.document_status
        when 1 then 'Fechar automaticamente apos emissao'
        else 'Manter em rascunho'
      end;
      v_evidence := jsonb_build_object(
        'policy_version', 'moloni-automatic-checklist-v1',
        'document_status', v_settings.document_status,
        'settings_updated_at', v_settings.updated_at
      );
    elsif v_key = 'customer_pdf_delivery' then
      if v_settings.pdf_delivery_policy not in ('private_storage', 'backend_proxy') then
        v_reason := 'A politica de entrega do PDF fiscal nao esta configurada.';
      else
        v_label := case v_settings.pdf_delivery_policy
          when 'private_storage' then 'PDF protegido em storage privado'
          else 'PDF protegido por proxy backend'
        end;
        v_evidence := jsonb_build_object(
          'policy_version', 'moloni-automatic-checklist-pdf-v1',
          'pdf_delivery_policy', v_settings.pdf_delivery_policy
        );
      end if;
    end if;

    if v_evidence is not null then
      v_hash := md5(v_evidence::text);
    else
      v_hash := null;
    end if;

    if v_reason is null then
      v_approved := v_approved || jsonb_build_array(
        jsonb_build_object('item_key', v_key, 'label', v_label)
      );
      if v_item.status is distinct from 'approved'
        or v_item.evidence_hash is distinct from v_hash
        or v_item.stale_reason is not null
      then
        perform set_config('app.moloni_automatic_checklist_sync', 'on', true);
        update public.moloni_fiscal_checklist_items
        set
          status = 'approved',
          configuration = jsonb_build_object('value', v_label),
          approved_by = p_actor_user_id,
          approved_at = now(),
          updated_by = p_actor_user_id,
          evidence_snapshot = v_evidence,
          evidence_hash = v_hash,
          current_evidence_snapshot = v_evidence,
          current_evidence_hash = v_hash,
          evidence_checked_at = now(),
          stale_reason = null,
          invalidated_at = null,
          invalidated_by = null
        where id = v_item.id;
        v_updated_count := v_updated_count + 1;
      end if;
    else
      v_pending := v_pending || jsonb_build_array(
        jsonb_build_object('item_key', v_key, 'reason', v_reason)
      );
      if v_item.status is distinct from 'pending'
        or v_item.stale_reason is distinct from v_reason
        or v_item.current_evidence_hash is distinct from v_hash
      then
        perform set_config('app.moloni_automatic_checklist_sync', 'on', true);
        update public.moloni_fiscal_checklist_items
        set
          status = 'pending',
          configuration = null,
          approved_by = null,
          approved_at = null,
          updated_by = p_actor_user_id,
          current_evidence_snapshot = v_evidence,
          current_evidence_hash = v_hash,
          evidence_checked_at = now(),
          stale_reason = left(v_reason, 500),
          invalidated_at = coalesce(invalidated_at, now()),
          invalidated_by = coalesce(invalidated_by, p_actor_user_id)
        where id = v_item.id;
        v_updated_count := v_updated_count + 1;
      end if;
    end if;
  end loop;

  v_fiscal_checklist_approved := public.refresh_moloni_checklist_approval(p_payment_environment);

  return jsonb_build_object(
    'approved_items', v_approved,
    'pending_items', v_pending,
    'updated_count', v_updated_count,
    'total_automatic_items', v_total_count,
    'fiscal_checklist_approved', v_fiscal_checklist_approved
  );
end;
$$;

-- Checklist automático Moloni: evidência server-side, invalidação por dependência
-- e sincronização transacional. Nenhuma operação deste arquivo emite documentos.

alter table public.moloni_fiscal_checklist_items
  add column if not exists is_automatic boolean not null default false,
  add column if not exists evidence_snapshot jsonb null,
  add column if not exists evidence_hash text null,
  add column if not exists current_evidence_snapshot jsonb null,
  add column if not exists current_evidence_hash text null,
  add column if not exists evidence_checked_at timestamptz null,
  add column if not exists stale_reason text null,
  add column if not exists invalidated_at timestamptz null,
  add column if not exists invalidated_by uuid null references public.profiles(id) on delete set null;

update public.moloni_fiscal_checklist_items
set is_automatic = true
where item_key in (
  'immediate_payment_document',
  'production_document_set',
  'homologation_strategy',
  'moloni_products',
  'automatic_closing',
  'customer_pdf_delivery'
);

-- Aprovações automáticas antigas não possuem evidência server-side verificável.
update public.moloni_fiscal_checklist_items
set
  status = 'pending',
  configuration = null,
  approved_by = null,
  approved_at = null,
  stale_reason = 'Requer nova verificação automática pelo backend.',
  invalidated_at = now(),
  current_evidence_snapshot = null,
  current_evidence_hash = null
where is_automatic
  and status = 'approved'
  and evidence_hash is null;

create index if not exists moloni_checklist_automatic_status_idx
  on public.moloni_fiscal_checklist_items (payment_environment, is_automatic, status);

create or replace function public.set_moloni_checklist_canonical_text()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  case new.item_key
    when 'immediate_payment_document' then
      new.title := 'Documento para pagamento imediato';
      new.description := 'Definir fatura-recibo ou fatura seguida de recibo.';
      new.is_automatic := true;
    when 'production_document_set' then
      new.title := 'Série de produção';
      new.description := 'Confirmar a série documental que será usada em produção.';
      new.is_automatic := true;
    when 'homologation_strategy' then
      new.title := 'Estratégia de homologação';
      new.description := 'Definir empresa, série e regra de rascunho para testes seguros.';
      new.is_automatic := true;
    when 'moloni_products' then
      new.title := 'Artigos Moloni';
      new.description := 'Confirmar os artigos correspondentes aos produtos digitais.';
      new.is_automatic := true;
    when 'automatic_closing' then
      new.title := 'Fechamento automático';
      new.description := 'Definir se o documento deve ser fechado ou permanecer em rascunho.';
      new.is_automatic := true;
    when 'customer_pdf_delivery' then
      new.title := 'Envio do PDF ao cliente';
      new.description := 'Definir a política de disponibilização do documento fiscal.';
      new.is_automatic := true;
    when 'buyer_without_vat' then
      new.title := 'Comprador sem NIF';
      new.description := 'Definir a regra fiscal aplicável quando o comprador não indicar NIF.';
    when 'individual_required_data' then
      new.title := 'Dados de pessoa singular';
      new.description := 'Definir os dados obrigatórios para compradores particulares.';
    when 'company_required_data' then
      new.title := 'Dados de empresa';
      new.description := 'Definir os dados obrigatórios para compradores empresariais.';
    when 'eac' then
      new.title := 'CAE aplicável';
      new.description := 'Confirmar o CAE aplicável ou registar que não se aplica.';
    when 'portugal_vat' then
      new.title := 'IVA em Portugal';
      new.description := 'Definir a taxa e a regra de IVA para vendas em Portugal.';
    when 'international_sales' then
      new.title := 'Vendas internacionais';
      new.description := 'Definir o tratamento fiscal de compradores de outros países.';
    when 'eu_b2b_b2c_oss' then
      new.title := 'B2B/B2C intracomunitário e OSS';
      new.description := 'Definir as regras intracomunitárias e eventual utilização de OSS.';
    when 'exemptions' then
      new.title := 'Isenções';
      new.description := 'Definir os motivos legais de isenção ou registar que não se aplicam.';
    when 'full_refund' then
      new.title := 'Reembolso total';
      new.description := 'Definir o documento retificativo exigido num reembolso total.';
    when 'partial_refund' then
      new.title := 'Reembolso parcial';
      new.description := 'Definir o documento retificativo exigido num reembolso parcial.';
    when 'chargeback' then
      new.title := 'Chargeback e disputa';
      new.description := 'Definir o tratamento contabilístico de disputas e perdas definitivas.';
    when 'tax_authority_communication' then
      new.title := 'Comunicação à Autoridade Tributária';
      new.description := 'Confirmar a configuração de comunicação fiscal na conta Moloni.';
    else
      null;
  end case;
  return new;
end;
$$;

drop trigger if exists moloni_checklist_canonical_text
  on public.moloni_fiscal_checklist_items;
create trigger moloni_checklist_canonical_text
before insert or update on public.moloni_fiscal_checklist_items
for each row execute function public.set_moloni_checklist_canonical_text();

create or replace function public.refresh_moloni_checklist_approval(p_payment_environment text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approved boolean;
begin
  select
    count(*) > 0
    and count(*) filter (
      where is_blocking
        and (
          status <> 'approved'
          or (is_automatic and (evidence_hash is null or stale_reason is not null))
        )
    ) = 0
  into v_approved
  from public.moloni_fiscal_checklist_items
  where payment_environment = p_payment_environment
    and is_blocking;

  update public.moloni_fiscal_settings
  set
    fiscal_checklist_approved = coalesce(v_approved, false),
    emission_enabled = case
      when coalesce(v_approved, false) then emission_enabled
      else false
    end,
    deactivated_at = case
      when not coalesce(v_approved, false) and emission_enabled then now()
      else deactivated_at
    end
  where payment_environment = p_payment_environment;

  return coalesce(v_approved, false);
end;
$$;

create or replace function public.invalidate_moloni_checklist_dependencies(
  p_payment_environment text,
  p_item_keys text[],
  p_reason text,
  p_actor_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.moloni_fiscal_checklist_items%rowtype;
  v_actor_role text;
  v_count integer := 0;
begin
  if p_payment_environment not in ('test', 'live') then
    raise exception 'Ambiente Moloni inválido';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('moloni-checklist-dependencies:' || p_payment_environment)
  );

  if p_actor_user_id is not null then
    select role into v_actor_role
    from public.profiles
    where id = p_actor_user_id;
  end if;

  for v_item in
    select *
    from public.moloni_fiscal_checklist_items
    where payment_environment = p_payment_environment
      and is_automatic
      and item_key = any(p_item_keys)
    for update
  loop
    if v_item.status <> 'pending'
      or v_item.approved_by is not null
      or v_item.approved_at is not null
      or v_item.stale_reason is distinct from p_reason
    then
      update public.moloni_fiscal_checklist_items
      set
        status = 'pending',
        configuration = null,
        approved_by = null,
        approved_at = null,
        stale_reason = left(p_reason, 500),
        invalidated_at = now(),
        invalidated_by = p_actor_user_id,
        current_evidence_snapshot = null,
        current_evidence_hash = null,
        updated_by = p_actor_user_id
      where id = v_item.id;

      insert into public.audit_logs (
        actor_user_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        p_actor_user_id,
        v_actor_role,
        'admin.moloni_checklist_invalidated',
        'moloni_fiscal_checklist',
        v_item.id,
        jsonb_build_object(
          'payment_environment', p_payment_environment,
          'item_key', v_item.item_key,
          'reason', left(p_reason, 500),
          'previous_status', v_item.status,
          'evidence_preserved', true
        )
      );
      v_count := v_count + 1;
    end if;
  end loop;

  perform public.refresh_moloni_checklist_approval(p_payment_environment);
  return v_count;
end;
$$;

create or replace function public.prevent_manual_moloni_automatic_checklist_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_automatic
    and new.status in ('filled', 'approved')
    and current_setting('app.moloni_automatic_checklist_sync', true) <> 'on'
  then
    raise exception 'Itens automáticos só podem ser aprovados pela verificação server-side';
  end if;
  return new;
end;
$$;

drop trigger if exists moloni_checklist_prevent_manual_automatic_approval
  on public.moloni_fiscal_checklist_items;
create trigger moloni_checklist_prevent_manual_automatic_approval
before insert or update on public.moloni_fiscal_checklist_items
for each row execute function public.prevent_manual_moloni_automatic_checklist_approval();

create or replace function public.invalidate_moloni_checklist_on_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_keys text[] := array[]::text[];
  v_reason text := null;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.document_kind is distinct from new.document_kind then
    v_keys := v_keys || 'immediate_payment_document';
    v_reason := 'O tipo de documento fiscal foi alterado.';
  end if;
  if old.document_status is distinct from new.document_status then
    v_keys := v_keys || array['automatic_closing', 'homologation_strategy'];
    v_reason := coalesce(v_reason || ' ', '') || 'O estado do documento fiscal foi alterado.';
  end if;
  if old.moloni_company_id is distinct from new.moloni_company_id then
    v_keys := v_keys || array['production_document_set', 'moloni_products', 'homologation_strategy'];
    v_reason := coalesce(v_reason || ' ', '') || 'A empresa Moloni foi alterada.';
  end if;
  if old.moloni_environment is distinct from new.moloni_environment then
    v_keys := v_keys || 'homologation_strategy';
    v_reason := coalesce(v_reason || ' ', '') || 'O ambiente Moloni foi alterado.';
  end if;
  if old.pdf_delivery_policy is distinct from new.pdf_delivery_policy then
    v_keys := v_keys || 'customer_pdf_delivery';
    v_reason := coalesce(v_reason || ' ', '') || 'A política de entrega do PDF foi alterada.';
  end if;

  if cardinality(v_keys) > 0 then
    perform public.invalidate_moloni_checklist_dependencies(
      new.payment_environment,
      array(select distinct unnest(v_keys)),
      coalesce(v_reason, 'A configuração fiscal relevante foi alterada.'),
      new.updated_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists moloni_checklist_invalidate_on_settings_change
  on public.moloni_fiscal_settings;
create trigger moloni_checklist_invalidate_on_settings_change
after update on public.moloni_fiscal_settings
for each row execute function public.invalidate_moloni_checklist_on_settings_change();

create or replace function public.invalidate_moloni_checklist_on_mapping_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_environment text := case when tg_op = 'DELETE' then old.payment_environment else new.payment_environment end;
  v_actor uuid := case when tg_op = 'DELETE' then old.updated_by else coalesce(new.updated_by, new.created_by) end;
begin
  perform public.invalidate_moloni_checklist_dependencies(
    v_environment,
    array['moloni_products', 'production_document_set'],
    'Um mapeamento Moloni foi criado, alterado, desativado ou removido.',
    v_actor
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists moloni_checklist_invalidate_on_mapping_change
  on public.moloni_product_mappings;
create trigger moloni_checklist_invalidate_on_mapping_change
after insert or update or delete on public.moloni_product_mappings
for each row execute function public.invalidate_moloni_checklist_on_mapping_change();

create or replace function public.invalidate_moloni_checklist_on_connection_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_environment text := case when tg_op = 'DELETE' then old.environment else new.environment end;
  v_payment_environment text := case when v_environment = 'draft' then 'test' else 'live' end;
begin
  perform public.invalidate_moloni_checklist_dependencies(
    v_payment_environment,
    array['moloni_products', 'production_document_set', 'homologation_strategy'],
    'A ligação ou a empresa Moloni foi alterada.',
    null
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists moloni_checklist_invalidate_on_connection_change
  on public.moloni_connections;
create trigger moloni_checklist_invalidate_on_connection_change
after insert or update or delete on public.moloni_connections
for each row execute function public.invalidate_moloni_checklist_on_connection_change();

create or replace function public.invalidate_moloni_checklist_on_validation_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_keys text[] := array[]::text[];
begin
  if new.validation_type in ('products', 'mappings') then
    v_keys := v_keys || 'moloni_products';
  end if;
  if new.validation_type in ('document_sets', 'mappings') then
    v_keys := v_keys || 'production_document_set';
  end if;
  if new.validation_type = 'draft_document' then
    v_keys := v_keys || 'homologation_strategy';
  end if;
  if new.validation_type = 'company' then
    v_keys := v_keys || array['moloni_products', 'production_document_set', 'homologation_strategy'];
  end if;

  if cardinality(v_keys) > 0 then
    perform public.invalidate_moloni_checklist_dependencies(
      new.payment_environment,
      array(select distinct unnest(v_keys)),
      'Uma validação administrativa relacionada foi atualizada; é necessária nova verificação automática.',
      new.created_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists moloni_checklist_invalidate_on_validation_change
  on public.moloni_validation_runs;
create trigger moloni_checklist_invalidate_on_validation_change
after insert or update on public.moloni_validation_runs
for each row execute function public.invalidate_moloni_checklist_on_validation_change();

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
    raise exception 'Ambiente Moloni inválido';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('moloni-checklist-dependencies:' || p_payment_environment)
  );

  select * into v_settings
  from public.moloni_fiscal_settings
  where payment_environment = p_payment_environment
  for update;
  if not found then
    raise exception 'Configuração fiscal Moloni não encontrada';
  end if;

  select * into v_test_settings
  from public.moloni_fiscal_settings
  where payment_environment = 'test';

  select count(*) into v_published_count
  from public.products
  where status = 'published' and product_type in ('paid', 'hybrid');

  select count(*) into v_mapped_count
  from public.products products
  where products.status = 'published'
    and products.product_type in ('paid', 'hybrid')
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
        v_reason := 'Não existem produtos pagos publicados para validar.';
      elsif v_mapped_count <> v_published_count or not v_document_sets_validated or not v_mappings_validated then
        v_reason := 'Todos os produtos pagos precisam de mapeamento, série e validações Moloni atuais.';
      else
        v_label := format('%s série(s) documental(is) validada(s)',
          (select count(distinct moloni_document_set_id)
           from public.moloni_product_mappings mappings
           join public.products products on products.id = mappings.product_id
           where products.status = 'published'
             and products.product_type in ('paid', 'hybrid')
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
        v_reason := 'O ambiente de teste precisa permanecer em rascunho para homologação segura.';
      elsif v_draft_validation_id is null then
        v_reason := 'Conclua um teste documental aprovado em rascunho.';
      else
        v_label := 'Stripe teste isolado, documento em rascunho e homologação concluída';
        v_evidence := jsonb_build_object(
          'policy_version', 'moloni-automatic-checklist-v1',
          'draft_validation_id', v_draft_validation_id,
          'test_settings_updated_at', v_test_settings.updated_at
        );
      end if;
    elsif v_key = 'moloni_products' then
      if v_published_count = 0 then
        v_reason := 'Não existem produtos pagos publicados para validar.';
      elsif v_mapped_count <> v_published_count or not v_products_validated or not v_mappings_validated then
        v_reason := 'Todos os produtos pagos precisam de artigo Moloni e validações atuais.';
      else
        v_label := format('%s produto(s) publicado(s) ligado(s) e validado(s)', v_published_count);
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
        when 1 then 'Fechar automaticamente após emissão'
        else 'Manter em rascunho'
      end;
      v_evidence := jsonb_build_object(
        'policy_version', 'moloni-automatic-checklist-v1',
        'document_status', v_settings.document_status,
        'settings_updated_at', v_settings.updated_at
      );
    elsif v_key = 'customer_pdf_delivery' then
      if v_settings.pdf_delivery_policy not in ('private_storage', 'backend_proxy') then
        v_reason := 'A política de entrega do PDF fiscal não está configurada.';
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

revoke all on function public.invalidate_moloni_checklist_dependencies(text, text[], text, uuid)
  from public, anon, authenticated;
revoke all on function public.sync_moloni_automatic_checklist(text, uuid)
  from public, anon, authenticated;
grant execute on function public.invalidate_moloni_checklist_dependencies(text, text[], text, uuid)
  to service_role;
grant execute on function public.sync_moloni_automatic_checklist(text, uuid)
  to service_role;

select public.refresh_moloni_checklist_approval('test');
select public.refresh_moloni_checklist_approval('live');

do $$
begin
  if exists (
    select 1
    from public.moloni_fiscal_checklist_items
    where title like '%' || chr(65533) || '%'
       or description like '%' || chr(65533) || '%'
  ) then
    raise exception 'Checklist fiscal contém caractere de substituição UTF-8';
  end if;
end;
$$;

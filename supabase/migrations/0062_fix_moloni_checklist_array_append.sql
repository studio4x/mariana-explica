-- Corrige a concatenação de textos com arrays nos triggers do checklist Moloni.
-- A concatenação text[] || text fazia o PostgreSQL interpretar a chave como
-- literal de array e falhar com "malformed array literal".

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
    v_keys := array_append(v_keys, 'immediate_payment_document');
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
    v_keys := array_append(v_keys, 'homologation_strategy');
    v_reason := coalesce(v_reason || ' ', '') || 'O ambiente Moloni foi alterado.';
  end if;
  if old.pdf_delivery_policy is distinct from new.pdf_delivery_policy then
    v_keys := array_append(v_keys, 'customer_pdf_delivery');
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
    v_keys := array_append(v_keys, 'moloni_products');
  end if;
  if new.validation_type in ('document_sets', 'mappings') then
    v_keys := array_append(v_keys, 'production_document_set');
  end if;
  if new.validation_type = 'draft_document' then
    v_keys := array_append(v_keys, 'homologation_strategy');
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

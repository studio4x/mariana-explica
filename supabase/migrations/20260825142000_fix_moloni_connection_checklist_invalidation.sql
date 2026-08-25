-- Keep Moloni checklist evidence stable during routine token and health updates.
-- Only connection identity or availability changes require fiscal revalidation.

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
  if tg_op = 'UPDATE' then
    if new.environment is not distinct from old.environment
      and new.status is not distinct from old.status
      and new.moloni_company_id is not distinct from old.moloni_company_id
    then
      return new;
    end if;
  end if;

  perform public.invalidate_moloni_checklist_dependencies(
    v_payment_environment,
    array['moloni_products', 'production_document_set', 'homologation_strategy'],
    'A ligação ou a empresa Moloni foi alterada.',
    null
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.invalidate_moloni_checklist_on_connection_change() is
  'Invalidates automatic fiscal evidence only when Moloni connection identity or availability changes; ignores token expiry, last-success and diagnostic metadata updates.';

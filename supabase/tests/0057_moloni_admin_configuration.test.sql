begin;

do $$
declare
  policy_count integer;
  transition_definition text;
  activation_definition text;
begin
  if to_regclass('private.moloni_app_credentials') is null then
    raise exception 'moloni_app_credentials must remain in the private schema';
  end if;

  if (select count(*) from public.moloni_fiscal_checklist_items) <> 36 then
    raise exception 'the two environments must have all 18 checklist decisions';
  end if;

  if exists (select 1 from public.moloni_fiscal_settings where emission_enabled) then
    raise exception 'the migration must never enable fiscal emission';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.moloni_fiscal_checklist_items'::regclass
  ) then
    raise exception 'checklist RLS is disabled';
  end if;

  select count(*)
  into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'moloni_fiscal_checklist_items',
      'moloni_validation_runs',
      'moloni_activation_events'
    );

  if policy_count <> 3 then
    raise exception 'expected one admin read policy for every new public table';
  end if;

  if has_function_privilege('anon', 'public.get_moloni_app_credentials()', 'EXECUTE')
    or has_function_privilege(
      'authenticated',
      'public.store_moloni_app_credentials(text,text,text,uuid)',
      'EXECUTE'
    )
    or has_function_privilege('authenticated', 'public.activate_moloni_live(uuid)', 'EXECUTE')
    or has_function_privilege(
      'authenticated',
      'public.deactivate_moloni_emission(text,uuid)',
      'EXECUTE'
    )
  then
    raise exception 'sensitive Moloni RPC exposed to a browser role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.admin_transition_moloni_job(uuid,text,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.activate_moloni_live(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.deactivate_moloni_emission(text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'service role lacks an administrative Moloni RPC';
  end if;

  select pg_get_functiondef(
    'public.admin_transition_moloni_job(uuid,text,uuid)'::regprocedure
  )
  into transition_definition;
  if lower(transition_definition) not like '%for update%' then
    raise exception 'job transition must lock rows for concurrent requests';
  end if;

  select pg_get_functiondef('public.activate_moloni_live(uuid)'::regprocedure)
  into activation_definition;
  if lower(activation_definition) not like '%pg_advisory_xact_lock%'
    or lower(activation_definition) not like '%historical_reprocessing%'
  then
    raise exception 'live activation lacks concurrency lock or historical safety snapshot';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.moloni_activation_events'::regclass
      and tgname = 'moloni_activation_events_immutable'
      and not tgisinternal
  ) then
    raise exception 'activation audit history is mutable';
  end if;

  begin
    update public.moloni_fiscal_settings
    set moloni_environment = 'live', document_status = 1
    where payment_environment = 'test';
    raise exception 'Stripe test accepted Moloni live';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;

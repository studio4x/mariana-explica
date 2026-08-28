begin;

do $$
declare
  transition_definition text;
begin
  select lower(pg_get_functiondef(
    'public.admin_transition_moloni_job(uuid,text,uuid)'::regprocedure
  )) into transition_definition;

  if transition_definition not like '%attempt_count = 0%' then
    raise exception 'admin retry must restore a fresh attempt budget';
  end if;

  if transition_definition not like '%then ''reconcile_document'' else ''issue_document'' end%' then
    raise exception 'retry and reconcile modes must remain distinct';
  end if;

  if transition_definition like '%last_error_code = null%'
    or transition_definition like '%last_error = null%'
    or transition_definition like '%last_error_message = null%'
  then
    raise exception 'admin retry must preserve the previous diagnostic';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.admin_transition_moloni_job(uuid,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'sensitive retry RPC exposed to authenticated users';
  end if;
end;
$$;

rollback;

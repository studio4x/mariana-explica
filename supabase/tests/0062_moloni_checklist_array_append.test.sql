do $$
declare
  validation_function text;
  settings_function text;
begin
  select pg_get_functiondef('public.invalidate_moloni_checklist_on_validation_change()'::regprocedure)
  into validation_function;
  select pg_get_functiondef('public.invalidate_moloni_checklist_on_settings_change()'::regprocedure)
  into settings_function;

  if validation_function not like '%array_append%' then
    raise exception 'validation checklist trigger must append scalar keys safely';
  end if;
  if settings_function not like '%array_append%' then
    raise exception 'settings checklist trigger must append scalar keys safely';
  end if;
end;
$$;

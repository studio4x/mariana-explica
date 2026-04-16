create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text;
begin
  fallback_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  if fallback_name is null then
    fallback_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  insert into public.profiles (id, full_name, email, role, is_admin, status, created_at, updated_at)
  values (new.id, fallback_name, lower(new.email), 'student', false, 'active', now(), now())
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

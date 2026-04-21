create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.upsert_platform_vault_secret(
  p_name text,
  p_secret text,
  p_description text default ''
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Nome do secret nao informado';
  end if;

  if nullif(trim(p_secret), '') is null then
    raise exception 'Valor do secret nao informado';
  end if;

  select id
    into v_secret_id
  from vault.decrypted_secrets
  where name = p_name
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(p_secret, p_name, coalesce(p_description, ''));
  else
    perform vault.update_secret(v_secret_id, p_secret, p_name, coalesce(p_description, ''));
  end if;
end;
$$;

revoke all on function public.upsert_platform_vault_secret(text, text, text) from public;
grant execute on function public.upsert_platform_vault_secret(text, text, text) to service_role;

create or replace function public.configure_platform_cron_jobs(
  p_project_url text,
  p_cron_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, cron, net, vault
as $$
declare
  v_project_url text := rtrim(nullif(trim(p_project_url), ''), '/');
  v_cron_secret text := nullif(trim(p_cron_secret), '');
  v_job record;
  v_job_names text[] := array[
    'mariana-cron-process-email-deliveries',
    'mariana-cron-retry-email-deliveries',
    'mariana-cron-reconcile-orders',
    'mariana-cron-audit-access-consistency',
    'mariana-cron-clean-expired-links'
  ];
  v_jobs jsonb := '[]'::jsonb;
begin
  if v_project_url is null then
    raise exception 'Project URL nao informada';
  end if;

  if v_cron_secret is null then
    raise exception 'CRON_SECRET nao informado';
  end if;

  perform public.upsert_platform_vault_secret(
    'mariana_explica_project_url',
    v_project_url,
    'URL do projeto Supabase para agendamento dos crons da plataforma'
  );

  perform public.upsert_platform_vault_secret(
    'mariana_explica_cron_secret',
    v_cron_secret,
    'Segredo interno usado pelo pg_cron para chamar Edge Functions cron'
  );

  for v_job in
    select jobid
    from cron.job
    where jobname = any(v_job_names)
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'mariana-cron-process-email-deliveries',
    '*/5 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-process-email-deliveries',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"batchSize":20,"source":"pg_cron"}'::jsonb
      );
    $command$
  );

  perform cron.schedule(
    'mariana-cron-retry-email-deliveries',
    '*/15 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-retry-email-deliveries',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"batchSize":20,"maxAttempts":5,"source":"pg_cron"}'::jsonb
      );
    $command$
  );

  perform cron.schedule(
    'mariana-cron-reconcile-orders',
    '7 * * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-reconcile-orders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"batchSize":20,"source":"pg_cron"}'::jsonb
      );
    $command$
  );

  perform cron.schedule(
    'mariana-cron-audit-access-consistency',
    '17 5 * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-audit-access-consistency',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"batchSize":100,"source":"pg_cron"}'::jsonb
      );
    $command$
  );

  perform cron.schedule(
    'mariana-cron-clean-expired-links',
    '37 5 * * *',
    $command$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_project_url') || '/functions/v1/cron-clean-expired-links',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mariana_explica_cron_secret')
        ),
        body := '{"retentionHours":24,"maxUsers":50,"dryRun":false,"source":"pg_cron"}'::jsonb
      );
    $command$
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jobid', jobid,
        'jobname', jobname,
        'schedule', schedule,
        'active', active
      )
      order by jobname
    ),
    '[]'::jsonb
  )
    into v_jobs
  from cron.job
  where jobname = any(v_job_names);

  return jsonb_build_object(
    'success', true,
    'scheduled_count', jsonb_array_length(v_jobs),
    'jobs', v_jobs
  );
end;
$$;

revoke all on function public.configure_platform_cron_jobs(text, text) from public;
grant execute on function public.configure_platform_cron_jobs(text, text) to service_role;

create or replace function public.get_platform_cron_jobs()
returns jsonb
language sql
security definer
set search_path = public, cron
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jobid', jobid,
        'jobname', jobname,
        'schedule', schedule,
        'active', active
      )
      order by jobname
    ),
    '[]'::jsonb
  )
  from cron.job
  where jobname in (
    'mariana-cron-process-email-deliveries',
    'mariana-cron-retry-email-deliveries',
    'mariana-cron-reconcile-orders',
    'mariana-cron-audit-access-consistency',
    'mariana-cron-clean-expired-links'
  );
$$;

revoke all on function public.get_platform_cron_jobs() from public;
grant execute on function public.get_platform_cron_jobs() to service_role;

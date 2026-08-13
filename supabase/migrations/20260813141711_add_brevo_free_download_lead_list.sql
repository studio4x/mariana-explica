-- Route free-material registrations to a dedicated Brevo list while keeping
-- the local database as the source of truth and the existing retry queue.
begin;

alter table public.brevo_integration_settings
  add column if not exists free_download_lead_list_id bigint null;

alter table public.brevo_contact_syncs
  add column if not exists source_free_product_lead_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brevo_contact_syncs_free_product_lead_fkey'
      and conrelid = 'public.brevo_contact_syncs'::regclass
  ) then
    alter table public.brevo_contact_syncs
      add constraint brevo_contact_syncs_free_product_lead_fkey
      foreign key (source_free_product_lead_id)
      references public.free_product_leads(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'brevo_contact_syncs_free_product_lead_key'
      and conrelid = 'public.brevo_contact_syncs'::regclass
  ) then
    alter table public.brevo_contact_syncs
      add constraint brevo_contact_syncs_free_product_lead_key
      unique (source_free_product_lead_id);
  end if;
end;
$$;

alter table public.brevo_contact_syncs
  drop constraint if exists brevo_contact_syncs_status_check;

alter table public.brevo_contact_syncs
  add constraint brevo_contact_syncs_status_check
  check (status in ('queued', 'processing', 'synced', 'failed', 'paused'));

create or replace function public.enqueue_free_product_lead_for_brevo(input_lead_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_row public.free_product_leads%rowtype;
  product_title text;
  settings_row public.brevo_integration_settings%rowtype;
  mapping jsonb;
  mapped_attributes jsonb;
begin
  select * into lead_row
  from public.free_product_leads
  where id = input_lead_id;

  if not found then
    return false;
  end if;

  select * into settings_row
  from public.brevo_integration_settings
  where singleton_key = true;

  if not found or not settings_row.enabled or settings_row.free_download_lead_list_id is null then
    return false;
  end if;

  select title into product_title
  from public.products
  where id = lead_row.product_id;

  mapping := coalesce(settings_row.attribute_mapping, '{}'::jsonb);
  mapped_attributes := jsonb_strip_nulls(jsonb_build_object(
    coalesce(nullif(mapping ->> 'first_name', ''), 'FIRSTNAME'), split_part(trim(lead_row.name), ' ', 1),
    coalesce(nullif(mapping ->> 'last_name', ''), 'LASTNAME'), nullif(regexp_replace(trim(lead_row.name), '^\S+\s*', ''), ''),
    coalesce(nullif(mapping ->> 'full_name', ''), 'FULLNAME'), trim(lead_row.name),
    coalesce(nullif(mapping ->> 'lead_source', ''), 'LEAD_SOURCE'), 'free_material_download',
    coalesce(nullif(mapping ->> 'opt_in', ''), 'OPT_IN'), true,
    coalesce(nullif(mapping ->> 'opt_in_at', ''), 'OPT_IN_AT'), lead_row.first_requested_at,
    coalesce(nullif(mapping ->> 'product', ''), 'PRODUCT'), product_title
  ));

  insert into public.brevo_contact_syncs (
    user_id,
    email,
    list_id,
    consent_group_id,
    consent_granted,
    consent_at,
    consent_source,
    consent_evidence,
    source_product_id,
    source_free_product_lead_id,
    attributes,
    status,
    next_attempt_at,
    last_error
  ) values (
    null,
    lead_row.normalized_email,
    settings_row.free_download_lead_list_id,
    null,
    true,
    lead_row.first_requested_at,
    'free_material_download',
    jsonb_build_object(
      'flow', 'free_material_download',
      'lead_id', lead_row.id,
      'request_source', lead_row.source,
      'first_requested_at', lead_row.first_requested_at
    ),
    lead_row.product_id,
    lead_row.id,
    mapped_attributes,
    'queued',
    now(),
    null
  )
  on conflict (source_free_product_lead_id) do update set
    email = excluded.email,
    list_id = excluded.list_id,
    consent_at = excluded.consent_at,
    consent_source = excluded.consent_source,
    consent_evidence = excluded.consent_evidence,
    source_product_id = excluded.source_product_id,
    attributes = excluded.attributes,
    status = 'queued',
    next_attempt_at = now(),
    last_error = null;

  return true;
end;
$$;

create or replace function public.enqueue_all_free_product_leads_for_brevo()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_record record;
  queued_count integer := 0;
begin
  for lead_record in
    select id from public.free_product_leads order by created_at
  loop
    if public.enqueue_free_product_lead_for_brevo(lead_record.id) then
      queued_count := queued_count + 1;
    end if;
  end loop;

  return queued_count;
end;
$$;

create or replace function public.queue_free_product_lead_brevo_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_free_product_lead_for_brevo(new.id);
  return new;
end;
$$;

drop trigger if exists free_product_leads_queue_brevo on public.free_product_leads;
create trigger free_product_leads_queue_brevo
after insert or update of product_id, name, email, normalized_email, source, last_requested_at
on public.free_product_leads
for each row
execute function public.queue_free_product_lead_brevo_trigger();

revoke all on function public.enqueue_free_product_lead_for_brevo(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_all_free_product_leads_for_brevo() from public, anon, authenticated;
revoke all on function public.queue_free_product_lead_brevo_trigger() from public, anon, authenticated;
grant execute on function public.enqueue_free_product_lead_for_brevo(uuid) to service_role;
grant execute on function public.enqueue_all_free_product_leads_for_brevo() to service_role;

comment on column public.brevo_integration_settings.free_download_lead_list_id is
  'Dedicated Brevo list for registrations made through free-material download forms.';
comment on column public.brevo_contact_syncs.source_free_product_lead_id is
  'Idempotency link to the originating free-material lead.';

commit;

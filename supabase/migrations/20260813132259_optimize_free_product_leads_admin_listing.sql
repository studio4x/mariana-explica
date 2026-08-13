-- Keep the administrative lead listing efficient and mirror transactional
-- email outcomes into the lead record used by the operations team.
begin;

create index if not exists free_product_leads_last_requested_at_idx
  on public.free_product_leads (last_requested_at desc);

create index if not exists free_product_leads_product_last_requested_at_idx
  on public.free_product_leads (product_id, last_requested_at desc);

create index if not exists free_product_leads_delivery_last_requested_at_idx
  on public.free_product_leads (delivery_status, last_requested_at desc);

create or replace function public.sync_free_product_lead_delivery_status()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  lead_id_text text;
  mapped_status text;
begin
  if new.template_key <> 'free_lead_download' then
    return new;
  end if;

  lead_id_text := new.metadata ->> 'free_product_lead_id';
  if lead_id_text is null
    or lead_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return new;
  end if;

  mapped_status := case
    when new.status in ('sent', 'delivered') then 'sent'
    when new.status in ('failed', 'bounced') then 'failed'
    else 'queued'
  end;

  update public.free_product_leads
  set delivery_status = mapped_status
  where id = lead_id_text::uuid
    and delivery_status is distinct from mapped_status;

  return new;
end;
$$;

drop trigger if exists email_deliveries_sync_free_product_lead_status on public.email_deliveries;
create trigger email_deliveries_sync_free_product_lead_status
after insert or update of status on public.email_deliveries
for each row
execute function public.sync_free_product_lead_delivery_status();

with latest_delivery as (
  select distinct on (email_deliveries.metadata ->> 'free_product_lead_id')
    email_deliveries.metadata ->> 'free_product_lead_id' as lead_id,
    case
      when email_deliveries.status in ('sent', 'delivered') then 'sent'
      when email_deliveries.status in ('failed', 'bounced') then 'failed'
      else 'queued'
    end as delivery_status
  from public.email_deliveries
  where email_deliveries.template_key = 'free_lead_download'
    and email_deliveries.metadata ->> 'free_product_lead_id'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  order by
    email_deliveries.metadata ->> 'free_product_lead_id',
    email_deliveries.created_at desc
)
update public.free_product_leads as leads
set delivery_status = latest_delivery.delivery_status
from latest_delivery
where leads.id = latest_delivery.lead_id::uuid
  and leads.delivery_status is distinct from latest_delivery.delivery_status;

revoke all on function public.sync_free_product_lead_delivery_status() from public, anon, authenticated;

commit;

-- Rebuild the Brevo snapshots after adding the consolidated material-history
-- attributes. Paused rows intentionally remain paused until their list is enabled.
begin;

update public.brevo_contact_syncs
set
  status = 'queued',
  next_attempt_at = now(),
  last_error = null
where status in ('queued', 'synced', 'failed');

create or replace function public.requeue_brevo_contact_after_paid_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.paid_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.paid_at is not null then return new; end if;

  update public.brevo_contact_syncs
  set
    source_product_id = new.product_id,
    source_order_id = new.id,
    status = 'queued',
    next_attempt_at = now(),
    last_error = null
  where user_id = new.user_id
    and consent_granted = true
    and source_free_product_lead_id is null
    and status in ('queued', 'synced', 'failed');
  return new;
end;
$$;

drop trigger if exists orders_queue_brevo_after_payment on public.orders;
create trigger orders_queue_brevo_after_payment
after insert or update of paid_at on public.orders
for each row
execute function public.requeue_brevo_contact_after_paid_order();

revoke all on function public.requeue_brevo_contact_after_paid_order() from public, anon, authenticated;

commit;

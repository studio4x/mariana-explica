-- 0002_domain_security.sql
-- Completa o modelo de dominio e endurece as policies sensiveis

create or replace function public.current_profile_role()
returns text
language sql
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.set_support_ticket_defaults()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;

  return new;
end;
$$;

create or replace function public.set_support_ticket_message_defaults()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.sender_user_id := auth.uid();
    new.sender_role := coalesce(public.current_profile_role(), 'student');
  end if;

  return new;
end;
$$;

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  affiliate_code text not null unique,
  status text not null default 'active',
  commission_type text not null default 'percentage',
  commission_value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliates_user_id_idx on public.affiliates (user_id);
create index if not exists affiliates_affiliate_code_idx on public.affiliates (affiliate_code);
create index if not exists affiliates_status_idx on public.affiliates (status);
alter table public.affiliates
  add constraint affiliates_status_check
  check (status in ('active', 'inactive', 'blocked'));
alter table public.affiliates
  add constraint affiliates_commission_type_check
  check (commission_type in ('percentage', 'fixed'));
alter table public.affiliates
  add constraint affiliates_commission_value_check
  check (commission_value >= 0);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  product_id uuid null references public.products(id) on delete set null,
  order_id uuid null references public.orders(id) on delete set null,
  referral_code text not null,
  status text not null default 'tracked',
  commission_cents integer not null default 0,
  tracked_at timestamptz not null default now(),
  converted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_referrals_affiliate_id_idx on public.affiliate_referrals (affiliate_id);
create index if not exists affiliate_referrals_order_id_idx on public.affiliate_referrals (order_id);
create index if not exists affiliate_referrals_status_idx on public.affiliate_referrals (status);
create index if not exists affiliate_referrals_referral_code_idx on public.affiliate_referrals (referral_code);
alter table public.affiliate_referrals
  add constraint affiliate_referrals_status_check
  check (status in ('tracked', 'converted', 'cancelled', 'invalid'));
alter table public.affiliate_referrals
  add constraint affiliate_referrals_commission_check
  check (commission_cents >= 0);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text null,
  discount_type text not null,
  discount_value integer not null,
  status text not null default 'active',
  starts_at timestamptz null,
  expires_at timestamptz null,
  max_uses integer null,
  max_uses_per_user integer null,
  current_uses integer not null default 0,
  minimum_order_cents integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupons_code_idx on public.coupons (code);
create index if not exists coupons_status_idx on public.coupons (status);
create index if not exists coupons_expires_at_idx on public.coupons (expires_at);
alter table public.coupons
  add constraint coupons_discount_type_check
  check (discount_type in ('percentage', 'fixed'));
alter table public.coupons
  add constraint coupons_status_check
  check (status in ('active', 'inactive', 'expired'));
alter table public.coupons
  add constraint coupons_discount_value_check
  check (discount_value >= 0);
alter table public.coupons
  add constraint coupons_uses_check
  check (
    current_uses >= 0
    and (max_uses is null or max_uses >= 0)
    and (max_uses_per_user is null or max_uses_per_user >= 0)
    and (minimum_order_cents is null or minimum_order_cents >= 0)
  );

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  discount_cents integer not null,
  used_at timestamptz not null default now()
);

create index if not exists coupon_usages_coupon_id_idx on public.coupon_usages (coupon_id);
create index if not exists coupon_usages_user_id_idx on public.coupon_usages (user_id);
create index if not exists coupon_usages_order_id_idx on public.coupon_usages (order_id);
create index if not exists coupon_usages_coupon_user_idx on public.coupon_usages (coupon_id, user_id);
create unique index if not exists coupon_usages_order_unique_idx on public.coupon_usages (order_id);
alter table public.coupon_usages
  add constraint coupon_usages_discount_check
  check (discount_cents >= 0);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text null,
  status text not null default 'unread',
  sent_via_email boolean not null default false,
  sent_via_in_app boolean not null default true,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_status_idx on public.notifications (status);
create index if not exists notifications_type_idx on public.notifications (type);
create index if not exists notifications_created_at_idx on public.notifications (created_at);
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('transactional', 'informational', 'marketing', 'support'));
alter table public.notifications
  add constraint notifications_status_check
  check (status in ('unread', 'read', 'archived'));

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  notification_id uuid null references public.notifications(id) on delete set null,
  email_to text not null,
  template_key text not null,
  provider text null,
  provider_message_id text null,
  status text not null,
  error_message text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists email_deliveries_user_id_idx on public.email_deliveries (user_id);
create index if not exists email_deliveries_notification_id_idx on public.email_deliveries (notification_id);
create index if not exists email_deliveries_status_idx on public.email_deliveries (status);
create index if not exists email_deliveries_template_key_idx on public.email_deliveries (template_key);
alter table public.email_deliveries
  add constraint email_deliveries_status_check
  check (status in ('queued', 'sent', 'failed', 'delivered', 'bounced'));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_admin_id uuid null references public.profiles(id) on delete set null,
  last_reply_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_priority_idx on public.support_tickets (priority);
create index if not exists support_tickets_assigned_admin_id_idx on public.support_tickets (assigned_admin_id);
alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'answered', 'closed'));
alter table public.support_tickets
  add constraint support_tickets_priority_check
  check (priority in ('low', 'normal', 'high'));

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_ticket_owner(ticket_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.support_tickets
    where id = ticket_id
      and user_id = auth.uid()
  );
$$;

create index if not exists support_ticket_messages_ticket_id_idx on public.support_ticket_messages (ticket_id);
create index if not exists support_ticket_messages_sender_user_id_idx on public.support_ticket_messages (sender_user_id);
create index if not exists support_ticket_messages_created_at_idx on public.support_ticket_messages (created_at);
alter table public.support_ticket_messages
  add constraint support_ticket_messages_sender_role_check
  check (sender_role in ('student', 'admin'));

create table if not exists public.site_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  config_value jsonb not null,
  description text null,
  is_public boolean not null default false,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_config_config_key_idx on public.site_config (config_key);
create index if not exists site_config_is_public_idx on public.site_config (is_public);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references public.profiles(id) on delete set null,
  actor_role text null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_entity_type_idx on public.audit_logs (entity_type);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);
alter table public.audit_logs
  add constraint audit_logs_actor_role_check
  check (actor_role is null or actor_role in ('student', 'affiliate', 'admin'));

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text null,
  idempotency_key text null,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_job_name_idx on public.job_runs (job_name);
create index if not exists job_runs_status_idx on public.job_runs (status);
create index if not exists job_runs_started_at_idx on public.job_runs (started_at);
create index if not exists job_runs_idempotency_key_idx on public.job_runs (idempotency_key);
alter table public.job_runs
  add constraint job_runs_status_check
  check (status in ('running', 'success', 'failed'));

create trigger affiliates_updated_at before update on public.affiliates for each row execute function public.set_updated_at();
create trigger coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();
create trigger site_config_updated_at before update on public.site_config for each row execute function public.set_updated_at();
create trigger support_ticket_messages_default_values before insert on public.support_ticket_messages for each row execute function public.set_support_ticket_message_defaults();
create trigger support_tickets_default_values before insert on public.support_tickets for each row execute function public.set_support_ticket_defaults();

alter table public.affiliates enable row level security;
drop policy if exists affiliates_select_own on public.affiliates;
drop policy if exists affiliates_select_admin on public.affiliates;
drop policy if exists affiliates_admin_manage on public.affiliates;
create policy affiliates_select_own on public.affiliates for select using (
  user_id = auth.uid()
  and public.is_active_profile()
);
create policy affiliates_select_admin on public.affiliates for select using (public.is_admin());
create policy affiliates_admin_manage on public.affiliates for all using (public.is_admin()) with check (public.is_admin());

alter table public.affiliate_referrals enable row level security;
drop policy if exists affiliate_referrals_select_own on public.affiliate_referrals;
drop policy if exists affiliate_referrals_select_admin on public.affiliate_referrals;
drop policy if exists affiliate_referrals_admin_manage on public.affiliate_referrals;
create policy affiliate_referrals_select_own on public.affiliate_referrals for select using (
  public.is_active_profile()
  and exists(
    select 1
    from public.affiliates
    where affiliates.id = affiliate_referrals.affiliate_id
      and affiliates.user_id = auth.uid()
  )
);
create policy affiliate_referrals_select_admin on public.affiliate_referrals for select using (public.is_admin());
create policy affiliate_referrals_admin_manage on public.affiliate_referrals for all using (public.is_admin()) with check (public.is_admin());

alter table public.coupons enable row level security;
drop policy if exists coupons_admin_manage on public.coupons;
create policy coupons_admin_manage on public.coupons for all using (public.is_admin()) with check (public.is_admin());

alter table public.coupon_usages enable row level security;
drop policy if exists coupon_usages_select_admin on public.coupon_usages;
drop policy if exists coupon_usages_admin_manage on public.coupon_usages;
create policy coupon_usages_select_admin on public.coupon_usages for select using (public.is_admin());
create policy coupon_usages_admin_manage on public.coupon_usages for all using (public.is_admin()) with check (public.is_admin());

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_select_admin on public.notifications;
drop policy if exists notifications_admin_manage on public.notifications;
create policy notifications_select_own on public.notifications for select using (
  user_id = auth.uid()
  and public.is_active_profile()
);
create policy notifications_select_admin on public.notifications for select using (public.is_admin());
create policy notifications_admin_manage on public.notifications for all using (public.is_admin()) with check (public.is_admin());

alter table public.email_deliveries enable row level security;
drop policy if exists email_deliveries_select_admin on public.email_deliveries;
drop policy if exists email_deliveries_admin_manage on public.email_deliveries;
create policy email_deliveries_select_admin on public.email_deliveries for select using (public.is_admin());
create policy email_deliveries_admin_manage on public.email_deliveries for all using (public.is_admin()) with check (public.is_admin());

alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_select_own on public.support_tickets;
drop policy if exists support_tickets_insert_own on public.support_tickets;
drop policy if exists support_tickets_select_admin on public.support_tickets;
drop policy if exists support_tickets_admin_manage on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets for select using (
  user_id = auth.uid()
  and public.is_active_profile()
);
create policy support_tickets_select_admin on public.support_tickets for select using (public.is_admin());
create policy support_tickets_insert_own on public.support_tickets for insert with check (
  user_id = auth.uid()
  and public.is_active_profile()
);
create policy support_tickets_admin_manage on public.support_tickets for all using (public.is_admin()) with check (public.is_admin());

alter table public.support_ticket_messages enable row level security;
drop policy if exists support_ticket_messages_select_own on public.support_ticket_messages;
drop policy if exists support_ticket_messages_admin_select on public.support_ticket_messages;
drop policy if exists support_ticket_messages_insert_own on public.support_ticket_messages;
drop policy if exists support_ticket_messages_admin_manage on public.support_ticket_messages;
create policy support_ticket_messages_select_own on public.support_ticket_messages for select using (
  public.is_active_profile()
  and (
    public.is_admin()
    or public.is_ticket_owner(ticket_id)
  )
);
create policy support_ticket_messages_admin_select on public.support_ticket_messages for select using (public.is_admin());
create policy support_ticket_messages_insert_own on public.support_ticket_messages for insert with check (
  public.is_active_profile()
  and sender_user_id = auth.uid()
  and (
    public.is_admin()
    or public.is_ticket_owner(ticket_id)
  )
);
create policy support_ticket_messages_admin_manage on public.support_ticket_messages for all using (public.is_admin()) with check (public.is_admin());

alter table public.site_config enable row level security;
drop policy if exists site_config_select_public on public.site_config;
drop policy if exists site_config_select_admin on public.site_config;
drop policy if exists site_config_admin_manage on public.site_config;
create policy site_config_select_public on public.site_config for select using (is_public = true);
create policy site_config_select_admin on public.site_config for select using (public.is_admin());
create policy site_config_admin_manage on public.site_config for all using (public.is_admin()) with check (public.is_admin());

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs for select using (public.is_admin());

alter table public.job_runs enable row level security;
drop policy if exists job_runs_select_admin on public.job_runs;
drop policy if exists job_runs_admin_manage on public.job_runs;
create policy job_runs_select_admin on public.job_runs for select using (public.is_admin());
create policy job_runs_admin_manage on public.job_runs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own on public.orders;
drop policy if exists access_grants_insert_own on public.access_grants;
drop policy if exists access_grants_update_own on public.access_grants;

create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and status = 'active');

drop policy if exists orders_select_admin on public.orders;
drop policy if exists orders_admin_manage on public.orders;
create policy orders_select_admin on public.orders for select using (public.is_admin());
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own on public.orders;
create policy orders_admin_manage on public.orders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists access_grants_select_admin on public.access_grants;
drop policy if exists access_grants_admin_manage on public.access_grants;
create policy access_grants_select_admin on public.access_grants for select using (public.is_admin());
drop policy if exists access_grants_insert_own on public.access_grants;
drop policy if exists access_grants_update_own on public.access_grants;
create policy access_grants_admin_manage on public.access_grants for all using (public.is_admin()) with check (public.is_admin());

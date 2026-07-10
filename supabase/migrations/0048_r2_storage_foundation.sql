alter table public.module_assets
  add column if not exists storage_provider text not null default 'supabase';

alter table public.module_assets
  drop constraint if exists module_assets_storage_provider_check;

alter table public.module_assets
  add constraint module_assets_storage_provider_check
  check (storage_provider in ('supabase', 'r2'));

alter table public.product_modules
  add column if not exists module_pdf_storage_provider text not null default 'supabase';

alter table public.product_modules
  drop constraint if exists product_modules_module_pdf_storage_provider_check;

alter table public.product_modules
  add constraint product_modules_module_pdf_storage_provider_check
  check (module_pdf_storage_provider in ('supabase', 'r2'));

alter table public.site_page_assets
  add column if not exists storage_provider text not null default 'supabase';

alter table public.site_page_assets
  drop constraint if exists site_page_assets_storage_provider_check;

alter table public.site_page_assets
  add constraint site_page_assets_storage_provider_check
  check (storage_provider in ('supabase', 'r2'));

alter table public.visual_site_page_assets
  add column if not exists storage_provider text not null default 'supabase';

alter table public.visual_site_page_assets
  drop constraint if exists visual_site_page_assets_storage_provider_check;

alter table public.visual_site_page_assets
  add constraint visual_site_page_assets_storage_provider_check
  check (storage_provider in ('supabase', 'r2'));

alter table public.products
  add column if not exists cover_image_storage_bucket text null,
  add column if not exists cover_image_storage_path text null,
  add column if not exists cover_image_storage_provider text not null default 'supabase';

alter table public.products
  drop constraint if exists products_cover_image_storage_provider_check;

alter table public.products
  add constraint products_cover_image_storage_provider_check
  check (cover_image_storage_provider in ('supabase', 'r2'));

alter table public.profiles
  add column if not exists avatar_storage_bucket text null,
  add column if not exists avatar_storage_path text null,
  add column if not exists avatar_storage_provider text not null default 'supabase';

alter table public.profiles
  drop constraint if exists profiles_avatar_storage_provider_check;

alter table public.profiles
  add constraint profiles_avatar_storage_provider_check
  check (avatar_storage_provider in ('supabase', 'r2'));

alter table public.support_tickets
  add column if not exists attachment_storage_provider text not null default 'supabase';

alter table public.support_tickets
  drop constraint if exists support_tickets_attachment_storage_provider_check;

alter table public.support_tickets
  add constraint support_tickets_attachment_storage_provider_check
  check (attachment_storage_provider in ('supabase', 'r2'));

alter table public.support_ticket_messages
  add column if not exists attachment_storage_provider text not null default 'supabase';

alter table public.support_ticket_messages
  drop constraint if exists support_ticket_messages_attachment_storage_provider_check;

alter table public.support_ticket_messages
  add constraint support_ticket_messages_attachment_storage_provider_check
  check (attachment_storage_provider in ('supabase', 'r2'));

update public.module_assets
set storage_provider = 'supabase'
where storage_provider is distinct from 'supabase';

update public.product_modules
set module_pdf_storage_provider = 'supabase'
where module_pdf_storage_path is not null
  and module_pdf_storage_provider is distinct from 'supabase';

update public.site_page_assets
set storage_provider = 'supabase'
where storage_provider is distinct from 'supabase';

update public.visual_site_page_assets
set storage_provider = 'supabase'
where storage_provider is distinct from 'supabase';

update public.products
set
  cover_image_storage_bucket = coalesce(cover_image_storage_bucket, 'course-cover-public'),
  cover_image_storage_provider = 'supabase'
where cover_image_url is not null
  and cover_image_storage_provider is distinct from 'r2';

update public.profiles
set
  avatar_storage_bucket = coalesce(avatar_storage_bucket, 'profile-avatars-public'),
  avatar_storage_provider = 'supabase'
where avatar_url is not null
  and avatar_storage_provider is distinct from 'r2';

update public.support_tickets
set attachment_storage_provider = 'supabase'
where attachment_path is not null
  and attachment_storage_provider is distinct from 'r2';

update public.support_ticket_messages
set attachment_storage_provider = 'supabase'
where attachment_path is not null
  and attachment_storage_provider is distinct from 'r2';

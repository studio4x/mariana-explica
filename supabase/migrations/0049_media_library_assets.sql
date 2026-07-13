alter table public.module_assets
  add column if not exists storage_managed boolean not null default true;

alter table public.module_assets
  drop constraint if exists module_assets_asset_type_check;

alter table public.module_assets
  add constraint module_assets_asset_type_check
  check (asset_type in ('pdf', 'image', 'video_file', 'video_embed', 'external_link'));

comment on column public.module_assets.storage_managed is
  'Indica se a plataforma pode remover o objeto do storage ao apagar o asset.';

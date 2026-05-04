-- 0025_profiles_nif_and_content_updates.sql
-- Adiciona NIF e preferencia de atualizacoes ao perfil do usuario.

alter table public.profiles
  add column if not exists nif text null;

alter table public.profiles
  add column if not exists content_updates_consent boolean not null default false;

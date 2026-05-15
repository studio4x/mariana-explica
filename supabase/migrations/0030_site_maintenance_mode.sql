-- 0030_site_maintenance_mode.sql
-- Adds operational maintenance-mode config for public gating.

insert into public.site_config (config_key, config_value, description, is_public)
values (
  'site_maintenance_mode',
  jsonb_build_object(
    'enabled', false,
    'message', 'Estamos em manutencao para melhorar a tua experiencia. Voltamos em breve.'
  ),
  'Controle operacional do modo de manutencao da plataforma. Quando ativo, apenas admins autenticados acessam a aplicacao.',
  true
)
on conflict (config_key) do update
set
  description = excluded.description,
  is_public = true,
  config_value = case
    when jsonb_typeof(public.site_config.config_value) = 'object' then
      jsonb_build_object(
        'enabled',
        case
          when lower(coalesce(public.site_config.config_value ->> 'enabled', '')) in ('true', 'false')
            then (public.site_config.config_value ->> 'enabled')::boolean
          else false
        end,
        'message',
        coalesce(
          nullif(btrim(coalesce(public.site_config.config_value ->> 'message', '')), ''),
          excluded.config_value ->> 'message'
        )
      )
    else excluded.config_value
  end;

-- 0039_ai_page_editor_allowed_public_routes.sql
-- Garante que as rotas publicas geridas do editor IA permanecem em allowed_paths.

with normalized_paths as (
  select
    path,
    min(ord) as ord
  from (
    select
      value as path,
      row_number() over () as ord
    from public.site_config cfg
    cross join lateral jsonb_array_elements_text(coalesce(cfg.config_value -> 'allowed_paths', '[]'::jsonb))
    where cfg.config_key = 'ai_page_editor_config'

    union all

    values
      ('/', 1000),
      ('/sobre', 1001),
      ('/explicacoes', 1002),
      ('/materiais', 1003),
      ('/suporte', 1004),
      ('/privacidade', 1005),
      ('/cookies', 1006),
      ('/termos-de-uso', 1007)
  ) merged(path, ord)
  group by path
),
rebuilt_paths as (
  select to_jsonb(array_agg(path order by ord)) as allowed_paths
  from normalized_paths
)
update public.site_config cfg
set config_value = jsonb_set(cfg.config_value, '{allowed_paths}', rebuilt_paths.allowed_paths, true)
from rebuilt_paths
where cfg.config_key = 'ai_page_editor_config';

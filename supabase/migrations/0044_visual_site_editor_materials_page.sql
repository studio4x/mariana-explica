-- 0044_visual_site_editor_materials_page.sql
-- Seed da pagina piloto /materiais para o editor visual da Mariana Explica.

insert into public.visual_site_pages (page_key, title, status)
values ('materials', 'Materiais', 'published')
on conflict (page_key) do update
set
  title = excluded.title,
  status = excluded.status;

with materials_page as (
  select id
  from public.visual_site_pages
  where page_key = 'materials'
),
materials_version as (
  insert into public.visual_site_page_versions (
    page_id,
    version_number,
    status,
    entries_json,
    style_json,
    metadata
  )
  select
    materials_page.id,
    1,
    'published',
    '{
      "hero": {
        "eyebrow": "Materiais",
        "title": "Tudo o que precisas para brilhares",
        "lead": "Encontra aqui os teus melhores amigos de estudo: resumos leves, esquemas práticos e o apoio certo para dominares o português e a filosofia sem stress.",
        "primaryCta": {
          "label": "Explorar catálogo",
          "href": "#catalogo"
        }
      },
      "catalogHelpCta": {
        "label": "Precisas de ajuda para escolher?",
        "href": "/suporte"
      },
      "supportCta": {
        "title": "Dúvidas? Estou aqui para ajudar!",
        "lead": "Seja uma questão sobre as sebentas ou um problema técnico, encontras aqui as respostas rápidas. Se não resolver, fala diretamente comigo.",
        "primaryCta": {
          "label": "Preciso de ajuda!",
          "href": "/suporte"
        },
        "secondaryCta": {
          "label": "Entrar na conta",
          "href": "/login"
        }
      },
      "faq": {
        "eyebrow": "Respostas úteis",
        "title": "Perguntas Frequentes"
      }
    }'::jsonb,
    '{}'::jsonb,
    '{"seeded_via":"migration_0044_visual_site_editor_materials_page"}'::jsonb
  from materials_page
  on conflict (page_id, version_number) do update
  set
    status = excluded.status,
    entries_json = excluded.entries_json,
    style_json = excluded.style_json,
    metadata = excluded.metadata
  returning id, page_id
)
update public.visual_site_pages p
set published_version_id = materials_version.id
from materials_version
where p.id = materials_version.page_id;

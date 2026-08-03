-- 0070_site_seo_configuration.sql
-- Public SEO defaults used by the SPA metadata manager and discovery files.

insert into public.site_config (config_key, config_value, description, is_public)
values (
  'site_seo',
  '{
    "site_name": "Mariana Explica",
    "alternate_site_name": "Mariana.explica",
    "canonical_base_url": "https://www.mariana-explica.pt",
    "default_title": "Mariana Explica | Português e Filosofia sem complicações",
    "title_template": "%s | Mariana Explica",
    "default_description": "Explicações e materiais de estudo de Português e Filosofia, com conteúdos claros para aprender, organizar a matéria e preparar os exames.",
    "default_og_image_url": "https://www.mariana-explica.pt/icon-512.png",
    "language": "pt-PT",
    "locale": "pt_PT",
    "author_name": "Mariana Teixeira",
    "organization_name": "Mariana Explica",
    "organization_logo_url": "https://www.mariana-explica.pt/icon-512.png",
    "contact_email": "marianaexplica.online@gmail.com",
    "social_profiles": ["https://www.instagram.com/mariana.explica/"],
    "twitter_site": "",
    "google_site_verification": "",
    "bing_site_verification": "",
    "robots_index": true,
    "robots_follow": true,
    "robots_max_snippet": -1,
    "robots_max_image_preview": "large",
    "robots_max_video_preview": -1,
    "course_title_template": "%s | Material de estudo | Mariana Explica",
    "course_description_template": "%s. Consulta o programa, os conteúdos e as condições de acesso deste material na Mariana Explica.",
    "pages": {
      "home": {
        "title": "Explicações e materiais de Português e Filosofia | Mariana Explica",
        "description": "Aprende Português e Filosofia com explicações claras, materiais de estudo organizados e preparação focada para testes e exames.",
        "index": true
      },
      "materials": {
        "title": "Materiais de Português e Filosofia | Mariana Explica",
        "description": "Explora materiais e cursos de Português e Filosofia para rever a matéria, consolidar conhecimentos e preparar testes e exames.",
        "index": true
      },
      "support": {
        "title": "Suporte e perguntas frequentes | Mariana Explica",
        "description": "Encontra respostas sobre materiais, pagamentos, acesso à plataforma e fala com o suporte da Mariana Explica.",
        "index": true
      },
      "explanations": {
        "title": "Explicações de Português e Filosofia | Mariana Explica",
        "description": "Pede informações sobre explicações de Português e Filosofia e encontra um plano de estudo adequado aos teus objetivos.",
        "index": true
      },
      "about": {
        "title": "Sobre a Mariana Explica",
        "description": "Conhece a Mariana Teixeira e o projeto Mariana Explica, criado para tornar o estudo de Português e Filosofia mais claro e organizado.",
        "index": true
      },
      "privacy": {
        "title": "Política de Privacidade | Mariana Explica",
        "description": "Consulta como a Mariana Explica recolhe, utiliza e protege os dados pessoais dos utilizadores da plataforma.",
        "index": true
      },
      "cookies": {
        "title": "Política de Cookies | Mariana Explica",
        "description": "Consulta os cookies utilizados pela Mariana Explica e gere as tuas preferências de privacidade e rastreamento.",
        "index": true
      },
      "terms": {
        "title": "Termos de Uso | Mariana Explica",
        "description": "Consulta as condições de utilização da plataforma, compra e acesso aos conteúdos digitais da Mariana Explica.",
        "index": true
      }
    }
  }'::jsonb,
  'Configuração pública de metadados, indexação, canonical, redes sociais e identidade para mecanismos de pesquisa.',
  true
)
on conflict (config_key) do update
set
  config_value = excluded.config_value || public.site_config.config_value,
  description = excluded.description,
  is_public = true;

-- Repair legacy mojibake in the persisted SEO configuration and add keyword metadata.
UPDATE public.site_config
SET
  config_value = config_value || jsonb_build_object(
    'default_title', U&'Mariana Explica | Portugu\00eas e Filosofia sem complica\00e7\00f5es',
    'default_description', U&'Explica\00e7\00f5es e materiais de estudo de Portugu\00eas e Filosofia, com conte\00fados claros para aprender, organizar a mat\00e9ria e preparar os exames.',
    'primary_keyword', U&'explica\00e7\00f5es de Portugu\00eas e Filosofia',
    'secondary_keywords', jsonb_build_array(
      U&'materiais de estudo de Portugu\00eas',
      U&'materiais de estudo de Filosofia',
      U&'prepara\00e7\00e3o para exames nacionais',
      U&'curso de Filosofia',
      U&'explica\00e7\00f5es online'
    ),
    'course_description_template', U&'%s. Consulta o programa, os conte\00fados e as condi\00e7\00f5es de acesso deste material na Mariana Explica.',
    'pages', jsonb_build_object(
      'home', jsonb_build_object('index', true, 'title', U&'Explica\00e7\00f5es e materiais de Portugu\00eas e Filosofia | Mariana Explica', 'description', U&'Aprende Portugu\00eas e Filosofia com explica\00e7\00f5es claras, materiais de estudo organizados e prepara\00e7\00e3o focada para testes e exames.'),
      'materials', jsonb_build_object('index', true, 'title', U&'Materiais de Portugu\00eas e Filosofia | Mariana Explica', 'description', U&'Explora materiais e cursos de Portugu\00eas e Filosofia para rever a mat\00e9ria, consolidar conhecimentos e preparar testes e exames.'),
      'support', jsonb_build_object('index', true, 'title', U&'Suporte e perguntas frequentes | Mariana Explica', 'description', U&'Encontra respostas sobre materiais, pagamentos, acesso \00e0 plataforma e fala com o suporte da Mariana Explica.'),
      'explanations', jsonb_build_object('index', true, 'title', U&'Explica\00e7\00f5es de Portugu\00eas e Filosofia | Mariana Explica', 'description', U&'Pede informa\00e7\00f5es sobre explica\00e7\00f5es de Portugu\00eas e Filosofia e encontra um plano de estudo adequado aos teus objetivos.'),
      'about', jsonb_build_object('index', true, 'title', 'Sobre a Mariana Explica', 'description', U&'Conhece a Mariana Teixeira e o projeto Mariana Explica, criado para tornar o estudo de Portugu\00eas e Filosofia mais claro e organizado.'),
      'privacy', jsonb_build_object('index', true, 'title', U&'Pol\00edtica de Privacidade | Mariana Explica', 'description', U&'Consulta como a Mariana Explica recolhe, utiliza e protege os dados pessoais dos utilizadores da plataforma.'),
      'cookies', jsonb_build_object('index', true, 'title', U&'Pol\00edtica de Cookies | Mariana Explica', 'description', U&'Consulta os cookies utilizados pela Mariana Explica e gere as tuas prefer\00eancias de privacidade e rastreamento.'),
      'terms', jsonb_build_object('index', true, 'title', 'Termos de Uso | Mariana Explica', 'description', U&'Consulta as condi\00e7\00f5es de utiliza\00e7\00e3o da plataforma, compra e acesso aos conte\00fados digitais da Mariana Explica.')
    )
  ),
  description = U&'Configura\00e7\00e3o p\00fablica de metadados, indexa\00e7\00e3o, canonical, redes sociais e identidade para mecanismos de pesquisa.',
  updated_at = now()
WHERE config_key = 'site_seo';

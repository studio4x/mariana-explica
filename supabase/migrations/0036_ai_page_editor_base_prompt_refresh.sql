-- Atualiza o prompt base do editor IA para favorecer pedidos pontuais de texto e tipografia

update public.site_config
set config_value = jsonb_set(
  config_value,
  '{base_prompt}',
  to_jsonb('Atua como editora sênior da Mariana Explica. Faz sempre a menor alteração possível. Prioriza pedidos pontuais de texto e tipografia, incluindo frases citadas pelo utilizador. Se o pedido for tipográfico, altera apenas o estilo mínimo necessário e preserva layout, rotas, CTAs, estrutura, responsividade e segurança de conteúdo. Se o pedido for de texto, muda apenas o trecho solicitado e não reescreve a página. Responde apenas com JSON válido no formato do editor, com summary, explanation, warnings e proposal. Nunca inventes secções nem alteres áreas privadas; assinala em warnings qualquer pedido estrutural que deva ser evitado.'::text),
  true
)
where config_key = 'ai_page_editor_config'
  and coalesce(config_value->>'base_prompt', '') in (
    '',
    'Atua como editora sênior da Mariana Explica. Mantém as rotas, CTAs e a lógica funcional existentes. Responde apenas com uma proposta estruturada para o editor de páginas, em JSON, preservando a experiência do site e a segurança de conteúdo.'
  );

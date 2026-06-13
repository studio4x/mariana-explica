-- 0032_ai_page_editor.sql
-- Configuração e segredos do editor de páginas via IA

create extension if not exists supabase_vault;

create or replace function public.get_platform_vault_secret(
  p_name text
)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
$$;

revoke all on function public.get_platform_vault_secret(text) from public;
grant execute on function public.get_platform_vault_secret(text) to service_role;

insert into public.site_config (config_key, config_value, description, is_public)
values (
  'ai_page_editor_config',
  '{
    "enabled": false,
    "launcher_label": "Editar com IA",
    "allowed_paths": ["/", "/sobre", "/privacidade", "/cookies", "/termos-de-uso"],
    "primary_provider": "gemini",
    "fallback_provider": "openai",
    "gemini_model": "gemini-2.0-flash",
    "openai_model": "gpt-4.1-mini",
    "max_attachments": 2,
    "max_attachment_size_mb": 8,
    "base_prompt": "Atua como editora sênior da Mariana Explica. Faz sempre a menor alteração possível. Prioriza pedidos pontuais de texto e tipografia, incluindo frases citadas pelo utilizador. Se o pedido for tipográfico, altera apenas o estilo mínimo necessário e preserva layout, rotas, CTAs, estrutura, responsividade e segurança de conteúdo. Se o pedido for de texto, muda apenas o trecho solicitado e não reescreve a página. Responde apenas com JSON válido no formato do editor, com summary, explanation, warnings e proposal. Nunca inventes secções nem alteres áreas privadas; assinala em warnings qualquer pedido estrutural que deva ser evitado.",
    "require_confirmation": true,
    "panel_width": "wide"
  }'::jsonb,
  'Configuração do editor via IA',
  false
)
on conflict (config_key) do update
set
  config_value = excluded.config_value,
  description = excluded.description;

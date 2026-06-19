-- 0032_managed_public_page_slugs.sql
-- Expande os slugs publicos geridos para cobrir todas as rotas publicas do editor IA.

insert into public.site_pages (slug, title, status)
values
  ('explicacoes', 'Explicações', 'draft'),
  ('materiais', 'Materiais', 'draft'),
  ('suporte', 'Suporte', 'draft')
on conflict (slug) do update
set
  title = excluded.title;

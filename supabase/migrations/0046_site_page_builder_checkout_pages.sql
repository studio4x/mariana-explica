-- 0046_site_page_builder_checkout_pages.sql
-- Expande o editor legado para incluir checkout e confirmacao de checkout.

insert into public.site_pages (slug, title, status)
values
  ('checkout', 'Checkout', 'draft'),
  ('checkout-success', 'Checkout concluido', 'draft')
on conflict (slug) do update
set
  title = excluded.title;

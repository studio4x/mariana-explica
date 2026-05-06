create table if not exists public.faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.faq_categories(id) on delete restrict,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faqs_category_question_unique unique (category_id, question)
);

create index if not exists faq_categories_sort_order_idx on public.faq_categories (sort_order, title);
create index if not exists faqs_category_id_idx on public.faqs (category_id, sort_order);
create index if not exists faqs_is_active_idx on public.faqs (is_active);

alter table public.faq_categories enable row level security;
alter table public.faqs enable row level security;

drop policy if exists faq_categories_select_public on public.faq_categories;
create policy faq_categories_select_public
  on public.faq_categories
  for select
  using (is_active = true);

drop policy if exists faq_categories_select_admin on public.faq_categories;
create policy faq_categories_select_admin
  on public.faq_categories
  for select
  using (public.is_admin());

drop policy if exists faq_categories_admin_manage on public.faq_categories;
create policy faq_categories_admin_manage
  on public.faq_categories
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists faqs_select_public on public.faqs;
create policy faqs_select_public
  on public.faqs
  for select
  using (
    is_active = true
    and exists (
      select 1
      from public.faq_categories categories
      where categories.id = faqs.category_id
        and categories.is_active = true
    )
  );

drop policy if exists faqs_select_admin on public.faqs;
create policy faqs_select_admin
  on public.faqs
  for select
  using (public.is_admin());

drop policy if exists faqs_admin_manage on public.faqs;
create policy faqs_admin_manage
  on public.faqs
  for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.faq_categories_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists faq_categories_updated_at on public.faq_categories;
create trigger faq_categories_updated_at
before update on public.faq_categories
for each row execute function public.faq_categories_set_updated_at();

create or replace function public.faqs_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists faqs_updated_at on public.faqs;
create trigger faqs_updated_at
before update on public.faqs
for each row execute function public.faqs_set_updated_at();

insert into public.faq_categories (slug, title, description, sort_order, is_active)
values
  ('payment', 'Pagamentos', 'Compra, checkout, fatura ou acesso apos pagamento.', 1, true),
  ('technical', 'Problema tecnico', 'Erro no dashboard, visualizador, downloads ou login.', 2, true),
  ('account', 'Conta e acesso', 'Dados da conta, senha, acesso a materiais ou permissao.', 3, true),
  ('general', 'Duvida geral', 'Perguntas sobre materiais ou funcionamento.', 4, true)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.faqs (category_id, question, answer, sort_order, is_active)
select categories.id, entries.question, entries.answer, entries.sort_order, true
from (
  values
    ('payment', 'Paguei, mas a sebenta ainda nao aparece. O que faco?', 'Confirma se usaste o mesmo email no pagamento e no registo. Se nao aparecer em 10 minutos, avisa-me em ''Pagamentos''.', 1),
    ('technical', 'O material nao abre no site.', 'Tenta atualizar a pagina ou mudar de navegador. Se o erro persistir, manda-me um print.', 2),
    ('account', 'Perdi a minha palavra-passe.', 'Clica em ''Recuperar'' no login. Se nao receberes o email, fala comigo.', 3),
    ('general', 'Onde vejo as respostas as minhas duvidas?', 'Tudo o que conversarmos fica guardado na tua Area do Aluno > Suporte.', 4)
) as entries(category_slug, question, answer, sort_order)
join public.faq_categories categories on categories.slug = entries.category_slug
on conflict (category_id, question) do update
set
  answer = excluded.answer,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

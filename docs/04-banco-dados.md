# Banco de Dados — Mariana Explica

## 1. Contexto

Este documento define a modelagem inicial do banco de dados da plataforma Mariana Explica.

O banco é parte central da arquitetura e deve sustentar com segurança e consistência:

- autenticação e perfis
- catálogo de produtos
- liberação de conteúdo
- compras e pagamentos
- cupons
- afiliados
- notificações
- suporte
- administração da operação

Toda a estrutura deve ser mantida por migrations SQL versionadas.

---

## 2. Objetivo

Garantir uma base de dados:

- organizada por domínio
- segura por padrão
- compatível com RLS
- preparada para automações
- preparada para auditoria
- evolutiva sem depender de ajustes manuais no painel

---

## 3. Premissas de modelagem

### 3.1 Banco principal

- PostgreSQL no Supabase

### 3.2 Fonte oficial da estrutura

- migrations SQL versionadas

### 3.3 Convenções gerais

- tabelas com `id` como chave primária
- `created_at` obrigatório
- `updated_at` sempre que a entidade puder ser alterada
- status explícitos em fluxos operacionais
- foreign keys claras
- índices para filtros, relacionamento e busca
- RLS em todas as tabelas com dado privado
- logs e trilha de auditoria em fluxos críticos

---

## 4. Visão geral dos domínios

A modelagem será dividida pelos seguintes domínios:

1. identidade e perfis
2. catálogo e conteúdo
3. compras e pagamentos
4. afiliados
5. cupons e descontos
6. notificações e comunicação
7. suporte
8. configurações e operação
9. auditoria e automações

---

## 5. Domínio: identidade e perfis

## 5.1 Tabela `profiles`

Representa o perfil público-operacional do usuário autenticado.

### Finalidade
- complementar `auth.users`
- armazenar role e status
- controlar flags operacionais

### Colunas sugeridas

- `id uuid primary key`  
  referência ao usuário autenticado

- `full_name text not null`

- `email text not null`

- `role text not null default 'student'`
  valores esperados:
  - `student`
  - `affiliate`
  - `admin`

- `is_admin boolean not null default false`

- `status text not null default 'active'`
  valores esperados:
  - `active`
  - `inactive`
  - `blocked`
  - `pending_review`

- `avatar_url text null`

- `phone text null`

- `marketing_consent boolean not null default false`

- `notifications_enabled boolean not null default true`

- `last_login_at timestamptz null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- todo usuário autenticado deve possuir profile
- `role` e `is_admin` não devem depender do frontend
- admin pode visualizar todos os perfis
- usuário comum só acessa o próprio profile

### Índices
- índice em `role`
- índice em `status`
- índice em `email`

---

## 6. Domínio: catálogo e conteúdo

## 6.1 Tabela `products`

Representa os produtos vendidos ou liberados na plataforma.

### Finalidade
- catálogo comercial
- produto principal da jornada de compra

### Colunas sugeridas

- `id uuid primary key`

- `slug text unique not null`

- `title text not null`

- `short_description text null`

- `description text null`

- `product_type text not null`
  valores esperados:
  - `paid`
  - `free`
  - `hybrid`
  - `external_service`

- `status text not null default 'draft'`
  valores esperados:
  - `draft`
  - `published`
  - `archived`

- `price_cents integer not null default 0`

- `currency text not null default 'EUR'`

- `cover_image_url text null`

- `sales_page_enabled boolean not null default true`

- `requires_auth boolean not null default true`

- `is_featured boolean not null default false`

- `allow_affiliate boolean not null default true`

- `sort_order integer not null default 0`

- `published_at timestamptz null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- produto pago exige preço maior que zero
- produto gratuito deve ter `price_cents = 0`
- produto publicado aparece no catálogo
- produto em rascunho não aparece publicamente

### Índices
- índice em `slug`
- índice em `status`
- índice em `product_type`
- índice em `is_featured`
- índice em `sort_order`

---

## 6.2 Tabela `product_modules`

Representa os módulos internos de cada produto.

### Finalidade
- organizar conteúdo por blocos
- permitir bloqueio parcial em produtos híbridos

### Colunas sugeridas

- `id uuid primary key`

- `product_id uuid not null references products(id) on delete cascade`

- `title text not null`

- `description text null`

- `module_type text not null`
  valores esperados:
  - `pdf`
  - `video`
  - `external_link`
  - `mixed`

- `access_type text not null default 'paid_only'`
  valores esperados:
  - `public`
  - `registered`
  - `paid_only`

- `sort_order integer not null default 0`

- `is_preview boolean not null default false`

- `status text not null default 'published'`
  valores esperados:
  - `draft`
  - `published`
  - `archived`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- módulo pertence obrigatoriamente a um produto
- `access_type` define se o módulo pode aparecer como prévia
- conteúdo só deve ser entregue se produto e módulo estiverem ativos

### Índices
- índice em `product_id`
- índice em `sort_order`
- índice em `status`
- índice composto em `(product_id, access_type)`

---

## 6.3 Tabela `module_assets`

Representa os arquivos e ativos vinculados a módulos.

### Finalidade
- separar metadados do conteúdo físico
- controlar download, visualização e links externos

### Colunas sugeridas

- `id uuid primary key`

- `module_id uuid not null references product_modules(id) on delete cascade`

- `asset_type text not null`
  valores esperados:
  - `pdf`
  - `video_file`
  - `video_embed`
  - `external_link`

- `title text not null`

- `storage_bucket text null`

- `storage_path text null`

- `external_url text null`

- `mime_type text null`

- `file_size_bytes bigint null`

- `allow_download boolean not null default false`

- `allow_stream boolean not null default true`

- `watermark_enabled boolean not null default false`

- `status text not null default 'active'`
  valores esperados:
  - `active`
  - `inactive`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- somente um dos pares deve ser usado:
  - `storage_bucket` + `storage_path`
  - `external_url`
- arquivo em storage nunca deve ser público por padrão
- `allow_download` deve respeitar a regra do produto/compras

### Índices
- índice em `module_id`
- índice em `asset_type`
- índice em `status`

---

## 7. Domínio: compras e pagamentos

## 7.1 Tabela `orders`

Representa a intenção comercial do checkout.

### Finalidade
- registrar a operação comercial
- armazenar valor final, desconto e afiliado

### Colunas sugeridas

- `id uuid primary key`

- `user_id uuid not null references profiles(id) on delete restrict`

- `product_id uuid not null references products(id) on delete restrict`

- `coupon_id uuid null references coupons(id) on delete set null`

- `affiliate_id uuid null references affiliates(id) on delete set null`

- `status text not null default 'pending'`
  valores esperados:
  - `pending`
  - `paid`
  - `failed`
  - `cancelled`
  - `refunded`

- `currency text not null default 'EUR'`

- `base_price_cents integer not null`

- `discount_cents integer not null default 0`

- `final_price_cents integer not null`

- `payment_provider text null`

- `payment_reference text null`

- `checkout_session_id text null`

- `paid_at timestamptz null`

- `refunded_at timestamptz null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- um pedido representa uma tentativa de compra
- acesso só deve ser liberado quando `status = 'paid'`
- `final_price_cents` não pode ser negativo
- `payment_reference` deve permitir idempotência externa

### Índices
- índice em `user_id`
- índice em `product_id`
- índice em `status`
- índice em `payment_reference`
- índice em `created_at`
- índice composto em `(user_id, status)`

---

## 7.2 Tabela `order_items`

Mesmo que inicialmente cada pedido tenha um único produto, a modelagem deve prever expansão.

### Colunas sugeridas

- `id uuid primary key`

- `order_id uuid not null references orders(id) on delete cascade`

- `product_id uuid not null references products(id) on delete restrict`

- `product_title_snapshot text not null`

- `unit_price_cents integer not null`

- `discount_cents integer not null default 0`

- `final_price_cents integer not null`

- `created_at timestamptz not null default now()`

### Regras
- usar snapshot de título para preservar histórico
- inicialmente, 1 item por pedido é aceitável, mas a estrutura já nasce preparada

### Índices
- índice em `order_id`
- índice em `product_id`

---

## 7.3 Tabela `access_grants`

Representa a concessão de acesso efetivo do usuário a um produto.

### Finalidade
- separar compra de permissão ativa
- facilitar reembolso, bloqueio e acessos gratuitos

### Colunas sugeridas

- `id uuid primary key`

- `user_id uuid not null references profiles(id) on delete cascade`

- `product_id uuid not null references products(id) on delete cascade`

- `source_type text not null`
  valores esperados:
  - `purchase`
  - `free_claim`
  - `admin_grant`
  - `manual_adjustment`

- `source_order_id uuid null references orders(id) on delete set null`

- `status text not null default 'active'`
  valores esperados:
  - `active`
  - `revoked`
  - `expired`

- `granted_at timestamptz not null default now()`

- `revoked_at timestamptz null`

- `expires_at timestamptz null`

- `notes text null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- acesso à área do aluno deve ser baseado em `access_grants`
- reembolso pode revogar acesso
- produto gratuito também pode gerar `access_grants`

### Índices
- índice em `user_id`
- índice em `product_id`
- índice em `status`
- índice composto em `(user_id, product_id, status)`

### Constraint recomendada
- unique parcial para impedir dois grants ativos simultâneos para mesmo usuário/produto

---

## 8. Domínio: afiliados

## 8.1 Tabela `affiliates`

Representa o perfil de afiliado do usuário.

### Colunas sugeridas

- `id uuid primary key`

- `user_id uuid not null unique references profiles(id) on delete cascade`

- `affiliate_code text not null unique`

- `status text not null default 'active'`
  valores esperados:
  - `active`
  - `inactive`
  - `blocked`

- `commission_type text not null default 'percentage'`
  valores esperados:
  - `percentage`
  - `fixed`

- `commission_value integer not null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- cada usuário pode ter no máximo um perfil de afiliado
- código de afiliado deve ser único
- cálculo de comissão deve ser server-side

### Índices
- índice em `user_id`
- índice em `affiliate_code`
- índice em `status`

---

## 8.2 Tabela `affiliate_referrals`

Representa o vínculo entre clique/indicação e pedido.

### Colunas sugeridas

- `id uuid primary key`

- `affiliate_id uuid not null references affiliates(id) on delete cascade`

- `user_id uuid null references profiles(id) on delete set null`
  usuário indicado, se identificado

- `product_id uuid null references products(id) on delete set null`

- `order_id uuid null references orders(id) on delete set null`

- `referral_code text not null`

- `status text not null default 'tracked'`
  valores esperados:
  - `tracked`
  - `converted`
  - `cancelled`
  - `invalid`

- `commission_cents integer not null default 0`

- `tracked_at timestamptz not null default now()`

- `converted_at timestamptz null`

- `created_at timestamptz not null default now()`

### Regras
- referral pode nascer antes do pedido
- vira convertido apenas quando pedido fica `paid`
- cancelamento ou reembolso pode invalidar/refletir comissão

### Índices
- índice em `affiliate_id`
- índice em `order_id`
- índice em `status`
- índice em `referral_code`

---

## 9. Domínio: cupons e descontos

## 9.1 Tabela `coupons`

### Colunas sugeridas

- `id uuid primary key`

- `code text not null unique`

- `title text null`

- `discount_type text not null`
  valores esperados:
  - `percentage`
  - `fixed`

- `discount_value integer not null`

- `status text not null default 'active'`
  valores esperados:
  - `active`
  - `inactive`
  - `expired`

- `starts_at timestamptz null`

- `expires_at timestamptz null`

- `max_uses integer null`

- `max_uses_per_user integer null`

- `current_uses integer not null default 0`

- `minimum_order_cents integer null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- cupom precisa ser validado no backend
- expiração e limites devem ser checados antes de gerar pedido
- `current_uses` deve ser controlado com segurança transacional

### Índices
- índice em `code`
- índice em `status`
- índice em `expires_at`

---

## 9.2 Tabela `coupon_usages`

### Colunas sugeridas

- `id uuid primary key`

- `coupon_id uuid not null references coupons(id) on delete cascade`

- `user_id uuid not null references profiles(id) on delete cascade`

- `order_id uuid not null references orders(id) on delete cascade`

- `discount_cents integer not null`

- `used_at timestamptz not null default now()`

### Regras
- permite auditar uso por usuário
- base para `max_uses_per_user`

### Índices
- índice em `coupon_id`
- índice em `user_id`
- índice em `order_id`
- índice composto em `(coupon_id, user_id)`

---

## 10. Domínio: notificações e comunicação

## 10.1 Tabela `notifications`

### Colunas sugeridas

- `id uuid primary key`

- `user_id uuid not null references profiles(id) on delete cascade`

- `type text not null`
  valores esperados:
  - `transactional`
  - `informational`
  - `marketing`
  - `support`

- `title text not null`

- `message text not null`

- `link text null`

- `status text not null default 'unread'`
  valores esperados:
  - `unread`
  - `read`
  - `archived`

- `sent_via_email boolean not null default false`

- `sent_via_in_app boolean not null default true`

- `read_at timestamptz null`

- `created_at timestamptz not null default now()`

### Regras
- usuário só acessa as próprias notificações
- admin pode disparar notificações em massa via backend

### Índices
- índice em `user_id`
- índice em `status`
- índice em `type`
- índice em `created_at`

---

## 10.2 Tabela `email_deliveries`

### Finalidade
- log técnico de disparos de e-mail

### Colunas sugeridas

- `id uuid primary key`

- `user_id uuid null references profiles(id) on delete set null`

- `notification_id uuid null references notifications(id) on delete set null`

- `email_to text not null`

- `template_key text not null`

- `provider text null`

- `provider_message_id text null`

- `status text not null`
  valores esperados:
  - `queued`
  - `sent`
  - `failed`
  - `delivered`
  - `bounced`

- `error_message text null`

- `sent_at timestamptz null`

- `created_at timestamptz not null default now()`

### Índices
- índice em `user_id`
- índice em `notification_id`
- índice em `status`
- índice em `template_key`

---

## 11. Domínio: suporte

## 11.1 Tabela `support_tickets`

### Colunas sugeridas

- `id uuid primary key`

- `user_id uuid not null references profiles(id) on delete cascade`

- `subject text not null`

- `message text not null`

- `status text not null default 'open'`
  valores esperados:
  - `open`
  - `in_progress`
  - `answered`
  - `closed`

- `priority text not null default 'normal'`
  valores esperados:
  - `low`
  - `normal`
  - `high`

- `assigned_admin_id uuid null references profiles(id) on delete set null`

- `last_reply_at timestamptz null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- usuário vê apenas seus tickets
- admin pode ver todos
- histórico de resposta deve ficar separado

### Índices
- índice em `user_id`
- índice em `status`
- índice em `priority`
- índice em `assigned_admin_id`

---

## 11.2 Tabela `support_ticket_messages`

### Colunas sugeridas

- `id uuid primary key`

- `ticket_id uuid not null references support_tickets(id) on delete cascade`

- `sender_user_id uuid not null references profiles(id) on delete cascade`

- `sender_role text not null`
  valores esperados:
  - `student`
  - `admin`

- `message text not null`

- `created_at timestamptz not null default now()`

### Índices
- índice em `ticket_id`
- índice em `sender_user_id`
- índice em `created_at`

---

## 12. Domínio: configurações e operação

## 12.1 Tabela `site_config`

### Finalidade
- guardar parâmetros globais da plataforma

### Colunas sugeridas

- `id uuid primary key`

- `config_key text not null unique`

- `config_value jsonb not null`

- `description text null`

- `is_public boolean not null default false`

- `updated_by uuid null references profiles(id) on delete set null`

- `created_at timestamptz not null default now()`

- `updated_at timestamptz not null default now()`

### Regras
- configs públicas podem ser lidas pelo frontend
- configs privadas só via backend/admin

### Índices
- índice em `config_key`
- índice em `is_public`

---

## 13. Domínio: auditoria e automações

## 13.1 Tabela `audit_logs`

### Finalidade
- rastrear ações críticas

### Colunas sugeridas

- `id uuid primary key`

- `actor_user_id uuid null references profiles(id) on delete set null`

- `actor_role text null`

- `action text not null`

- `entity_type text not null`

- `entity_id uuid null`

- `metadata jsonb not null default '{}'::jsonb`

- `ip_address text null`

- `user_agent text null`

- `created_at timestamptz not null default now()`

### Regras
- registrar ações administrativas e operações sensíveis
- logs não devem ser editáveis por usuários comuns

### Índices
- índice em `actor_user_id`
- índice em `action`
- índice em `entity_type`
- índice em `created_at`

---

## 13.2 Tabela `job_runs`

### Finalidade
- controle de automações, cron jobs e reprocessamento

### Colunas sugeridas

- `id uuid primary key`

- `job_name text not null`

- `status text not null`
  valores esperados:
  - `running`
  - `success`
  - `failed`

- `started_at timestamptz not null default now()`

- `finished_at timestamptz null`

- `payload jsonb not null default '{}'::jsonb`

- `result jsonb not null default '{}'::jsonb`

- `error_message text null`

- `idempotency_key text null`

- `created_at timestamptz not null default now()`

### Regras
- automações críticas devem registrar execução
- idempotência deve ser possível quando aplicável

### Índices
- índice em `job_name`
- índice em `status`
- índice em `started_at`
- índice em `idempotency_key`

---

## 14. Relacionamentos principais

### Núcleo de identidade
- `profiles.id` → referência central do usuário

### Catálogo
- `products.id` → `product_modules.product_id`
- `product_modules.id` → `module_assets.module_id`

### Vendas
- `profiles.id` → `orders.user_id`
- `products.id` → `orders.product_id`
- `orders.id` → `order_items.order_id`
- `orders.id` → `access_grants.source_order_id`

### Afiliados
- `profiles.id` → `affiliates.user_id`
- `affiliates.id` → `affiliate_referrals.affiliate_id`

### Cupons
- `coupons.id` → `orders.coupon_id`
- `coupons.id` → `coupon_usages.coupon_id`

### Notificações
- `profiles.id` → `notifications.user_id`

### Suporte
- `profiles.id` → `support_tickets.user_id`
- `support_tickets.id` → `support_ticket_messages.ticket_id`

---

## 15. Estratégia de RLS

RLS deve ser habilitado obrigatoriamente em tabelas com dados privados.

### Tabelas com RLS obrigatório

- `profiles`
- `orders`
- `order_items`
- `access_grants`
- `notifications`
- `email_deliveries`
- `support_tickets`
- `support_ticket_messages`
- `affiliate_referrals`
- `audit_logs` (restrito a admin)
- `site_config` (parcial, conforme is_public)

### Regras gerais

#### Usuário comum
- lê apenas os próprios dados
- não acessa dados de outros usuários
- não acessa logs administrativos

#### Admin
- acesso ampliado conforme policy
- leitura global nos módulos operacionais
- escrita controlada em tabelas administrativas

---

## 16. Triggers recomendadas

### 16.1 Trigger de `updated_at`
Aplicar nas tabelas mutáveis:
- `profiles`
- `products`
- `product_modules`
- `module_assets`
- `orders`
- `access_grants`
- `affiliates`
- `coupons`
- `support_tickets`
- `site_config`

### 16.2 Trigger de bootstrap de perfil
- criar `profile` automaticamente quando usuário nasce no auth

### 16.3 Trigger opcional de auditoria
- registrar ações críticas em `audit_logs`

---

## 17. Constraints recomendadas

- `check (price_cents >= 0)`
- `check (discount_cents >= 0)`
- `check (final_price_cents >= 0)`
- `check (commission_value >= 0)`
- `check (current_uses >= 0)`
- `check` de enums textuais quando não usar tipo enum
- unique em `products.slug`
- unique em `affiliates.affiliate_code`
- unique em `coupons.code`

---

## 18. Estratégia de storage vinculada ao banco

Arquivos devem ser organizados por paths previsíveis e sanitizados.

### Estrutura sugerida

- `products/{product_id}/modules/{module_id}/assets/{asset_id}.pdf`
- `products/{product_id}/covers/{file}`
- `support/{ticket_id}/attachments/{file}`

### Regra
- banco guarda referência lógica
- acesso real ao arquivo passa por validação backend

---

## 19. Seeds iniciais recomendados

Criar seeds ou migrations de bootstrap para:

- configuração inicial do site
- perfil admin principal
- produtos iniciais
- templates de notificação
- configurações públicas essenciais

---

## 20. Ordem recomendada de migrations

1. extensões e helpers base
2. tabela `profiles`
3. tabelas de catálogo (`products`, `product_modules`, `module_assets`)
4. tabelas de vendas (`orders`, `order_items`, `access_grants`)
5. afiliados
6. cupons
7. notificações
8. suporte
9. configurações
10. auditoria e automações
11. índices
12. triggers
13. RLS e policies
14. seeds iniciais

---

## 21. Critérios de aceite

A modelagem será considerada adequada quando:

- suportar compra, acesso e bloqueio de conteúdo
- permitir produtos pagos, gratuitos e híbridos
- permitir controle seguro de arquivos
- permitir afiliados e cupons
- permitir área do aluno e admin
- permitir rastreabilidade operacional
- estar pronta para migrations, RLS e Edge Functions

---

## 22. Riscos e observações

### Riscos
- modelagem simplificada demais para afiliados
- ausência de logs em fluxos críticos
- confiar acesso apenas na compra e não em grants
- armazenamento público indevido de PDFs
- falta de índices em filtros operacionais

### Observações
- a tabela `access_grants` é essencial para separar pagamento de acesso
- `orders` deve ser tratada como histórico comercial
- `module_assets` não deve expor arquivo diretamente
- qualquer regra crítica deve ser reforçada por backend e RLS
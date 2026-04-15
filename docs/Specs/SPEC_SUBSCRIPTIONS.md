# ESPECIFICAÇÕES - PLANOS E SUBSCRIÇÕES

## Visão Geral

Sistema de **Planos e Subscrições** implementa modelo SaaS escalável com suporte a múltiplos tiers (free, monthly, yearly), renovação automática, controle de acesso e gestão de ciclo de vida. Totalmente reutilizável em qualquer plataforma baseada em cobrança recorrente.

---

## 1. MODELO DE NEGÓCIO

### Tiers Disponíveis

| Tier | Billing | Auto-Renew | Features | Preço |
|------|---------|-----------|----------|-------|
| **free** | N/A | - | Acesso limitado | R$ 0 |
| **monthly** | Mensal | Sim | Full features | Configurável |
| **yearly** | Anual | Sim | Full features + discount | Configurável |

### Ciclo de Vida

```
Usuário criado
    ↓
subscription_tier = "free" (default)
    ↓
Upgrade para "monthly" / "yearly"
    ↓
Pagamento processado
    ↓
subscription_until = now + 1 month/year
    ↓
Renovação automática a cada ciclo
    ↓
Cancelamento manual (downgrades)
```

---

## 2. TABELAS DE BANCO DE DADOS

### `plans`

```sql
id UUID PRIMARY KEY
name VARCHAR -- "Professional", "Enterprise"
tier ENUM: 'free'|'monthly'|'yearly'
price DECIMAL -- BRL
billing_period ENUM: 'monthly'|'yearly'|'lifetime'
description TEXT
features JSONB -- Array de features inclusos
max_items INTEGER -- Limite de itens (NULL = ilimitado)
max_users INTEGER -- Limite de usuários
max_storage_mb INTEGER -- Limite de storage
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `prices` (Histórico de Preços)

```sql
id UUID PRIMARY KEY
plan_id UUID (FK plans.id)
amount DECIMAL -- Preço em BRL
currency VARCHAR -- "BRL"
valid_from TIMESTAMP
valid_until TIMESTAMP
created_at TIMESTAMP
```

### `subscriptions` (Em profiles.tsx)

```sql
-- Colunas na tabela profiles:
subscription_tier ENUM: 'free'|'monthly'|'yearly'
subscription_until TIMESTAMP -- Data de expiração
subscription_auto_renew BOOLEAN DEFAULT true
subscription_cancelled_at TIMESTAMP -- Soft cancel
subscription_cancel_reason TEXT
stripe_customer_id TEXT -- ID externo (se using Stripe)
stripe_subscription_id TEXT -- ID da subscription externa
```

### `subscription_events` (Auditoria)

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id)
event_type ENUM: 'upgrade'|'downgrade'|'renew'|'cancel'|'refund'
old_tier VARCHAR
new_tier VARCHAR
amount DECIMAL
reference_id TEXT -- stripe_subscription_id, etc
created_at TIMESTAMP
metadata JSONB -- Dados adicionais
```

---

## 3. ADMIN INTERFACE

### Localização
- **URL**: `/admin/planos`
- **Arquivo**: `src/pages/admin/PlansPage.tsx`
- **Componente**: `src/components/admin/PlansTab.tsx`

### Features

#### 1. Manage Planos
- ✅ Criar novo plano
- ✅ Editar nome, descrição, preço
- ✅ Ativar/desativar plano
- ✅ Deletar plano (soft delete)
- ✅ Visualizar histórico de preço

#### 2. Features por Plano
- ✅ Adicionar/remover features dinamicamente
- ✅ Armazenar em JSONB
- ✅ Suporte a nested features

#### 3. Limites por Tier
```
Free:
  - 5 itens
  - 1 usuário
  - 100 MB storage

Monthly:
  - 100 itens
  - 10 usuários
  - 5 GB storage

Yearly:
  - Ilimitado
  - 50 usuários
  - 100 GB storage
```

#### 4. Histórico de Preços
- ✅ Log de mudanças
- ✅ Datas de vigência
- ✅ Preço anterior/novo

### Tabela de Administração

```
Plan Name | Tier | Price | Billing | Features | Status | Actions
────────────────────────────────────────────────────────────────────
Basic | monthly | R$ 99 | Monthly | 5 features | Active | Edit Delete
```

---

## 4. FLUXO DE UPGRADE/DOWNGRADE

### Upgrade (free → paid)

```
1. Usuário clica "Upgrade"
   ↓
2. Exibe modal de seleção (monthly/yearly)
   ↓
3. Processa pagamento (Stripe/PagSeguro)
   ↓
4. Se sucesso:
   - Atualiza subscription_tier
   - Define subscription_until
   - Log em subscription_events
   - Toast de sucesso
   ↓
5. Se falha:
   - Mantém tier anterior
   - Toast com erro
```

### Downgrade (yearly → monthly)

```
1. Usuário clica "Mudar plano"
   ↓
2. Exibe opções de downgrade
   ↓
3. Pro-rata refund (se aplicável)
   ↓
4. Novo período começa imediatamente
   ↓
5. Log de downgrade
```

### Cancelamento

```
1. Usuário pede cancelamento
   ↓
2. Confirmação dupla:
   - "Tem certeza?"
   - "Você perderá acesso em X dias"
   ↓
3. Marca subscription_cancelled_at
   ↓
4. Mantém acesso até subscription_until
   ↓
5. Após expiração → reverte para "free"
```

---

## 5. CONTROLE DE ACESSO

### Verificação de Permissão

```typescript
function canAccess(user, feature) {
  const tier = user.subscription_tier;
  const plan = plans.find(p => p.tier === tier);
  return plan.features.includes(feature);
}
```

### Limites de Cota

```typescript
async function checkQuota(user, resource) {
  const plan = plans[user.subscription_tier];
  const used = await count(user.id, resource);
  return used < plan[`max_${resource}`];
}
```

### Exemplos de Acesso

| Feature | Free | Monthly | Yearly |
|---------|------|---------|--------|
| Criar perfil | ✅ | ✅ | ✅ |
| Upload certificado | ❌ | ✅ | ✅ |
| Analytics completo | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Suporte prioritário | ❌ | ✅ | ✅ |

---

## 6. RENOVAÇÃO AUTOMÁTICA

### Agendador (Cron Job)

```
Frequência: Diária (00:00 UTC)

Para cada subscription com subscription_until <= hoje:
  1. Se auto_renew = false → Downgrade para free
  2. Se auto_renew = true → Processa renovação
  3. Gera invoice
  4. Envia email confirmação
  5. Log em subscription_events
```

### Tratamento de Falha

```
Se pagamento falha:
  1. Retry após 3 dias
  2. Se falha novamente: notifica user (email)
  3. Após 30 dias sem pagamento: downgrade automático
  4. Log com motivo da falha
```

---

## 7. EDGE FUNCTIONS

### `process-subscription-renewal`
```
POST /functions/v1/process-subscription-renewal
Body: (invoked by scheduler)
Response: { processed: N, success: N, failed: N }
```

### `create-stripe-customer`
```
POST /functions/v1/create-stripe-customer
Auth: Bearer token
Body: { user_id }
Response: { stripe_customer_id, stripe_url }
```

### `upgrade-subscription`
```
POST /functions/v1/upgrade-subscription
Auth: Bearer token
Body: { new_tier: 'monthly'|'yearly' }
Response: { success, subscription_until, invoice_id }
```

### `downgrade-subscription`
```
POST /functions/v1/downgrade-subscription
Auth: Bearer token
Body: { new_tier: 'free'|'monthly' }
Response: { success, refund_amount, effective_date }
```

### `get-subscription-status`
```
GET /functions/v1/get-subscription-status
Auth: Bearer token
Response: {
  tier: 'free'|'monthly'|'yearly',
  until: ISO date,
  auto_renew: bool,
  features: [],
  usage: { items: N/max, storage: N/max }
}
```

---

## 8. COMPONENTES

### PlanSelectionModal
**Localização**: `src/components/PlanSelectionModal.tsx`

```typescript
<PlanSelectionModal
  open={open}
  onOpenChange={setOpen}
  currentTier={user.subscription_tier}
  onSelectPlan={handleUpgrade}
/>
```

**Features**:
- ✅ Comparison table (free vs monthly vs yearly)
- ✅ Preços atualizados dinamicamente
- ✅ Mostrar economia de yearly
- ✅ CTA "Upgrade now"

### PricingCard
**Localização**: `src/components/PricingCard.tsx`

```typescript
<PricingCard
  plan={plan}
  currentTier={user.subscription_tier}
  onUpgrade={() => {...}}
/>
```

**Features**:
- ✅ Exibe nome, preço, features
- ✅ Badge se popular
- ✅ Button apropriado (Upgrade/Current/Downgrade)

---

## 9. INTEGRAÇÕES DE PAGAMENTO

### Stripe Integration

```typescript
// Criar subscription
const session = await stripe.checkout.sessions.create({
  customer: stripe_customer_id,
  line_items: [{
    price: stripe_price_id,
    quantity: 1,
  }],
  mode: 'subscription',
  success_url: 'https://app.example.com/success',
  cancel_url: 'https://app.example.com/cancel',
});
```

### Webhooks

```
stripe.checkout.session.completed → Ativa subscription
stripe.customer.subscription.renewed → Log renovação
stripe.invoice.payment_failed → Notifica retry
```

---

## 10. EMAIL TEMPLATES

### Template: Upgrade Confirmado
```
Assunto: Bem-vindo ao plano [PLAN]
Corpo:
- Congratulações
- Features desbloqueadas
- Data de renovação
- Link para dashboard
```

### Template: Renovação Falha
```
Assunto: Falha ao renovar sua assinatura
Corpo:
- Detalhes da falha
- CTA "Atualizar método de pagamento"
- Link para settings
```

### Template: Cancelamento Confirmado
```
Assunto: Sua assinatura foi cancelada
Corpo:
- Confirmação de cancelamento
- Data de downgrade (quando acesso expira)
- Opção de reativar
```

---

## 11. RELATÓRIOS & ANALYTICS

### Dashboard Admin

```
Total Revenue (mês): R$ X
Active Subscriptions: N
Churn Rate: X%
MRR (Monthly Recurring): R$ X
Top Tier: [yearly|monthly|free]
```

### Per-Tier

```
Free: N users
Monthly: N users (R$ X/mês)
Yearly: N users (R$ X/ano)
```

---

## 12. SEGURANÇA & COMPLIANCE

### PCI DSS
- ✅ Nunca armazena dados de cartão
- ✅ Usa Stripe (PCI Level 1)
- ✅ Webhooks verified com secret

### Validações
- ✅ subscription_until sempre > hoje
- ✅ Downgrade só se tier menor
- ✅ Cancelamento é idempotente

### Auditoria
- ✅ Todos os eventos logged
- ✅ Imutável após criação
- ✅ Timestamps de criação

---

## 13. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas de banco de dados criadas
- [x] Admin page `/admin/planos`
- [x] CRUD de planos
- [x] Componentes de pricing card
- [x] Modal de seleção de plano
- [x] Processamento de pagamento (Stripe)
- [x] Webhooks configurados
- [x] Email templates
- [x] Validação de acesso por tier
- [x] Cron de renovação automática
- [x] Tratamento de falha de pagamento
- [x] Logs de auditoria

---

## 14. ROADMAP FUTURO

- [ ] Multiple currencies (USD, EUR)
- [ ] Discounts & promo codes
- [ ] Trial periods
- [ ] Family plans / shared billing
- [ ] Usage-based pricing
- [ ] Dunning management (retry logic avançado)

---

## 15. REFERÊNCIAS

- [Stripe Subscription Docs](https://stripe.com/docs/billing/subscriptions)
- [SaaS Pricing Best Practices](https://www.paddle.com/blog/saas-pricing)

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
- **Último Revisor**: AI Assistant

# ESPECIFICAÇÕES - COUPONS E DESCONTOS

## Visão Geral

Sistema de **Coupons e Descontos** implementa códigos promocionais reutilizáveis com validação, limites de uso, cálculo de desconto (fixo/percentual) e auditoria. Aplicável em e-commerce, SaaS, marketplaces.

---

## 1. TIPOS DE DESCONTO

### Por Estrutura

| Tipo | Exemplo | Uso |
|------|---------|-----|
| **Fixo** | R$ 50 off | Desconto em reais |
| **Percentual** | 20% off | Desconto em percentage |
| **Free shipping** | Frete grátis | Aplicável em e-commerce |
| **BOGO** | 2x1 | Buy one get one |

### Por Aplicação

| Escopo | Exemplo |
|--------|---------|
| Global | Qualquer produto/serviço |
| Categoria | Apenas cursos |
| Específico | Apenas plano "yearly" |
| Primeira compra | New users only |
| Usuário | VIP customers |

---

## 2. TABELAS DE BANCO DE DADOS

### `coupons`

```sql
id UUID PRIMARY KEY
code VARCHAR UNIQUE -- "SUMMER20", "WELCOME50"
description TEXT
discount_type ENUM: 'fixed'|'percentage'|'free_shipping'|'bogo'
discount_value DECIMAL -- 50.00 ou 20.00
max_discount_amount DECIMAL -- Cap do desconto (ex: R$ 100)
min_purchase_amount DECIMAL -- Mínimo para usar (ex: R$ 500)
applicable_to ENUM: 'all'|'category'|'specific'|'user'
applicable_resource_id UUID -- Qual categoria/produto/user
applicable_tier ENUM: 'all'|'free'|'monthly'|'yearly' -- Se subscription

-- Validade
valid_from TIMESTAMP
valid_until TIMESTAMP

-- Limites
max_uses INTEGER -- NULL = ilimitado
max_uses_per_user INTEGER -- Max por person
current_uses INTEGER DEFAULT 0

-- Status
is_active BOOLEAN DEFAULT true
created_by UUID (FK profiles.id, admin)
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `coupon_usage`

```sql
id UUID PRIMARY KEY
coupon_id UUID (FK coupons.id)
user_id UUID (FK profiles.id)
transaction_id UUID (FK transactions.id)
discount_amount DECIMAL -- R$ realmente dado
used_at TIMESTAMP
```

### `coupon_validation_logs`

```sql
id UUID PRIMARY KEY
coupon_code VARCHAR
user_id UUID
is_valid BOOLEAN
reason VARCHAR -- 'expired', 'max_uses_reached', 'min_purchase', etc
attempted_at TIMESTAMP
```

---

## 3. FLUXO DE APLICAÇÃO

### Validação de Coupon

```
1. Usuário digita código no checkout
   ↓
2. Click "Aplicar cupom"
   ↓
3. Backend valida:
   - Coupon existe?
   - Is active?
   - Is within valid dates?
   - Max uses reached?
   - User already used it?
   - Applicable to this cart?
   - Min purchase met?
   ↓
4. Se válido:
   - Calcula desconto
   - Exibe desconto no total
   - Toast sucesso
   ↓
5. Se inválido:
   - Toast com motivo específico
   - "Cupom expirado"
   - "Limite de uso atingido"
   - "Não aplicável nesta compra"
```

### Cálculo de Desconto

```typescript
function calculateDiscount(coupon, cartValue) {
  if (coupon.discount_type === 'fixed') {
    const discount = coupon.discount_value;
    return Math.min(discount, coupon.max_discount_amount || discount);
  }
  
  if (coupon.discount_type === 'percentage') {
    const discount = (cartValue * coupon.discount_value) / 100;
    return Math.min(discount, coupon.max_discount_amount || discount);
  }
  
  if (coupon.discount_type === 'free_shipping') {
    return shippingCost;
  }
  
  return 0;
}
```

---

## 4. ADMIN INTERFACE

### Localização
- **URL**: `/admin/coupons`
- **Arquivo**: `src/components/admin/CouponsTab.tsx`

### Features

#### 1. CRUD de Coupons

- ✅ Criar novo coupon
  - Gerar código aleatório ou customizado
  - Selecionar tipo (fixed/percent/free)
  - Definir valor
  - Escolher applicability (global/category/specific)
  - Definir datas (from/until)
  - Limites (max uses, per user)

- ✅ Editar coupon existente
  - Atualizar valores/datas
  - Reativar/desativar
  - Expandir limites de uso

- ✅ Deletar coupon
  - Soft delete (archived)
  - Histórico preservado

#### 2. Bulk Operations

```
[ ] Copiar código           [ ] Desativar múltiplos
[ ] Exportar como CSV       [ ] Estender validade
[ ] Duplicar com novo código
```

#### 3. Analytics

```
Coupon: SUMMER20
────────────────
Total Uses: 342
Avg Discount: R$ 45
Total Given: R$ 15.390
Unique Users: 287
Conversion Lift: +12%
```

#### 4. Tabela de Coupons

```
Code | Type | Value | Uses | Expires | Status | Actions
─────────────────────────────────────────────────────────
SUMMER20 | % | 20% | 342/500 | 2026-08-31 | Active | Edit
WELCOME50 | $ | R$50 | 128/∞ | Never | Active | Edit
```

---

## 5. COMPONENTES FRONTEND

### CouponInput

**Localização**: `src/components/CouponInput.tsx`

```typescript
<CouponInput
  onApply={handleApply}
  loading={loading}
  error={error}
/>
```

**Features**:
- ✅ Input field com placeholder
- ✅ Button "Aplicar"
- ✅ Loading state durante validação
- ✅ Error message com motivo
- ✅ Success message com desconto
- ✅ Remove coupon button (se aplicado)

### CouponBadge

```typescript
<CouponBadge
  code="SUMMER20"
  discount={45}
  type="percentage"
/>
```

**Exibe**:
```
✓ SUMMER20 - 20% off (até R$ 100)
```

---

## 6. REGRAS DE NEGÓCIO

### Validações

```
- Code: 3-20 caracteres alfanuméricos
- Max uses: > 0 ou NULL
- Per user: >= 1
- Min purchase: >= 0
- Discount value > 0
- Valid from < valid_until
```

### Casos Especiais

```
Combinabilidade:
  - Apenas 1 coupon por transação (padrão)
  - Ou permitir múltiplos (requer config)

Stacking (não recomendado):
  - Não somar descontos
  - Usar maior desconto

Interação com promoções:
  - Coupon tem prioridade
  - Ou escolhe cliente qual aplicar
```

### Expiration Handling

```
- Coupon expirado: Rejeita uso
- Próximo a expirar: Warning (7 dias)
- Recuperação: Admin pode estender
```

---

## 7. EDGE FUNCTIONS

### `validate-coupon`
```
POST /functions/v1/validate-coupon
Body: {
  code: string,
  cart_value: number,
  applicable_to?: string
}
Response: {
  valid: bool,
  discount_amount: number,
  discount_type: string,
  reason?: string
}
```

### `apply-coupon`
```
POST /functions/v1/apply-coupon
Auth: Bearer token
Body: { coupon_code, transaction_id }
Response: { success, discount, new_total }
```

### `get-coupon-stats`
```
GET /functions/v1/get-coupon-stats?coupon_id=X
Auth: Bearer token (admin)
Response: {
  total_uses,
  unique_users,
  avg_discount,
  total_given,
  usage_by_day,
  top_users
}
```

### `generate-bulk-coupons`
```
POST /functions/v1/generate-bulk-coupons
Auth: Bearer token (admin)
Body: { count, prefix, discount_type, discount_value }
Response: { codes: string[], created: N }
```

---

## 8. INTEGRAÇÕES

### Com Checkout

```
Total: R$ 500
- Desconto (SUMMER20): -R$ 100
────────
Total Final: R$ 400
```

### Com Subscription

```
- Plano Yearly: R$ 999/ano
- Coupon WELCOME50: -R$ 50
- = R$ 949/ano
```

### Com Múltiplos Produtos

```
Cesta:
  - Curso A: R$ 200
  - Curso B: R$ 300
  Total: R$ 500

Coupon SUMMER20 (20%): -R$ 100
Final: R$ 400
```

---

## 9. TEMPLATES EMAIL

### Template: Coupon Gerado

```
Assunto: Aqui está seu cupom exclusivo
Corpo:
- Código: WELCOME50
- Desconto: R$ 50 off
- Válido até: 2026-05-31
- Link para aplicar
```

### Template: Expiring Soon

```
Assunto: Seu cupom expira em 7 dias
Corpo:
- Código: SUMMER20
- Expira: 2026-07-05
- CTA: Use agora
```

---

## 10. SEGURANÇA

### Prevenção de Fraude

```
- Rate limit: 5 tentativas/min por IP
- Block: 10+ tentativas falhadas
- Log todas as tentativas
- Alert se muitas falhas em padrão
- Validar desconto != maior que o total
```

### Um Coupon, Uma Vez por Usuário?

```sql
-- Verificar se user já usou este coupon
SELECT COUNT(*) FROM coupon_usage
WHERE coupon_id = $1 AND user_id = $2

-- Se > max_uses_per_user: reject
```

---

## 11. ANALYTICS & REPORTING

### Dashboard Admin

```
Total Coupons: N
Active: N
Inactive: N
Total Discounts Given: R$ X
Avg Per Coupon: R$ Y
Usage Rate: X%
Most Popular: SUMMER20
```

### ROI de Campanha

```
Campaign: Summer 2026
Coupons Used: 342
Discount Total: R$ 15.390
Revenue Uplift: R$ 85.000
ROI: 450%
```

---

## 12. ROADMAP

- [ ] Tiered discounts (uso N = desconto extra)
- [ ] Referral coupons (personalizados por user)
- [ ] Programmatic coupon generation
- [ ] A/B testing (coupon value optimization)
- [ ] SMS distribution
- [ ] QR codes

---

## 13. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas criadas
- [x] Admin `/admin/coupons` com CRUD
- [x] CouponInput component
- [x] Validation logic
- [x] Application na checkout
- [x] Edge functions
- [x] Email templates
- [x] Analytics & reporting
- [x] Security & fraud prevention
- [x] Bulk operations

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção

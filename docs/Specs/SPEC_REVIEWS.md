# ESPECIFICAÇÕES - AVALIAÇÕES E REVIEWS

## Visão Geral

Sistema de **Avaliações e Reviews** implementa rating 5-stars com comentários, moderation, ranking e trust metrics. Aplicável em marketplaces, e-commerce, plataformas de serviços e redes sociais.

---

## 1. MODELO DE DADOS

### Tipo de Avaliação

| Contexto | Quem Avalia | Alvo | Exemplo |
|----------|-----------|------|---------|
| Service | Cliente | Profissional | Paciente avalia enfermeiro |
| Product | Comprador | Produto | Usuário avalia curso |
| Seller | Comprador | Loja/Empresa | Usuário avalia empresa |
| Two-way | Ambos | Ambos | Profissional avalia cliente |

---

## 2. TABELAS DE BANCO DE DADOS

### `reviews`

```sql
id UUID PRIMARY KEY
author_id UUID (FK profiles.id) -- Quem avaliou
target_id UUID (FK profiles.id) -- Quem/o que foi avaliado
target_type VARCHAR -- 'professional'|'company'|'product'|'course'
target_resource_id UUID -- ID adicional (course_id, product_id)
rating INTEGER CHECK (rating >= 1 AND rating <= 5)
title VARCHAR (100 chars)
content TEXT (3000 chars max)
is_verified_purchase BOOLEAN -- Comprou mesmo?
is_moderated BOOLEAN DEFAULT false
moderation_status ENUM: 'pending'|'approved'|'rejected'
moderation_reason VARCHAR (se rejected)
created_at TIMESTAMP
updated_at TIMESTAMP
helpful_count INTEGER DEFAULT 0
unhelpful_count INTEGER DEFAULT 0
```

### `review_moderation_reports`

```sql
id UUID PRIMARY KEY
review_id UUID (FK reviews.id)
reason ENUM: 'spam'|'inappropriate'|'fake'|'dupe'|'other'
description TEXT
reported_by UUID (FK profiles.id)
moderated_by UUID (FK profiles.id, admin)
status ENUM: 'pending'|'resolved'
action ENUM: 'approve'|'reject'|'edit'
created_at TIMESTAMP
resolved_at TIMESTAMP
```

### `review_helpful_votes`

```sql
id UUID PRIMARY KEY
review_id UUID (FK reviews.id)
user_id UUID (FK profiles.id)
is_helpful BOOLEAN
created_at TIMESTAMP
UNIQUE(review_id, user_id) -- 1 voto por usuário
```

### `review_stats` (Cache)

```sql
id UUID PRIMARY KEY
target_id UUID
target_type VARCHAR
total_reviews INTEGER
avg_rating DECIMAL(3,2)
rating_distribution JSONB -- {1: 5, 2: 3, 3: 10, 4: 25, 5: 100}
updated_at TIMESTAMP
```

---

## 3. COMPONENTES

### StarRating (Input)

**Localização**: `src/components/StarRating.tsx`

```typescript
<StarRating
  value={rating}
  onChange={setRating}
  size="md"
  readonly={false}
/>
```

**Features**:
- ✅ 5 stars interativas
- ✅ Hover preview
- ✅ Suporta half-stars (1.5, 2.5, etc)
- ✅ Opcional readonly
- ✅ Tamanhos customizáveis

### ReviewForm

**Localização**: `src/components/ReviewForm.tsx`

```typescript
<ReviewForm
  targetId={professionalId}
  targetType="professional"
  onSubmit={handleSubmit}
/>
```

**Fields**:
- Rating (1-5 stars)
- Title (3-100 chars)
- Content (3-3000 chars)
- Checkbox: "Compra verificada"
- Submit button

**Validações**:
```
- Rating: obrigatório
- Title: 3-100 chars
- Content: 3-3000 chars
- Author não pode auto-avaliar
- Apenas 1 review por author/target
```

### ReviewList

**Localização**: `src/components/ReviewList.tsx`

```typescript
<ReviewList
  targetId={professionalId}
  targetType="professional"
  sortBy="most_helpful"
  perPage={10}
/>
```

**Features**:
- ✅ Paginação
- ✅ Filtro por rating (1-5)
- ✅ Sort: newest, highest, lowest, most_helpful
- ✅ Busca por texto
- ✅ Lazy load com intersection observer

### ReviewCard

```typescript
<ReviewCard
  review={review}
  onHelpful={(isHelpful) => {...}}
  showActions={isAdmin || isSelf}
/>
```

**Exibe**:
- Avatar + nome do autor
- Rating (stars)
- "Compra verificada" badge (se aplicável)
- Título + conteúdo
- Data relativa ("há 2 aqui")
- + helpful / − unhelpful buttons
- Menu de ações (edit, delete, report)

### ReviewsSummary

```typescript
<ReviewsSummary
  targetId={id}
  targetType="professional"
/>
```

**Exibe**:
- Rating médio (4.8)
- Legenda (Ex: 128 avaliações)
- Distribuição por star (5★ 45%, 4★ 30%, etc)
- CTA "Deixar avaliação"

---

## 4. FLUXOS

### Criar Review

```
1. Usuário clica "Deixar avaliação"
   ↓
2. Verificação:
   - User autenticado?
   - Já tem review para este alvo?
   - Eligible (e.g. compra verificada)?
   ↓
3. Dialog/Modal com ReviewForm
   ↓
4. Usuário preenche:
   - Rating
   - Título
   - Comentário
   ↓
5. Submit
   ↓
6. Backend valida + insere
   ↓
7. Auto-moderation? (flags spam/bad words)
   ↓
8. Se passa: publica imediatamente
   Se flags: status "pending" (admin revisa)
   ↓
9. Toast sucesso
   ↓
10. Review aparece na lista (ou "Pending moderation")
```

### Editar Review

```
1. Autor clica "Editar" em próprio review
   ↓
2. Modal abre com dados pré-preenchidos
   ↓
3. Atualiza campos (rating, título, content)
   ↓
4. Submit → UPDATE reviews
   ↓
5. Se mudou rating: recalcula stats
   ↓
6. Toast sucesso
```

### Deletar Review

```
1. Autor/Admin clica "Deletar"
   ↓
2. Confirmação dupla
   ↓
3. Soft delete (deleted_at timestamp)
   ↓
4. Recalcula stats
   ↓
5. Remove da lista
```

### Marcar útil/inútil

```
1. Usuário clica "+ Útil" ou "− Inútil"
   ↓
2. INSERT review_helpful_votes
   ↓
3. Se user already voted:
   - Atualiza is_helpful
   ↓
4. Incrementa helpful_count ou unhelpful_count
   ↓
5. Atualiza UI sem reload
```

---

## 5. MODERATION & SPAM DETECTION

### Auto-Moderation

```typescript
const needsModeration = (review) => {
  // Check 1: Spam keywords
  if (/viagra|casino|crypto/i.test(review.content)) return true;
  
  // Check 2: Too many links
  const linkCount = (review.content.match(/https?:\/\//g) || []).length;
  if (linkCount > 2) return true;
  
  // Check 3: All caps
  if (review.content === review.content.toUpperCase()) return true;
  
  // Check 4: Repeated characters
  if (/(.)\1{4,}/.test(review.content)) return true;
  
  return false;
};
```

### Admin Moderation Panel

**Localização**: `src/components/admin/ReviewsModerationTab.tsx`

- ✅ Fila de reviews pending
- ✅ Preview do review
- ✅ Botões: Approve / Reject (com motivo)
- ✅ Filter por tipo, data, rating
- ✅ Bulk actions (aprovar 10 de uma vez)

### Regras de Rejeição

| Motivo | Ação |
|--------|------|
| Spam | Delete + Ban author (temp) |
| Off-topic | Edit e pedir revisão |
| Falsa identidade | Delete + Flag user |
| Dupe (mesma pessoa 2x) | Delete primeira |

---

## 6. RANKING & TRUST METRICS

### Score de Confiabilidade do Review

```
trust_score = (
  5 *  is_verified_purchase +
  3 * (author.verified_profile ? 1 : 0) +
  2 * (review.helpful_count - review.unhelpful_count) / total_votes +
  1 * (age_days < 7 ? 1 : 0) -- Reviews recentes têm peso
)
```

### Ordenação Padrão

```
1. Sort by trust_score (DESC)
2. Se empate: by helpful_votes (DESC)
3. Se empate: by created_at (DESC)
```

### Best Reviews Badge

```
Se review atende:
  - Rating = 5 ou 1 (extremos são geralmente mais úteis)
  - helpful_votes > 50% do total
  - 500+ caracteres
  
Exibe: "TOP REVIEW" ou "⭐ MOST HELPFUL"
```

---

## 7. ANALYTICS

### Para Profissional/Empresa

```
Total Reviews: N
Average Rating: 4.8
Rating Distribution: [5% 1★, 10% 2★, 25% 3★, 35% 4★, 25% 5★]
Recent Reviews (últimos 30 dias): N
Helpful /%: X%
Moderation Status: N pending
```

### Para Admin

```
Reviews by Day (gráfico)
Avg Moderation Time: X hours
Flagged Reviews: N
Rejection Rate: X%
Top Reviewers (by review count)
```

---

## 8. EDGE FUNCTIONS

### `create-review`
```
POST /functions/v1/create-review
Auth: Bearer token
Body: {
  target_id, target_type, rating, title, content
}
Response: { review_id, needs_moderation? }
```

### `moderate-review`
```
POST /functions/v1/moderate-review
Auth: Bearer token (admin)
Body: { review_id, action, reason? }
Response: { success }
```

### `helpful-vote`
```
POST /functions/v1/helpful-vote
Auth: Bearer token
Body: { review_id, is_helpful }
Response: { helpful_count, unhelpful_count }
```

### `get-reviews`
```
GET /functions/v1/get-reviews?target_id=X&sort=helpful
Response: { reviews, total, pages }
```

---

## 9. REGRAS DE NEGÓCIO

### Quem pode avaliar?

```
- User autenticado ✅
- User diferente do target ✅
- Numa plataforma marketplace: apenas compradores/clientes ✅
- Apenas 1 review por user/target (edit permite atualizar) ✅
```

### Quando aparece?

```
Imediato: Se passa auto-moderation
Após 24h: Se aprovado pelo admin
Nunca: Se rejeitado (user notificado)
```

### Visibilidade

```
Público:
  - Reviews aprovados

Admin only:
  - Reviews pending
  - Flagged reviews
  - Deleted reviews (soft delete)

Author + Alvo:
  - Private notes/respostas (future feature)
```

---

## 10. EMAIL NOTIFICATIONS

### Template: Novo Review

```
Assunto: [Name] deixou uma avaliação
Corpo:
- Rating (⭐⭐⭐⭐⭐)
- Trecho do comentário
- Link para responder (future)
```

### Template: Review Rejeitado

```
Assunto: Sua avaliação foi rejeitada
Corpo:
- Motivo
- Feedback do moderador
- Opção de editar e reenviar
```

---

## 11. FRONTEND INTEGRATION

### Na página de perfil (Profissional)

```
┌─────────────────────────┐
│ Reviews (4.8 ⭐ / 128)  │
│                         │
│ [5★ 45% | 4★ 30%...]   │
│                         │
│ Sort: ▼ Most Helpful    │
│                         │
│ [Review Card 1]         │
│ [Review Card 2]         │
│ [Review Card 3]         │
│                         │
│ [Next] [Prev]           │
│                         │
│ [+ Deixar Avaliação]    │
└─────────────────────────┘
```

---

## 12. MOBILE RESPONSIVENESS

- ✅ Stars touch-friendly
- ✅ Modal full-screen em mobile
- ✅ Rating inline com review
- ✅ Swipeable stars em mobile

---

## 13. PERFORMANCE

### Caching

```sql
-- Cache de stats (invalidate a cada nova review)
SELECT * FROM review_stats
WHERE target_id = $1

-- Índices
CREATE INDEX idx_reviews_target ON reviews(target_id, target_type);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
```

### Lazy Loading

```typescript
// IntersectionObserver for infinite scroll
<ReviewList virtualized perPage={20} />
```

---

## 14. SEGURANÇA

### Validações

- ✅ Rating entre 1-5
- ✅ Título/content não vazios
- ✅ Sanitização de HTML (DOMPurify)
- ✅ Max length enforcement
- ✅ Rate limiting (5 reviews/dia por user)

### RLS

```sql
-- User vê todos os reviews público
-- User vê próprios reviews mesmo se pending
-- Admin vê todos
```

---

## 15. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas criadas
- [x] StarRating component
- [x] ReviewForm component
- [x] ReviewList component
- [x] ReviewCard component
- [x] Auto-moderation
- [x] Admin moderation panel
- [x] Helpful votes
- [x] Analytics/Summary
- [x] Email notifications
- [x] Performance optimization
- [x] Mobile responsiveness

---

## 16. REFERÊNCIAS

- [Review Best Practices](https://trustpilot.com/guidelines)
- [Amazon Review System](https://www.amazon.com/gp/customer-reviews/guidelines)

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção

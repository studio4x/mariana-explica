# Estrutura do Frontend — Mariana Explica

## 1. Contexto

Este documento define a organização completa do frontend da plataforma Mariana Explica.

O frontend será uma SPA (Single Page Application) construída com:

- React
- TypeScript
- Vite

E deve ser estruturado de forma:

- escalável
- modular
- consistente
- desacoplada do backend
- alinhada com regras de negócio e arquitetura

---

## 2. Objetivo

Garantir que o frontend:

- seja fácil de manter
- permita crescimento do produto
- tenha separação clara de responsabilidades
- funcione bem com React Query
- suporte múltiplas áreas (pública, aluno, admin)
- siga um padrão consistente de UI/UX

---

## 3. Estrutura de pastas

src/
  components/
  pages/
  layouts/
  hooks/
  lib/
  services/
  store/
  types/
  constants/
  utils/
  integrations/

---

## 4. Organização por domínio

### 4.1 components/

Componentes reutilizáveis.

components/
  ui/                → botões, inputs, modais
  common/            → componentes genéricos
  product/           → cards, listas de produto
  checkout/          → elementos de compra
  dashboard/         → componentes da área do aluno
  admin/             → componentes administrativos
  feedback/          → loading, empty, error

---

### 4.2 pages/

Páginas principais da aplicação.

pages/
  public/
  dashboard/
  admin/
  auth/

---

### 4.3 layouts/

Layouts reutilizáveis por área.

layouts/
  PublicLayout.tsx
  DashboardLayout.tsx
  AdminLayout.tsx
  AuthLayout.tsx

---

### 4.4 hooks/

Hooks customizados.

hooks/
  useAuth.ts
  useUser.ts
  useProducts.ts
  useOrders.ts
  useNotifications.ts
  useAccess.ts

---

### 4.5 lib/

Configurações e utilitários base.

lib/
  supabase.ts
  react-query.ts
  env.ts

---

### 4.6 services/

Camada de comunicação com backend.

services/
  api.ts
  auth.service.ts
  product.service.ts
  checkout.service.ts
  access.service.ts
  notification.service.ts
  admin.service.ts

---

### 4.7 store/

Estado global (se necessário).

store/
  auth.store.ts
  ui.store.ts

---

### 4.8 types/

Tipos TypeScript.

types/
  user.types.ts
  product.types.ts
  order.types.ts
  api.types.ts

---

### 4.9 constants/

Constantes globais.

constants/
  routes.ts
  roles.ts
  status.ts

---

### 4.10 utils/

Funções auxiliares.

utils/
  format.ts
  currency.ts
  date.ts
  validation.ts

---

### 4.11 integrations/

Integrações externas.

integrations/
  supabase/
  analytics/
  payments/

---

## 5. Estrutura de rotas

### Área pública

/
 /produtos
 /produto/:slug
 /checkout
 /login
 /register

---

### Área do aluno

/dashboard
/dashboard/produtos
/dashboard/produto/:id
/dashboard/suporte
/dashboard/notificacoes

---

### Área admin

/admin
/admin/produtos
/admin/usuarios
/admin/pedidos
/admin/afiliados
/admin/cupons
/admin/notificacoes

---

## 6. Separação por layout

### PublicLayout

- header público
- footer
- navegação simples

---

### DashboardLayout

- sidebar
- header com usuário
- navegação interna

---

### AdminLayout

- sidebar administrativa
- tabelas densas
- ações rápidas

---

### AuthLayout

- login
- registro
- recuperação de senha

---

## 7. Padrão de páginas

Toda página deve ter:

- loading
- empty state
- error state
- success state

---

## 8. Padrão de chamadas API

### Leitura simples

React Query → Supabase direto

---

### Ações críticas

React Query → Edge Function

---

### Regras

- nunca confiar no frontend
- sempre tratar erro
- sempre tratar loading

---

## 9. Gerenciamento de estado

### Local
- useState
- useReducer

---

### Remoto
- React Query

---

### Global (quando necessário)
- Zustand ou Context API

---

## 10. Autenticação no frontend

- gerenciada pelo Supabase
- sessão persistida
- hook central `useAuth`

Regras:

- rotas privadas protegidas
- redirecionamento automático
- logout limpa estado

---

## 11. Proteção de rotas

Tipos:

- pública
- autenticada
- admin

Implementação:

- wrapper de rota
- verificação de role
- fallback para login

---

## 12. Padrão de componentes

Componentes devem ser:

- pequenos
- reutilizáveis
- sem lógica pesada
- desacoplados de API

---

## 13. Padrão de formulários

- validação com Zod ou similar
- controle com React Hook Form
- feedback imediato

---

## 14. UI e consistência

- usar design system central
- evitar estilos inline
- usar Tailwind + componentes base
- manter consistência entre páginas

---

## 15. Performance

- lazy loading de páginas
- cache com React Query
- evitar re-render desnecessário
- dividir bundles

---

## 16. PWA (preparação)

- manifest configurado
- service worker
- fallback offline básico
- instalação no mobile

---

## 17. Critérios de aceite

- estrutura clara e escalável
- separação entre áreas
- integração limpa com backend
- navegação fluida
- estados bem definidos
- pronto para crescimento

---

## 18. Riscos

- mistura de lógica de negócio no frontend
- componentes grandes demais
- duplicação de código
- falta de padrão de rotas
- chamadas diretas indevidas ao backend

---

## 19. Observações finais

- frontend é camada de apresentação
- backend é a fonte de verdade
- organização inicial define velocidade futura
- arquitetura deve ser respeitada desde o início
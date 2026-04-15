# Arquitetura da Plataforma — Mariana Explica

## 1. Contexto

Este documento define a arquitetura técnica da plataforma, incluindo:

- organização das camadas
- comunicação entre frontend e backend
- responsabilidades de cada parte do sistema
- padrões de segurança e escalabilidade

A arquitetura segue o padrão:

SPA (Single Page Application) + Backend Serverless

Baseado no modelo HomeCare Match.

---

## 2. Objetivo

Garantir que a plataforma seja:

- escalável
- segura
- performática
- de fácil manutenção
- preparada para evolução futura

---

## 3. Visão geral da arquitetura

A plataforma será composta por 4 camadas principais:

1. Frontend (React)
2. Backend Serverless (Supabase Edge Functions)
3. Banco de dados (PostgreSQL)
4. Storage (arquivos e mídia)

---

## 4. Stack técnica

### Frontend
- React
- TypeScript
- Vite
- React Router
- TanStack React Query
- Tailwind CSS
- shadcn/ui

---

### Backend
- Supabase
- Edge Functions (Deno)

---

### Banco de dados
- PostgreSQL (Supabase)

---

### Storage
- Supabase Storage

---

### Deploy
- Vercel (frontend)
- Supabase (backend + banco)

---

## 5. Separação de responsabilidades

### 5.1 Frontend

Responsável por:

- interface do usuário
- navegação
- renderização de dados
- chamadas para backend

NÃO deve:

- conter regras críticas de negócio
- validar permissões sozinho
- acessar diretamente serviços externos sensíveis

---

### 5.2 Backend (Edge Functions)

Responsável por:

- lógica crítica
- validação de permissões
- integração com pagamento
- geração de URLs seguras
- processamento de afiliados
- envio de notificações

---

### 5.3 Banco de dados

Responsável por:

- persistência dos dados
- integridade
- controle de acesso via RLS

---

### 5.4 Storage

Responsável por:

- armazenar PDFs
- armazenar materiais
- controlar acesso via backend

---

## 6. Fluxos principais

### 6.1 Navegação padrão

Frontend → Supabase (queries com RLS)

---

### 6.2 Ações sensíveis

Frontend → Edge Function → Banco

Exemplos:

- checkout
- confirmação de pagamento
- geração de download
- afiliados

---

### 6.3 Acesso a arquivos

Frontend → Edge Function → Storage

Nunca direto.

---

## 7. Fluxo de compra

1. Usuário inicia checkout
2. Frontend chama `create-checkout`
3. Backend cria sessão de pagamento
4. Usuário paga
5. Webhook confirma pagamento
6. Backend atualiza status para `paid`
7. Sistema libera acesso

---

## 8. Fluxo de acesso ao conteúdo

1. Usuário autenticado
2. Frontend consulta produtos do usuário
3. Banco valida via RLS
4. Conteúdo liberado

---

## 9. Fluxo de download seguro

1. Usuário solicita download
2. Frontend chama função
3. Backend valida:
   - usuário
   - compra
4. Backend gera URL temporária
5. Usuário acessa arquivo

---

## 10. Segurança em camadas

### Camada 1 — Frontend
- oculta ações não permitidas

### Camada 2 — Backend
- valida tudo novamente

### Camada 3 — Banco (RLS)
- bloqueia acesso final

---

## 11. Autenticação

- Supabase Auth
- JWT
- sessão gerenciada no frontend

---

## 12. Autorização

Baseada em:

- role
- is_admin
- contexto de acesso

---

## 13. RLS (Row Level Security)

Aplicado em:

- purchases
- products (quando necessário)
- modules
- notifications

Regras:

- usuário só vê o que é dele
- admin vê tudo

---

## 14. Organização das Edge Functions

Estrutura:

supabase/functions/
  create-checkout/
  confirm-payment/
  generate-download-url/
  process-affiliate/
  send-notification/
  _shared/

---

## 15. Helpers compartilhados

Pasta `_shared` deve conter:

- validação de usuário
- verificação de admin
- helpers de segurança
- helpers de storage
- logging

---

## 16. Integrações externas

Devem ocorrer SOMENTE via backend:

- pagamento
- email
- notificações
- analytics sensível

---

## 17. Padrões de comunicação

### Leitura simples

Frontend → Supabase (RLS protege)

---

### Escrita simples

Frontend → Supabase (quando seguro)

---

### Escrita crítica

Frontend → Edge Function

---

## 18. Escalabilidade

A arquitetura permite:

- crescimento de usuários
- aumento de tráfego
- expansão de funcionalidades
- múltiplos produtos

Sem necessidade de reescrita estrutural

---

## 19. Observabilidade

Sistema deve prever:

- logs de erro
- logs de funções
- rastreamento de eventos críticos

---

## 20. Riscos arquiteturais

- expor lógica no frontend
- não usar RLS corretamente
- gerar URLs públicas de arquivos
- não validar webhooks
- funções sem autenticação

---

## 21. Critérios de aceite

- frontend não contém lógica crítica
- backend valida todas ações sensíveis
- banco protege dados via RLS
- arquivos não são públicos
- sistema suporta crescimento sem refatoração estrutural
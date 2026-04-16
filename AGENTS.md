# AGENTS.md

## Objetivo deste repositório

Este repositório contém a implementação da plataforma **Mariana Explica**, uma plataforma real de venda e entrega de conteúdos educacionais digitais, com:

- área pública comercial
- área autenticada do aluno
- painel administrativo
- backend serverless
- PostgreSQL com RLS
- integrações seguras
- PWA
- deploy em Vercel + Supabase

O agente deve tratar o projeto como **sistema de produção**, não como protótipo.

---

## Fonte oficial de verdade

A pasta `/docs` é a fonte oficial de verdade do produto.

### Ordem de prioridade

1. `docs/02-regras-negocio.md`
2. `docs/03-arquitetura.md`
3. `docs/10-autenticacao-seguranca.md`
4. `docs/04-banco-dados.md`
5. `docs/05-backend-edge-functions.md`
6. `docs/15-plano-de-implementacao.md`
7. demais documentos específicos do domínio em questão

### Documentos canônicos

- `docs/01-visao-geral.md`
- `docs/02-regras-negocio.md`
- `docs/03-arquitetura.md`
- `docs/04-banco-dados.md`
- `docs/05-backend-edge-functions.md`
- `docs/06-frontend-estrutura.md`
- `docs/07-ui-ux.md`
- `docs/08-dashboard.md`
- `docs/09-admin.md`
- `docs/10-autenticacao-seguranca.md`
- `docs/11-integracoes.md`
- `docs/12-automacoes.md`
- `docs/13-pwa.md`
- `docs/14-deploy.md`
- `docs/15-plano-de-implementacao.md`

### Sobre `docs/Specs`

Os arquivos em `docs/Specs/` são **auxiliares**.

Eles podem ser usados como referência de estrutura de documentação, layout, componentes e detalhamento funcional, mas **não substituem** os documentos canônicos `docs/01-15`.

Quando houver conflito, prevalecem sempre os documentos canônicos.

---

## Regra principal de execução

Antes de implementar qualquer mudança relevante, o agente deve:

1. identificar quais docs governam a tarefa
2. ler esses docs
3. resumir internamente objetivo e restrições
4. só então implementar

O agente não deve inventar arquitetura, fluxos de negócio, permissões ou modelagem que contrariem a documentação.

---

## Stack obrigatória

### Frontend
- React
- TypeScript
- Vite
- React Router
- TanStack React Query

### UI
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React

### Backend
- Supabase
- Supabase Edge Functions

### Banco
- PostgreSQL
- migrations SQL versionadas

### Auth
- Supabase Auth

### Storage
- Supabase Storage

### Deploy
- Vercel para frontend
- Supabase para backend e banco

---

## Princípios arquiteturais obrigatórios

A plataforma segue o padrão:

**SPA + backend serverless**

Separar claramente:

- apresentação
- regras de negócio
- persistência
- autenticação e autorização
- integrações externas
- automações

### Regras obrigatórias

- frontend não é fonte de verdade
- lógica crítica não deve ficar apenas no frontend
- operações sensíveis devem ir para Edge Functions
- banco é parte ativa da segurança
- dados privados devem usar RLS
- migrations SQL são a fonte oficial da estrutura do banco

---

## Segurança obrigatória

### Sempre aplicar

- autenticação obrigatória em áreas privadas
- autorização por `role`, `is_admin` e `status`
- RLS em tabelas privadas
- validação no backend para ações críticas
- segredos nunca no frontend
- storage privado por padrão
- URLs assinadas para arquivos protegidos
- auditoria em ações sensíveis
- logs em automações e integrações críticas

### Nunca fazer

- expor `service_role` no cliente
- confiar no frontend para liberar acesso
- deixar tabela privada sem RLS
- deixar função admin sem validação robusta
- tornar PDFs pagos públicos
- criar grants diretamente pelo frontend
- alterar estrutura do banco sem migration

---

## Regra de negócio crítica

A tabela `access_grants` é a base real de autorização ao conteúdo.

Isso significa:

- `orders` representam estado comercial
- `access_grants` representam permissão real de acesso
- compra confirmada não equivale a acesso sem grant válido
- reembolso pode exigir revogação de grant
- conteúdo protegido depende de grant válido ou regra explícita de acesso gratuito

---

## Regras por camada

### Frontend

O frontend deve:

- separar público, dashboard e admin
- usar componentes reutilizáveis
- usar React Query para estado remoto
- tratar loading, empty, error e success states
- ser mobile-first
- respeitar `docs/07-ui-ux.md`

O frontend não deve:

- calcular preço final como verdade
- decidir autorização final
- liberar download por conta própria
- chamar integrações sensíveis diretamente

### Backend / Edge Functions

Toda lógica crítica deve ficar em Edge Functions.

Exemplos:

- checkout Stripe
- webhook Stripe
- geração de URL assinada
- claim de produto gratuito
- criação ou revogação de grant
- ações administrativas sensíveis
- notificações em massa
- reprocessamentos
- jobs/cron

### Banco

Toda alteração estrutural deve ser feita por migration SQL versionada.

Sempre considerar:

- foreign keys
- constraints
- índices
- triggers de `updated_at`
- RLS e policies
- logs ou auditoria quando necessário
- idempotência em fluxos críticos

---

## Integrações

### Stripe é o gateway oficial

A integração com pagamento deve usar Stripe como gateway principal.

Regras obrigatórias:

- checkout criado no backend
- webhook validado por assinatura
- idempotência
- grant só após confirmação real do backend
- referência interna do pedido mantida no banco
- reconciliação entre pedido interno e sessão externa

---

## Admin

O painel administrativo é parte central da operação.

Deve permitir no mínimo:

- criar, editar e remover usuário com estratégia segura
- bloquear e desbloquear usuário
- visualizar e alterar role
- gerenciar produtos
- gerenciar pedidos

Regras críticas:

- alteração de role deve ser auditada
- operações sensíveis devem passar por backend
- admin não remove a si próprio sem proteção
- gestão de usuários é área de alta sensibilidade

---

## PWA

A plataforma deve nascer compatível com PWA.

Incluir quando aplicável:

- `manifest.webmanifest`
- `sw.js`
- `offline.html`
- prompt de instalação
- ícones adequados

O PWA nunca pode quebrar regras de autenticação, autorização ou segurança de conteúdo.

---

## Deploy obrigatório

Quando a mudança precisar refletir em ambiente remoto, deploy faz parte da tarefa.

### GitHub

Quando necessário publicar código remoto:

- preparar alterações locais
- revisar consistência mínima
- fazer commit com mensagem clara
- fazer push para o repositório correto

### Supabase

Quando houver mudança em:

- Edge Functions
- migrations SQL
- RLS/policies
- banco
- storage
- integrações backend

o agente deve considerar deploy no Supabase.

### Vercel

Quando houver deploy de frontend:

- usar o token fornecido pelo usuário na sessão atual
- nunca salvar o token em arquivo versionado

### Ordem segura de deploy

1. backend / Edge Functions
2. banco / migrations / policies
3. frontend
4. validações finais

Se não for possível concluir deploy, informar claramente:

- o que foi concluído
- o que faltou
- qual credencial ou bloqueio impediu a execução

---

## Ordem de implementação obrigatória

Seguir `docs/15-plano-de-implementacao.md`.

Resumo:

1. setup do projeto
2. estrutura base do frontend
3. integração com Supabase
4. banco de dados
5. autenticação e segurança
6. backend crítico
7. área pública
8. checkout Stripe
9. dashboard do aluno
10. admin
11. notificações e suporte
12. automações
13. PWA
14. deploy

Não pular etapas críticas como auth, roles, RLS, grants e webhook.

---

## Padrão de resposta do agente

Para qualquer tarefa relevante, o agente deve:

1. dizer brevemente o que vai implementar
2. listar os docs usados como base
3. executar a implementação
4. validar build ou testes relevantes
5. informar arquivos alterados
6. informar pendências reais
7. executar deploy quando necessário e possível

---

## Checklist interno antes de concluir

- respeitei os docs corretos?
- mantive segurança no backend e no banco?
- evitei regra crítica no frontend?
- preservei a separação entre público, dashboard e admin?
- usei migrations para mudanças estruturais?
- considerei roles, grants e RLS?
- considerei build e consistência?
- considerei necessidade de deploy?

---

## Resultado esperado

Este projeto deve resultar em uma plataforma:

- pronta para produção
- segura
- escalável
- organizada
- operável por admin
- integrada com Stripe
- com dashboard funcional
- com área pública de conversão
- com backend auditável
- com documentação coerente com a implementação
---

## Versão da build

Quando houver novos ajustes relevantes, a build exibida no admin deve ser atualizada automaticamente, preferencialmente usando o hash curto do commit atual ou outro identificador de build consistente. Não deixar o rodapé do admin com versão antiga após novos deploys.

## Edge Function 401 Playbook (Admin Sync Actions)
- If an admin-triggered Edge Function returns `401` from `functions/v1/...`, do this first:
  1. Treat browser-extension logs (e.g., Kaspersky `inspector.js`) as noise unless they reference your own domain/function.
  2. Ensure frontend sends a fresh session token:
     - Call `supabase.auth.getSession()` + `supabase.auth.refreshSession()`.
     - Send `Authorization: Bearer <access_token>`.
     - Prefer `fetch` with explicit headers over `supabase.functions.invoke` when diagnosing auth problems.
  3. Include fallback token in body: `{ access_token: <access_token> }`.

- If gateway-level `401` persists, use this hardened pattern:
  1. Deploy function with `--no-verify-jwt`.
  2. Inside the function, validate auth manually:
     - Read token from `Authorization` header OR request body `access_token`.
     - Validate with `supabaseAdmin.auth.getUser(token)`.
     - Enforce admin permission from `profiles` (`is_admin` or `role === "admin"`).
     - Return explicit JSON errors (`401 token ausente/invalido`, `403 acesso negado`).
  3. Keep function secure by requiring token and role checks before any privileged SQL.

- Required deploy pattern for this scenario:
  - `npx supabase functions deploy <function-name> --project-ref <ref> --no-verify-jwt`

- Frontend request pattern for admin sync functions:
  - `POST ${SUPABASE_URL}/functions/v1/<function-name>`
  - Headers: `Content-Type: application/json`, `apikey`, `Authorization: Bearer <access_token>`
  - Body: `{ access_token: <access_token> }`

- Apply this technique to all future "admin maintenance/sync/setup" functions when auth instability appears.

- For every admin-triggered Edge Function that mutates data or syncs state, the frontend must refresh the session before the request, send both `Authorization: Bearer <access_token>` and `access_token` in the JSON body, and surface the backend JSON error instead of failing silently. Use direct `fetch` for diagnostics and hardening when `supabase.functions.invoke` is not enough.

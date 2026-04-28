# Plano de Implementação — Mariana Explica

## 1. Contexto

Este documento define a ordem oficial de implementação da plataforma Mariana Explica.

O objetivo é transformar toda a documentação anterior em um plano prático de execução, minimizando:

- retrabalho
- inconsistências
- decisões fora de ordem
- falhas de segurança
- acoplamento desnecessário

Este plano deve ser seguido como referência principal durante o desenvolvimento no VS Code com apoio do Codex.

---

## 2. Objetivo

Garantir que a implementação da plataforma aconteça em etapas coerentes, respeitando:

- dependências técnicas
- regras de negócio
- segurança
- arquitetura
- operação real
- capacidade de teste por fase

---

## 3. Princípios do plano

### 3.1 Implementar por fundação

Primeiro a base, depois as funcionalidades.

### 3.2 Nunca começar pela interface sem estrutura

Antes de telas complexas, o projeto precisa ter:

- arquitetura
- banco
- autenticação
- backend crítico
- rotas base

### 3.3 Segurança desde o início

Auth, roles, RLS e grants não devem ser “adicionados depois”.

### 3.4 Entregas incrementais

Cada fase deve deixar o sistema mais completo e testável.

### 3.5 O admin não é detalhe

O painel administrativo é parte central da operação, não uma etapa decorativa.

---

## 4. Ordem geral de implementação

A ordem recomendada é:

1. setup do projeto
2. arquitetura base do frontend
3. Supabase e ambiente
4. banco de dados
5. autenticação e segurança
6. backend crítico
7. área pública
8. checkout com Stripe
9. área do aluno
10. admin
11. notificações e suporte
12. automações
13. PWA
14. deploy e estabilização

---

## 5. Fase 0 — Preparação do projeto

## 5.1 Objetivo

Criar a base inicial do repositório e das ferramentas.

## 5.2 Entregas

- criar projeto React + TypeScript + Vite
- configurar Tailwind CSS
- configurar shadcn/ui
- configurar React Router
- configurar React Query
- configurar estrutura de pastas
- configurar ESLint e Prettier
- configurar aliases de importação
- configurar tema base e design tokens
- configurar `.env.example`

## 5.3 Critério de conclusão

- projeto roda localmente
- estrutura de pastas pronta
- design system base conectado
- Supabase SDK instalado
- app compila sem erro

---

## 6. Fase 1 — Estrutura base do frontend

## 6.1 Objetivo

Montar a espinha dorsal da aplicação.

## 6.2 Entregas

- layouts:
  - `PublicLayout`
  - `DashboardLayout`
  - `AdminLayout`
  - `AuthLayout`
- arquivo central de rotas
- wrappers de rotas públicas, privadas e admin
- páginas placeholder iniciais
- componentes globais:
  - Navbar
  - Footer
  - Sidebar
  - Loading
  - EmptyState
  - ErrorState
  - Toast provider

## 6.3 Critério de conclusão

- navegação funcionando
- rotas separadas por área
- layout base pronto para evolução

---

## 7. Fase 2 — Supabase e ambiente

## 7.1 Objetivo

Conectar frontend e backend à infraestrutura real.

## 7.2 Entregas

- criar projeto Supabase
- configurar autenticação
- configurar buckets iniciais
- configurar variáveis de ambiente
- conectar frontend ao Supabase
- criar cliente `supabase.ts`
- validar acesso local ao ambiente

## 7.3 Critério de conclusão

- frontend conectado ao Supabase
- ambiente de dev funcional
- variáveis funcionando

---

## 8. Fase 3 — Banco de dados

## 8.1 Objetivo

Criar a base real da plataforma.

## 8.2 Ordem recomendada de migrations

1. extensões/helpers
2. `profiles`
3. `products`
4. `product_modules`
5. `module_assets`
6. `orders`
7. `order_items`
8. `access_grants`
9. `affiliates`
10. `affiliate_referrals`
11. `coupons`
12. `coupon_usages`
13. `notifications`
14. `email_deliveries`
15. `support_tickets`
16. `support_ticket_messages`
17. `site_config`
18. `audit_logs`
19. `job_runs`
20. triggers
21. índices
22. RLS
23. policies
24. seeds iniciais

## 8.3 Entregas

- migrations SQL versionadas
- triggers de `updated_at`
- bootstrap de `profiles`
- constraints
- índices
- RLS inicial

## 8.4 Critério de conclusão

- banco consistente
- tabelas principais criadas
- RLS ativo nas tabelas críticas

---

## 9. Fase 4 — Autenticação e segurança

## 9.1 Objetivo

Garantir controle real de acesso.

## 9.2 Entregas

- cadastro
- login
- logout
- recuperação de senha
- sessão persistente
- wrapper de rota privada
- wrapper de rota admin
- leitura do `profile`
- validação de `role`, `is_admin` e `status`
- bloqueio de usuário com status inválido

## 9.3 Critério de conclusão

- usuário entra e sai corretamente
- áreas privadas protegidas
- admin protegido
- usuário comum não acessa admin

---

## 10. Fase 5 — Backend crítico inicial

## 10.1 Objetivo

Implementar as primeiras Edge Functions essenciais.

## 10.2 Ordem recomendada

1. `_shared/`
2. `create-checkout`
3. `payment-webhook`
4. `generate-asset-access`
5. `claim-free-product`
6. `create-support-ticket`
7. `reply-support-ticket`

## 10.3 Entregas

- helpers compartilhados
- padrão de resposta
- logs
- validação de auth
- validação admin
- acesso seguro a assets
- webhook Stripe funcional

## 10.4 Critério de conclusão

- compra pode ser criada
- pagamento pode ser confirmado
- grants podem ser gerados
- assets podem ser protegidos

---

## 11. Fase 6 — Área pública

## 11.1 Objetivo

Construir a parte comercial do produto.

## 11.2 Páginas prioritárias

1. Home
2. Catálogo de produtos
3. Página de produto
4. Login
5. Registro

## 11.3 Entregas

- hero principal
- cards de produtos
- blocos de benefícios
- CTA para compra
- navegação pública
- copy inicial
- responsividade mobile

## 11.4 Critério de conclusão

- visitante consegue conhecer a plataforma
- catálogo visível
- página de produto funcional

---

## 12. Fase 7 — Checkout com Stripe

## 12.1 Objetivo

Fechar o fluxo comercial completo.

## 12.2 Entregas

- botão comprar
- integração com `create-checkout`
- redirecionamento para Stripe Checkout
- página de sucesso
- página de cancelamento/retorno
- webhook validado
- pedido atualizado
- grant criado
- notificação/e-mail pós-compra

## 12.3 Critério de conclusão

- compra em ambiente de teste funciona ponta a ponta
- acesso é liberado apenas após confirmação backend

---

## 13. Fase 8 — Área do aluno

## 13.1 Objetivo

Permitir consumo de conteúdo e retenção.

## 13.2 Ordem recomendada

1. Dashboard inicial
2. Meus produtos
3. Página de produto
4. Lista de módulos
5. Visualização de conteúdo
6. Downloads
7. Notificações
8. Perfil

## 13.3 Entregas

- cards de produtos do usuário
- leitura de `access_grants`
- render de módulos
- PDF inline quando permitido
- download seguro
- notificações do usuário
- perfil básico

## 13.4 Critério de conclusão

- aluno consegue acessar o que comprou
- conteúdo bloqueado continua protegido
- download funciona com segurança

---

## 14. Fase 9 — Admin

## 14.1 Objetivo

Dar controle operacional real da plataforma.

## 14.2 Ordem recomendada

1. Dashboard admin
2. Gestão de usuários
3. Gestão de produtos
4. Gestão de pedidos
5. Gestão de afiliados
6. Gestão de cupons
7. Gestão de notificações
8. Gestão de suporte
9. Configurações

## 14.3 Prioridade máxima dentro do admin

### Gestão de usuários

Implementar cedo no admin:

- listar usuários
- visualizar role do usuário
- criar usuário
- editar usuário
- alterar role
- bloquear/desbloquear usuário
- remover usuário com estratégia segura
- registrar auditoria

## 14.4 Critério de conclusão

- admin consegue operar sem editar banco manualmente
- roles funcionam corretamente
- ações críticas são auditadas

---

## 15. Fase 10 — Suporte e notificações

## 15.1 Objetivo

Melhorar operação e relacionamento com o aluno.

## 15.2 Entregas

- abertura de ticket
- resposta a ticket
- listagem de tickets no admin
- notificações internas
- e-mails transacionais básicos
- marcação de leitura

## 15.3 Critério de conclusão

- suporte funciona ponta a ponta
- usuário recebe feedbacks relevantes

---

## 16. Fase 11 — Afiliados e cupons

## 16.1 Objetivo

Ativar crescimento e promoções.

## 16.2 Entregas

- criação de afiliado
- tracking de referral
- consolidação de comissão
- criação de cupons
- validação de cupom
- uso de cupom no checkout
- listagens admin

## 16.3 Critério de conclusão

- cupom altera o preço corretamente
- afiliado é reconhecido corretamente
- duplicidade é evitada

---

## 17. Fase 12 — Automações

## 17.1 Objetivo

Dar robustez operacional ao sistema.

## 17.2 Entregas

- reconciliação de pedidos
- retry de e-mails
- processamento de notificações
- logs em `job_runs`
- ações manuais de reprocessamento no admin

## 17.3 Critério de conclusão

- sistema consegue corrigir falhas parciais
- operações críticas são reprocessáveis

---

## 18. Fase 13 — PWA

## 18.1 Objetivo

Transformar a plataforma em app instalável.

## 18.2 Entregas

- manifest
- service worker
- página offline
- prompt de instalação
- ícones
- testes em Android/iOS

## 18.3 Critério de conclusão

- plataforma pode ser instalada
- experiência mobile standalone funciona bem
- segurança de conteúdo é preservada

---

## 19. Fase 14 — Deploy e estabilização

## 19.1 Objetivo

Publicar com segurança.

## 19.2 Entregas

- deploy frontend na Vercel
- deploy das Edge Functions
- migrations em produção
- buckets configurados
- variáveis de ambiente
- webhook Stripe em produção
- smoke tests finais

## 19.3 Critério de conclusão

- produção operando
- compra real funcionando
- grants funcionando
- admin funcional
- logs disponíveis

---

## 20. Ordem recomendada de prompts no Codex

Ao usar o Codex, seguir esta ordem de solicitação:

1. estrutura base do projeto
2. rotas e layouts
3. client Supabase
4. migrations do banco
5. autenticação
6. RLS e policies
7. helpers backend
8. funções Stripe
9. catálogo público
10. checkout
11. dashboard do aluno
12. admin usuários
13. admin produtos
14. suporte/notificações
15. cupons e afiliados
16. automações
17. PWA
18. deploy

---

## 21. O que NÃO fazer fora de ordem

- começar pelo admin completo antes do auth
- criar checkout antes de modelar `orders`
- criar downloads antes de `access_grants`
- implementar Stripe sem webhook
- criar tela bonita sem política de acesso
- deixar RLS para o final
- criar gestão de usuários sem auditoria
- abrir bucket público para “agilizar”

---

## 22. Checklist de conclusão por fase

Cada fase só deve ser considerada concluída quando houver:

- implementação funcional
- teste manual básico
- validação com a documentação
- ausência de erro estrutural evidente
- aderência à arquitetura

---

## 23. Estratégia de testes por fase

### Testes mínimos por fase

#### Banco
- constraints
- inserts básicos
- RLS

#### Auth
- login
- logout
- rota privada
- rota admin

#### Stripe
- checkout test
- webhook test
- grant test
- retry idempotente

#### Dashboard
- acesso ao produto
- conteúdo bloqueado
- download seguro

#### Admin
- gestão de usuários
- alteração de role
- bloqueio
- logs

#### PWA
- instalação
- offline fallback
- retorno ao app

---

## 24. Dependências críticas entre fases

- auth depende de `profiles`
- checkout depende de `orders`
- acesso depende de `access_grants`
- admin usuários depende de auth + role + auditoria
- Stripe depende de backend + banco + webhook
- downloads dependem de storage + grant + função segura
- automações dependem de logs + backend estruturado

---

## 25. Entregas mínimas do MVP

O MVP real da plataforma deve incluir:

- home
- catálogo
- página de produto
- login/cadastro
- checkout Stripe
- webhook funcionando
- grants funcionando
- dashboard do aluno
- visualização de conteúdo
- download seguro básico
- admin mínimo com:
  - usuários
  - produtos
  - pedidos

---

## 26. Entregas pós-MVP

- afiliados completos
- cupons avançados
- notificações em massa
- suporte refinado
- automações de reconciliação avançada
- melhorias de retenção
- push notifications
- analytics refinado
- staging completo

---

## 27. Critérios de aceite do plano

O plano será considerado adequado quando:

- a implementação puder seguir uma ordem clara
- cada fase reduzir risco em vez de aumentar
- a base de segurança vier antes das features sensíveis
- o projeto conseguir chegar ao MVP sem retrabalho estrutural grande
- o admin nascer de forma operacional e segura

---

## 28. Riscos

### Riscos técnicos
- pular fases
- implementar UI antes da fundação
- não respeitar dependências entre módulos
- Stripe sem reconciliação
- grants sem base sólida
- roles sem backend forte

### Riscos operacionais
- tentar entregar tudo ao mesmo tempo
- construir admin sem auditoria
- não testar ambiente de pagamento
- não validar mobile cedo
- deploy prematuro sem smoke tests

---

## 29. Observações finais

- este plano deve ser usado como roteiro principal no VS Code com o Codex
- sempre implementar do núcleo para a borda
- o banco e o backend definem segurança e verdade do sistema
- o frontend deve crescer em cima dessa base, não o contrário
- a gestão de usuários no admin é prioridade operacional alta
- Stripe e `access_grants` formam o coração do fluxo de monetização e acesso
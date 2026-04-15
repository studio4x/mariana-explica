# AGENTS.md

## Objetivo deste repositório

Este repositório contém a implementação da plataforma **Mariana Explica**, uma plataforma web de venda e entrega de conteúdos educacionais digitais, com:

- área pública comercial
- área autenticada do aluno
- painel administrativo
- backend serverless
- banco PostgreSQL com RLS
- integrações seguras
- PWA
- deploy em Vercel + Supabase

O agente deve tratar este projeto como **plataforma real de produção**, não como protótipo.

---

## Fonte oficial de verdade

A pasta `/docs` é a principal fonte de verdade do projeto.

O agente deve sempre ler e respeitar os documentos da pasta `/docs` antes de implementar qualquer funcionalidade.

### Ordem de prioridade dos documentos

1. `docs/02-regras-negocio.md`
2. `docs/03-arquitetura.md`
3. `docs/10-autenticacao-e-seguranca.md`
4. `docs/04-banco-dados.md`
5. `docs/05-backend-edge-functions.md`
6. `docs/15-plano-de-implementacao.md`
7. demais documentos específicos do domínio em questão

### Documentos disponíveis

- `docs/01-visao-geral.md`
- `docs/02-regras-negocio.md`
- `docs/03-arquitetura.md`
- `docs/04-banco-dados.md`
- `docs/05-backend-edge-functions.md`
- `docs/06-frontend-estrutura.md`
- `docs/07-ui-ux.md`
- `docs/08-dashboard-aluno.md`
- `docs/09-painel-admin.md`
- `docs/10-autenticacao-e-seguranca.md`
- `docs/11-integracoes.md`
- `docs/12-automacoes.md`
- `docs/13-pwa.md`
- `docs/14-deploy.md`
- `docs/15-plano-de-implementacao.md`

---

## Regra principal de execução

Antes de implementar qualquer coisa, o agente deve:

1. identificar quais documentos da pasta `/docs` governam a tarefa
2. ler esses documentos
3. resumir internamente o objetivo e as restrições
4. só então implementar

O agente **não deve inventar arquitetura**, fluxo de negócio, permissões ou modelagem que contrariem a documentação.

---

## Stack obrigatória

Salvo instrução explícita em contrário, usar:

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
- autenticação/autorização
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

O agente deve tratar segurança como requisito de base.

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
- alterar estrutura do banco manualmente sem migration

---

## Regra de negócio crítica

A tabela `access_grants` é a base real de autorização de acesso ao conteúdo.

### Isso significa

- `orders` representam estado comercial
- `access_grants` representam permissão real de acesso
- compra confirmada não deve ser tratada como acesso por si só sem grant
- reembolso pode exigir revogação de grant
- conteúdo protegido depende de grant válido ou regra explícita de acesso gratuito

---

## Regras de implementação por camada

### Frontend

O frontend deve:

- ser organizado por domínio e responsabilidade
- separar claramente área pública, dashboard e admin
- usar componentes reutilizáveis
- usar React Query para estado remoto
- tratar loading, empty, error e success states
- ser mobile-first
- respeitar a direção visual definida em `docs/07-ui-ux.md`

O frontend não deve:

- calcular preço final como verdade
- decidir autorização final
- liberar download por conta própria
- chamar integrações sensíveis diretamente

---

### Backend / Edge Functions

Toda lógica crítica deve ficar em Edge Functions.

Exemplos:

- checkout Stripe
- webhook Stripe
- geração de URL assinada
- claim de produto gratuito
- criação/revogação de grant
- ações administrativas sensíveis
- notificações em massa
- reprocessamentos
- cron jobs

### Estrutura esperada

- `supabase/functions/_shared/`
- `supabase/functions/create-checkout/`
- `supabase/functions/payment-webhook/`
- `supabase/functions/generate-asset-access/`
- `supabase/functions/claim-free-product/`

### Helpers compartilhados esperados

- auth
- admin
- errors
- response
- logger
- storage
- payments
- coupons
- affiliates
- grants
- notifications
- validation
- audit

---

## Banco de dados

Toda alteração estrutural deve ser feita por migration SQL versionada.

### Nunca fazer

- alterar schema manualmente como fonte principal
- criar tabela sem índice mínimo
- criar tabela privada sem RLS
- criar estrutura sem timestamps quando aplicável

### Sempre considerar

- foreign keys
- constraints
- índices
- triggers de `updated_at`
- policies RLS
- logs/auditoria quando necessário
- idempotência em fluxos críticos

---

## Integrações

### Stripe é o gateway oficial

A integração de pagamento deve usar **Stripe** como gateway principal.

### Regras obrigatórias da Stripe

- checkout criado no backend
- webhook validado por assinatura
- uso de idempotência
- grant só após confirmação real do backend
- referência interna do pedido mantida no banco
- reconciliar `order` com sessão externa

### Nunca fazer

- confirmar compra apenas no frontend
- liberar acesso baseado apenas em página de sucesso
- confiar em valor vindo do cliente

---

## Admin

O painel administrativo é parte central do sistema.

### O admin deve permitir

- criar usuário
- editar usuário
- remover usuário com estratégia segura
- bloquear/desbloquear usuário
- visualizar e alterar role
- gerenciar produtos
- gerenciar pedidos
- gerenciar afiliados
- gerenciar cupons
- gerenciar notificações
- gerenciar suporte

### Regras críticas

- alteração de role deve ser auditada
- operações administrativas sensíveis devem passar por backend
- admin não deve remover a si próprio sem proteção
- gestão de usuários é área de alta sensibilidade

---

## UI/UX

A referência estrutural da área pública é a lógica visual da AcademiaX, mas sem copiar a identidade visual literalmente.

A identidade visual oficial deve seguir os docs da Mariana Explica e os padrões definidos em `docs/07-ui-ux.md`.

### Direção visual base

- visual clean, educacional e comercial
- foco em conversão na área pública
- foco em consumo no dashboard
- foco operacional no admin
- títulos com personalidade
- interface profissional, não genérica

### Tipografia e cores

Seguir os documentos da pasta `/docs`, especialmente:

- `docs/07-ui-ux.md`
- `docs/08-dashboard-aluno.md`
- `docs/09-painel-admin.md`

---

## PWA

A plataforma deve nascer compatível com PWA.

### Incluir quando aplicável

- `manifest.webmanifest`
- `sw.js`
- `offline.html`
- prompt de instalação
- ícones adequados

### Regra crítica

PWA não altera regras de autenticação, autorização nem segurança de conteúdo.

---

## Deploy obrigatório

Deploy faz parte obrigatória do trabalho quando a alteração precisa ir para ambiente remoto, homologação ou produção.

O agente **não deve encerrar a tarefa apenas com código local** quando a mudança exigir publicação.

### Regras gerais de deploy

- toda alteração que afete comportamento real da aplicação deve considerar deploy
- quando a mudança envolver frontend, build publicado, rotas, UI, PWA ou assets públicos, considerar deploy do frontend
- quando a mudança envolver banco, migrations, Edge Functions, policies, webhooks, storage rules ou backend Supabase, considerar deploy do backend/Supabase
- quando a mudança precisar ser persistida no repositório remoto, considerar commit e push para GitHub
- se algum deploy não puder ser executado por falta de credenciais ou contexto, o agente deve informar claramente o bloqueio exato

### GitHub

Quando necessário publicar código remoto, o agente deve:

- preparar alterações locais
- revisar consistência mínima
- fazer commit com mensagem clara
- fazer push para o repositório GitHub correto

O agente deve usar o access token fornecido pelo usuário em tempo de execução, quando necessário.

O token nunca deve ser hardcoded, salvo em arquivo do projeto, commitado ou exposto em logs desnecessários.

### Supabase

Quando houver mudanças em:

- Edge Functions
- migrations SQL
- RLS/policies
- banco
- storage configuration
- variáveis ou integrações backend

o agente deve considerar deploy no Supabase.

O agente deve usar as credenciais/tokens fornecidos pelo usuário em tempo de execução.

### Vercel

Sempre que houver deploy de frontend, preview, staging ou produção na Vercel, o agente **deve obrigatoriamente solicitar ao usuário o token de integração da Vercel antes de executar o deploy**, caso ele ainda não tenha sido fornecido na sessão atual.

Regra obrigatória:

- nunca presumir que o token da Vercel já existe
- sempre pedir o token de integração da Vercel antes do deploy frontend, se ele ainda não tiver sido informado
- o token deve ser tratado como segredo temporário de execução
- nunca salvar o token em arquivos versionados

### Ordem segura de deploy

Quando houver mudança full-stack com dependência estrutural, seguir preferencialmente:

1. backend / Edge Functions
2. banco / migrations / policies
3. frontend
4. validações finais

### Regra de bloqueio transparente

Se o agente não conseguir concluir deploy por falta de:

- token
- acesso ao GitHub
- acesso ao Supabase
- token da Vercel
- projeto vinculado
- CLI/configuração ausente
- erro externo de infraestrutura

deve informar exatamente:

- o que foi concluído
- o que faltou
- qual credencial ou passo bloqueou a execução

---

## Deploy por ambiente

### Frontend
- deploy na Vercel

### Backend e banco
- Supabase

### Regras

- separar variáveis por ambiente
- nunca misturar ambiente de teste e produção
- validar Stripe e webhook por ambiente
- manter deploy previsível
- aplicar migrations antes de liberar frontend quando houver dependência estrutural

---

## Ordem de implementação obrigatória

Seguir `docs/15-plano-de-implementacao.md`.

### Ordem resumida

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

### Não pular etapas

O agente não deve:

- começar por features avançadas antes da base
- implementar admin completo antes de auth e roles
- implementar Stripe antes de `orders` e webhook
- implementar downloads antes de `access_grants`
- deixar RLS para o fim

---

## Padrão de resposta do agente ao implementar

Para qualquer tarefa relevante, o agente deve:

1. dizer brevemente o que vai implementar
2. listar os docs usados como base
3. executar a implementação
4. validar build/testes relevantes
5. informar arquivos alterados
6. informar pendências ou limitações reais
7. executar deploy quando necessário e possível
8. se houver deploy frontend e o token da Vercel não tiver sido fornecido, solicitar esse token antes do deploy

---

## Padrão de qualidade

O agente deve produzir código:

- legível
- modular
- tipado
- consistente
- sem gambiarra
- pronto para produção
- alinhado aos docs

### O agente deve evitar

- código duplicado
- componentes gigantes
- lógica crítica em UI
- rotas sem proteção
- acessos diretos inseguros ao storage
- suposições não documentadas

---

## Quando houver ambiguidade

Se existir ambiguidade:

1. priorizar os documentos da pasta `/docs`
2. preferir a solução mais segura
3. preferir a solução mais compatível com a arquitetura existente
4. não simplificar de forma arbitrária uma regra crítica

---

## Checklist interno antes de concluir qualquer tarefa

- respeitei os docs corretos?
- mantive segurança no backend/banco?
- evitei colocar regra crítica no frontend?
- preservei a separação entre público/dashboard/admin?
- usei migrations quando houve mudança estrutural?
- considerei roles, grants e RLS?
- considerei build e consistência do projeto?
- considerei se era necessário fazer deploy?
- se havia deploy frontend, solicitei o token da Vercel?
- se havia deploy backend ou push remoto, usei credenciais fornecidas pelo usuário de forma segura?

---

## Resultado esperado deste repositório

Ao final, este projeto deve resultar em uma plataforma:

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
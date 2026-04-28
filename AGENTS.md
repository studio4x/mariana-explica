# AGENTS.md — Mariana Explica

## Função deste arquivo

Este arquivo orienta o Codex dentro do repositório.

A fonte oficial de verdade está na pasta `/docs`.

O Codex deve tratar este projeto como sistema real de produção, não como protótipo.

---

## Projeto

Mariana Explica é uma plataforma de venda e entrega de conteúdos educacionais digitais, com:

- área pública comercial;
- área autenticada do aluno;
- painel administrativo;
- backend serverless;
- PostgreSQL com RLS;
- Supabase Auth;
- Supabase Storage;
- Stripe;
- PWA;
- deploy em Vercel + Supabase.

---

## Fontes de verdade

Prioridade:

1. `docs/02-regras-negocio.md`
2. `docs/03-arquitetura.md`
3. `docs/10-autenticacao-seguranca.md`
4. `docs/04-banco-dados.md`
5. `docs/05-backend-edge-functions.md`
6. `docs/15-plano-de-implementacao.md`
7. demais documentos `docs/01-15` conforme o domínio da tarefa

A pasta `docs/Specs/` é auxiliar.

Use `docs/Specs/` como referência de:

- módulos;
- telas;
- componentes;
- fluxos;
- comportamento funcional já validado.

Mas, em caso de conflito, prevalecem os documentos canônicos `docs/01-15`.

Para alterações visuais públicas, consultar também:

- `docs/DESIGN.MD`

O redesign público deve preservar rotas, CTAs, fluxos dinâmicos, estados de loading/erro/vazio e a lógica funcional atual. :contentReference[oaicite:1]{index=1}

---

## Stack obrigatória

Usar, salvo instrução contrária:

- React
- TypeScript
- Vite
- React Router
- TanStack React Query
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions
- Stripe
- Vercel

---

## Regra principal de execução

Antes de implementar tarefa relevante:

1. identificar quais docs governam a tarefa;
2. consultar apenas os documentos necessários;
3. entender escopo, restrições e riscos;
4. implementar de forma pequena e objetiva;
5. não alterar arquitetura, regras de negócio ou segurança sem base documental.

Não inventar fluxos, permissões, modelagem ou integrações fora da documentação.

---

## Credenciais e confirmação de projeto

Antes de qualquer ação que exija acesso externo (Supabase, Vercel, GitHub, deploy, CLI ou integrações):

1. consultar obrigatoriamente o arquivo `.env.local` para obter credenciais e identificadores atualizados;
2. confirmar explicitamente que o projeto alvo é o correto (nome do repositório, `project_id`, URL e ambiente);
3. só executar comandos de acesso após essa validação dupla (credencial + projeto correto).

Se houver inconsistência entre credenciais, projeto e contexto atual, pausar a execução e corrigir antes de continuar.

---

## Arquitetura

A plataforma segue o padrão:

**SPA + backend serverless**

Separar claramente:

- área pública;
- dashboard do aluno;
- painel admin;
- regras de negócio;
- persistência;
- autenticação/autorização;
- integrações externas;
- automações.

O frontend não é fonte de verdade.

Operações críticas devem ficar em Edge Functions, banco, RLS e policies.

---

## Segurança obrigatória

Sempre considerar:

- autenticação em áreas privadas;
- autorização por `role`, `is_admin` e `status`;
- RLS em tabelas privadas;
- storage privado por padrão;
- URLs assinadas para arquivos protegidos;
- validação backend para ações críticas;
- auditoria em ações sensíveis;
- logs em integrações e automações;
- segredos nunca no frontend.

Nunca fazer:

- expor `service_role` no cliente;
- confiar no frontend para liberar acesso;
- tornar PDFs pagos públicos;
- criar grants diretamente pelo frontend;
- alterar banco sem migration;
- deixar função admin sem validação robusta.

---

## Regra crítica de negócio

`access_grants` é a fonte real de autorização ao conteúdo.

- `orders` representam estado comercial;
- `access_grants` representam permissão real de acesso;
- compra confirmada não libera acesso sem grant válido;
- reembolso pode exigir revogação de grant;
- conteúdo pago depende de grant válido;
- produto gratuito deve seguir regra explícita de liberação.

---

## Banco de dados

Toda alteração estrutural deve ser feita via migration SQL versionada.

Sempre avaliar:

- foreign keys;
- constraints;
- índices;
- triggers de `updated_at`;
- RLS;
- policies;
- logs/auditoria;
- idempotência.

Não depender de configuração manual no Supabase como fonte oficial.

---

## Edge Functions

Usar Edge Functions para:

- checkout Stripe;
- webhook Stripe;
- geração de URL assinada;
- claim de produto gratuito;
- criação/revogação de grants;
- ações administrativas sensíveis;
- notificações;
- jobs;
- integrações;
- reprocessamentos.

Cada função deve ter:

- responsabilidade única;
- validação explícita;
- checagem de permissão;
- idempotência quando necessário;
- retorno JSON claro;
- logs úteis.

---

## Frontend

O frontend deve:

- separar público, aluno e admin;
- usar React Query para estado remoto;
- usar componentes reutilizáveis;
- ser mobile-first;
- tratar loading, error, empty e success states;
- respeitar `docs/07-ui-ux.md`;
- preservar rotas e CTAs existentes.

O frontend não deve:

- decidir autorização final;
- calcular preço final como verdade;
- liberar download por conta própria;
- chamar integrações sensíveis diretamente.

---

## Área pública e redesign

Para páginas públicas, seguir `DESIGN.MD`.

Preservar obrigatoriamente:

- header público;
- footer público;
- catálogo;
- página de curso;
- checkout;
- suporte;
- login/criar conta;
- busca e filtros;
- CTA de checkout;
- fluxo de login com redirect;
- rodapé com build discreto.

A área pública deve parecer:

- clara;
- educacional;
- moderna;
- confiável;
- próxima;
- comercial sem ser agressiva.

Não transformar páginas dinâmicas em landing page estática.

---

## Admin

O admin é área sensível.

Operações administrativas devem:

- validar permissão no backend;
- auditar ações críticas;
- proteger alteração de role;
- evitar autoexclusão perigosa;
- passar por Edge Functions quando envolver dado sensível.

---

## Stripe

Stripe é o gateway oficial.

Regras:

- checkout criado no backend;
- webhook validado por assinatura;
- grant criado apenas após confirmação real;
- idempotência obrigatória;
- pedido interno deve manter referência externa;
- prever reconciliação entre Stripe e banco.

---

## PWA

A plataforma deve manter compatibilidade com PWA.

O PWA não pode quebrar:

- autenticação;
- autorização;
- segurança de conteúdo;
- acesso a arquivos protegidos.

---

## Ordem de implementação

Seguir `docs/15-plano-de-implementacao.md`.

Resumo:

1. setup;
2. estrutura base;
3. Supabase;
4. banco;
5. auth e segurança;
6. backend crítico;
7. área pública;
8. checkout Stripe;
9. dashboard do aluno;
10. admin;
11. notificações e suporte;
12. automações;
13. PWA;
14. deploy.

Não pular etapas críticas como auth, roles, RLS, grants e webhook.

---

## Build version

Quando houver ajuste relevante de produto, atualizar a versão exibida no admin.

Preferir hash curto do commit atual ou identificador consistente de build.

Não deixar rodapé/admin exibindo versão antiga após deploy.

---

## Deploy

Quando a mudança precisar refletir em ambiente remoto, deploy faz parte da tarefa.

Considerar deploy quando houver alteração em:

- frontend;
- Edge Functions;
- migrations;
- RLS/policies;
- storage;
- integrações;
- automações.

Ordem segura:

1. backend / Edge Functions;
2. banco / migrations / policies;
3. frontend;
4. validações finais.

Nunca salvar tokens em arquivos versionados.

---

## Resposta esperada do Codex

Para tarefa relevante, responder objetivamente com:

- docs usados como base;
- resumo do que será feito;
- arquivos criados/editados;
- validação realizada;
- pendências reais.

Evitar explicações longas em tarefas simples.

---

## Checklist antes de concluir

Antes de finalizar, verificar:

- os docs corretos foram respeitados?
- regra crítica ficou fora do frontend?
- RLS/policies foram consideradas?
- grants foram preservados?
- roles/status foram respeitados?
- mudanças de banco têm migration?
- estados de loading/erro/vazio existem?
- build/teste foi validado quando aplicável?
- deploy era necessário?

---

## Playbook: Edge Function 401 em ações admin

Se uma Edge Function admin retornar `401`:

1. atualizar sessão no frontend;
2. usar `supabase.auth.getSession()`;
3. se necessário, usar `supabase.auth.refreshSession()`;
4. enviar `Authorization: Bearer <access_token>`;
5. incluir `{ access_token }` no body;
6. usar `fetch` direto para diagnóstico quando `supabase.functions.invoke` falhar.

Se o gateway continuar retornando `401`:

1. publicar com `--no-verify-jwt`;
2. validar token manualmente dentro da função;
3. usar `supabaseAdmin.auth.getUser(token)`;
4. checar `profiles.is_admin` ou `profiles.role === "admin"`;
5. retornar JSON claro:
   - `401 token ausente ou inválido`;
   - `403 acesso negado`.

Deploy:

```bash
npx supabase functions deploy <function-name> --project-ref <ref> --no-verify-jwt

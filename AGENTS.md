# AGENTS.md - Mariana Explica

## Funcao deste arquivo

Este arquivo orienta agentes no repositorio.
A fonte oficial de verdade esta na pasta `/docs`.
Este projeto deve ser tratado como sistema real de producao, nao como prototipo.

---

## Projeto

Mariana Explica e uma plataforma de venda e entrega de conteudos educacionais digitais, com:

- area publica comercial;
- area autenticada do aluno;
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
7. demais documentos `docs/01-15` conforme o dominio da tarefa

A pasta `docs/Specs/` e auxiliar.
Pode ser usada como referencia de:

- modulos;
- telas;
- componentes;
- fluxos;
- comportamento funcional validado.

Em caso de conflito, prevalecem os documentos canonicos `docs/01-15`.

Para alteracoes visuais publicas, consultar tambem:

- `docs/DESIGN.MD`

O redesign publico deve preservar rotas, CTAs, fluxos dinamicos, estados de loading/erro/vazio e a logica funcional atual.

---

## Stack obrigatoria

Usar, salvo instrucao contraria:

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

## Regra principal de execucao

Antes de implementar tarefa relevante:

1. identificar quais docs governam a tarefa;
2. consultar apenas os documentos necessarios;
3. entender escopo, restricoes e riscos;
4. implementar de forma pequena e objetiva;
5. nao alterar arquitetura, regras de negocio ou seguranca sem base documental.

Nao inventar fluxos, permissoes, modelagem ou integracoes fora da documentacao.

---

## Credenciais e confirmacao de projeto

Antes de qualquer acao que exija acesso externo (Supabase, Vercel, GitHub, deploy, CLI ou integracoes):

1. consultar obrigatoriamente `.env.local` para obter credenciais e identificadores atualizados;
2. confirmar explicitamente que o projeto alvo e o correto (repositorio, `project_id`, URL e ambiente);
3. so executar comandos de acesso apos validacao dupla (credencial + projeto correto).

Se houver inconsistencias, pausar e corrigir antes de continuar.

---

## Arquitetura

A plataforma segue o padrao:

**SPA + backend serverless**

Separar claramente:

- area publica;
- dashboard do aluno;
- painel admin;
- regras de negocio;
- persistencia;
- autenticacao/autorizacao;
- integracoes externas;
- automacoes.

O frontend nao e fonte de verdade.
Operacoes criticas devem ficar em Edge Functions, banco, RLS e policies.

---

## Seguranca obrigatoria

Sempre considerar:

- autenticacao em areas privadas;
- autorizacao por `role`, `is_admin` e `status`;
- RLS em tabelas privadas;
- storage privado por padrao;
- URLs assinadas para arquivos protegidos;
- validacao backend para acoes criticas;
- auditoria em acoes sensiveis;
- logs em integracoes e automacoes;
- segredos nunca no frontend.

Nunca fazer:

- expor `service_role` no cliente;
- confiar no frontend para liberar acesso;
- tornar PDFs pagos publicos;
- criar grants diretamente pelo frontend;
- alterar banco sem migration;
- deixar funcao admin sem validacao robusta.

---

## Regra critica de negocio

`access_grants` e a fonte real de autorizacao ao conteudo.

- `orders` representam estado comercial;
- `access_grants` representam permissao real de acesso;
- compra confirmada nao libera acesso sem grant valido;
- reembolso pode exigir revogacao de grant;
- conteudo pago depende de grant valido;
- produto gratuito deve seguir regra explicita de liberacao.

---

## Banco de dados

Toda alteracao estrutural deve ser feita via migration SQL versionada.

Sempre avaliar:

- foreign keys;
- constraints;
- indices;
- triggers de `updated_at`;
- RLS;
- policies;
- logs/auditoria;
- idempotencia.

Nao depender de configuracao manual no Supabase como fonte oficial.

---

## Edge Functions

Usar Edge Functions para:

- checkout Stripe;
- webhook Stripe;
- geracao de URL assinada;
- claim de produto gratuito;
- criacao/revogacao de grants;
- acoes administrativas sensiveis;
- notificacoes;
- jobs;
- integracoes;
- reprocessamentos.

Cada funcao deve ter:

- responsabilidade unica;
- validacao explicita;
- checagem de permissao;
- idempotencia quando necessario;
- retorno JSON claro;
- logs uteis.

---

## Frontend

O frontend deve:

- separar publico, aluno e admin;
- usar React Query para estado remoto;
- usar componentes reutilizaveis;
- ser mobile-first;
- tratar loading, error, empty e success states;
- respeitar `docs/07-ui-ux.md`;
- preservar rotas e CTAs existentes.

O frontend nao deve:

- decidir autorizacao final;
- calcular preco final como verdade;
- liberar download por conta propria;
- chamar integracoes sensiveis diretamente.

---

## Area publica e redesign

Para paginas publicas, seguir `DESIGN.MD`.

Preservar obrigatoriamente:

- header publico;
- footer publico;
- catalogo;
- pagina de curso;
- checkout;
- suporte;
- login/criar conta;
- busca e filtros;
- CTA de checkout;
- fluxo de login com redirect;
- rodape com build discreto.

Nao transformar paginas dinamicas em landing page estatica.

---

## Admin

O admin e area sensivel.

Operacoes administrativas devem:

- validar permissao no backend;
- auditar acoes criticas;
- proteger alteracao de role;
- evitar autoexclusao perigosa;
- passar por Edge Functions quando envolver dado sensivel.

---

## Stripe

Stripe e o gateway oficial.

Regras:

- checkout criado no backend;
- webhook validado por assinatura;
- grant criado apenas apos confirmacao real;
- idempotencia obrigatoria;
- pedido interno deve manter referencia externa;
- prever reconciliacao entre Stripe e banco.

---

## PWA

A plataforma deve manter compatibilidade com PWA sem quebrar:

- autenticacao;
- autorizacao;
- seguranca de conteudo;
- acesso a arquivos protegidos.

---

## Ordem de implementacao

Seguir `docs/15-plano-de-implementacao.md`.

Resumo:

1. setup;
2. estrutura base;
3. Supabase;
4. banco;
5. auth e seguranca;
6. backend critico;
7. area publica;
8. checkout Stripe;
9. dashboard do aluno;
10. admin;
11. notificacoes e suporte;
12. automacoes;
13. PWA;
14. deploy.

Nao pular etapas criticas como auth, roles, RLS, grants e webhook.

---

## Build version

Quando houver ajuste relevante, atualizar a versao exibida no produto.
Preferir identificador consistente (versao numerica + hash de commit/deploy).

---

## Deploy

Quando a mudanca precisar refletir em ambiente remoto, deploy faz parte da tarefa.

Considerar deploy quando houver alteracao em:

- frontend;
- Edge Functions;
- migrations;
- RLS/policies;
- storage;
- integracoes;
- automacoes.

Ordem segura:

1. backend / Edge Functions;
2. banco / migrations / policies;
3. frontend;
4. validacoes finais.

Nunca salvar tokens em arquivos versionados.

### Validacao de producao

Antes de encerrar um deploy, confirmar que:

- o deploy de producao esta `READY`;
- o dominio canonico aponta para o deploy mais recente;
- o SHA ativo em producao corresponde ao `HEAD` publicado;
- o alias de producao nao ficou preso em revisao antiga.

### Regra obrigatoria de ciclo de entrega

Para este projeto, cada novo ajuste deve seguir o ciclo completo:

1. commit da alteracao;
2. push para o remoto;
3. validacao de deploy na Vercel em producao.

Nao encerrar tarefa sem essa verificacao de producao.

---

## Resposta esperada do agente

Para tarefa relevante, responder objetivamente com:

- docs usados como base;
- resumo do que foi feito;
- arquivos criados/editados;
- validacao realizada;
- pendencias reais.

---

## Checklist antes de concluir

Antes de finalizar, verificar:

- os docs corretos foram respeitados;
- regra critica fora do frontend;
- RLS/policies consideradas;
- grants preservados;
- roles/status respeitados;
- mudancas de banco com migration;
- estados de loading/erro/vazio presentes;
- build/teste validado quando aplicavel;
- commit feito;
- deploy validado em producao quando necessario.

---

## Playbook: Edge Function 401 em acoes admin

Se uma Edge Function admin retornar `401`:

1. atualizar sessao no frontend;
2. usar `supabase.auth.getSession()`;
3. se necessario, usar `supabase.auth.refreshSession()`;
4. enviar `Authorization: Bearer <access_token>`;
5. incluir `{ access_token }` no body;
6. usar `fetch` direto para diagnostico quando `supabase.functions.invoke` falhar.

Se o gateway continuar retornando `401`:

1. publicar com `--no-verify-jwt`;
2. validar token manualmente dentro da funcao;
3. usar `supabaseAdmin.auth.getUser(token)`;
4. checar `profiles.is_admin` ou `profiles.role === "admin"`;
5. retornar JSON claro:
   - `401 token ausente ou invalido`;
   - `403 acesso negado`.

Deploy:

```bash
npx supabase functions deploy <function-name> --project-ref <ref> --no-verify-jwt
```

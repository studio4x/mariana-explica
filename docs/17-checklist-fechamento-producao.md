# Checklist de Fechamento de Producao

## 1. Objetivo

Este documento controla o fechamento operacional do plano inicial de implementacao da plataforma Mariana Explica.

Ele deve ser usado como roteiro vivo, item por item. Antes de concluir qualquer item, validar o estado real no codigo, Supabase, Vercel ou ambiente de producao. Ao finalizar um item, atualizar o status aqui e seguir automaticamente para o proximo.

## 2. Base documental

- `docs/02-regras-negocio.md`
- `docs/03-arquitetura.md`
- `docs/05-backend-edge-functions.md`
- `docs/10-autenticacao-seguranca.md`
- `docs/11-integracoes.md`
- `docs/12-automacoes.md`
- `docs/13-pwa.md`
- `docs/14-deploy.md`
- `docs/15-plano-de-implementacao.md`
- `docs/16-proximas-etapas-cursos.md`

## 3. Legenda de status

- `pendente`: ainda nao validado nem iniciado nesta rodada.
- `em_andamento`: parte da validacao ou implementacao ja foi feita, mas ainda falta criterio de aceite.
- `concluido`: entregue, validado e sem acao aberta dentro do escopo.
- `falhou`: houve tentativa e a falha precisa de correcao antes de nova tentativa.
- `bloqueado`: depende de credencial, decisao, dado externo, pagamento real, conta de teste ou dispositivo fisico.
- `post_mvp`: item reconhecido como futuro ou de maturidade, sem bloquear o MVP atual.

## 4. Regra de execucao por item

1. Ler os documentos governantes do item.
2. Verificar estado real no repo e nos ambientes remotos.
3. Classificar o item com um dos status acima.
4. Se estiver pronto, registrar evidencias e marcar `concluido`.
5. Se estiver pendente e for implementavel sem informacao externa, implementar, validar, fazer deploy quando necessario e marcar `concluido`.
6. Se depender de informacao externa, marcar `bloqueado` e registrar exatamente o que precisa ser fornecido.
7. Se falhar, marcar `falhou`, registrar causa, tentativa feita e proximo passo.
8. Atualizar este documento e seguir para o proximo item automaticamente.

## 5. Fotografia inicial desta rodada

- Data: `2026-04-21`
- Dominio publico: `https://www.mariana-explica.pt` respondeu `200 OK`.
- Vercel: ultimo deploy consultado esta `READY`, no commit `eb27d1e0d597ccbc85c0ef8c8f557e50fa5fec1e`.
- Supabase migrations: `0001` a `0013` alinhadas entre local e remoto.
- Supabase Edge Functions: funcoes criticas, cron jobs e `admin-email-status` constam como `ACTIVE`.
- Supabase secrets: existem `CRON_SECRET`, secrets Stripe e secrets SMTP (`EMAIL_PROVIDER`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, remetente e reply-to).
- PWA: `manifest.webmanifest` remoto respondeu `200 OK`.
- Scheduler externo: nao foi encontrada configuracao versionada em `.github`, `.vercel`, `vercel.json` ou arquivos do repo.
- Testes: existem smoke tests E2E basicos em `tests/e2e/app-smoke.spec.js`, mas ainda nao cobrem compra, grant, downloads protegidos e fluxos admin autenticados.
- Limpeza tecnica: diretorios `supabase/functions/admin-course-storage`, `supabase/functions/admin-site-config` e `supabase/functions/cron-process-notifications` existem localmente sem `index.ts`, sem arquivos internos e sem entradas rastreadas pelo Git.

## 6. Itens de fechamento

### Item 1 - Validar email transacional real em producao usando SMTP ja configurado

- Status: `concluido`
- Objetivo: confirmar entrega real de email pela fila transacional usando as variaveis SMTP do projeto.
- Base documental: `docs/11-integracoes.md`, `docs/12-automacoes.md`, `docs/14-deploy.md`, `docs/16-proximas-etapas-cursos.md`.
- Diagnostico inicial:
  - o backend ja tem transporte SMTP em `supabase/functions/_shared/email.ts`;
  - `cron-process-email-deliveries` esta ativo no Supabase;
  - `admin-email-status` esta ativo no Supabase;
  - os secrets SMTP existem no projeto remoto;
  - a Vercel ja publicou o commit `eb27d1e0d597ccbc85c0ef8c8f557e50fa5fec1e`, que ajustou a pagina admin para usar o SMTP do projeto.
- Acoes planejadas:
  - criar ou localizar um email transacional real na fila `email_deliveries`;
  - executar o processamento por cron ou aguardar o scheduler real;
  - confirmar status `sent` e entrega na caixa de destino;
  - registrar provider, mensagem/erro e evidencia.
- Validacoes:
  - confirmar que a fila saiu de `queued` para `sent`;
  - confirmar entrega fora do banco, na caixa de email;
  - confirmar que falhas ficam registradas sem quebrar pedido, grant ou notificacao.
- Deploy necessario: nao ha deploy pendente para o codigo atual; apenas validacao operacional.
- Resultado: implementacao e configuracao remota estao prontas, mas a entrega real ainda nao foi comprovada.
- Falhas: nenhuma falha de codigo encontrada nesta rodada.
- Pendencias para desbloquear:
  - fornecer ou confirmar um destinatario de teste;
  - fornecer acesso administrativo/sessao de admin ou autorizar uma insercao controlada na fila de emails;
  - fornecer o valor operacional do `CRON_SECRET` ou confirmar que o scheduler externo ja executara o job.
- Atualizacao de fechamento em 2026-04-21:
  - destinatario de teste definido: `agenciastudio4x@gmail.com`;
  - `CRON_SECRET` foi rotacionado e sincronizado entre secrets das Edge Functions e Supabase Vault;
  - o cron `cron-process-email-deliveries` foi acionado com sucesso;
  - o email `purchase_confirmed` para `agenciastudio4x@gmail.com` saiu de `queued` para `sent`;
  - provider registrado: `smtp`;
  - `provider_message_id` registrado no banco;
  - `job_runs` registrou `cron_process_email_deliveries` com `status = success`, `processed_count = 1` e `failed_count = 0`.
- Resultado final:
  - backend, SMTP, fila e cron validados com sucesso.
  - a confirmacao visual de recebimento na caixa de entrada fica como verificacao manual do destinatario, mas o envio tecnico foi concluido.
- Pendencias: nenhuma pendencia tecnica aberta neste item.

### Item 2 - Confirmar ou configurar scheduler externo dos crons com CRON_SECRET

- Status: `concluido`
- Objetivo: garantir que os cron jobs sejam chamados automaticamente em producao.
- Base documental: `docs/05-backend-edge-functions.md`, `docs/12-automacoes.md`, `docs/14-deploy.md`, `docs/16-proximas-etapas-cursos.md`.
- Diagnostico inicial:
  - cron functions existem e estao `ACTIVE`;
  - `CRON_SECRET` existe no Supabase;
  - nao ha configuracao versionada de agenda no repo;
  - nao foi comprovado que um scheduler externo esta chamando as funcoes.
- Acoes planejadas:
  - escolher o agendador oficial;
  - configurar chamadas HTTPS para os cron jobs com `x-cron-secret` ou body aceito pelo helper;
  - registrar frequencia, URL, dono operacional e ultima execucao.
- Validacoes:
  - verificar `job_runs` apos execucao real;
  - confirmar retorno sem `401`;
  - confirmar logs por job.
- Deploy necessario: apenas se a solucao escolhida exigir arquivo versionado ou ajuste de codigo.
- Resultado: backend esta pronto; agendamento real nao confirmado.
- Falhas: nenhuma falha de codigo encontrada nesta rodada.
- Pendencias para desbloquear:
  - escolher/confirmar provedor de scheduler;
  - fornecer credencial/acesso do provedor;
  - fornecer o valor operacional do `CRON_SECRET` ou permitir configurar a chamada diretamente.
- Atualizacao de fechamento em 2026-04-21:
  - criada a migration `0013_platform_cron_scheduler.sql`;
  - habilitados `pg_cron`, `pg_net` e `supabase_vault`;
  - criadas RPCs internas `configure_platform_cron_jobs`, `get_platform_cron_jobs` e helper de upsert de secrets no Vault;
  - criada e implantada a Edge Function `admin-cron-scheduler`;
  - `admin-cron-scheduler` permite admin acionar `status`, `schedule`, `run_one`, `run_all` e `queue_test_email`;
  - a chamada sem token para `admin-cron-scheduler` retornou `401 Token de acesso ausente`, confirmando protecao;
  - os cinco jobs foram programados no banco e estao `active = true`.
- Jobs ativos:
  - `mariana-cron-process-email-deliveries`: `*/5 * * * *`
  - `mariana-cron-retry-email-deliveries`: `*/15 * * * *`
  - `mariana-cron-reconcile-orders`: `7 * * * *`
  - `mariana-cron-audit-access-consistency`: `17 5 * * *`
  - `mariana-cron-clean-expired-links`: `37 5 * * *`
- Resultado final:
  - scheduler recorrente foi ativado dentro do Supabase com `pg_cron` + `pg_net`;
  - URL e segredo ficam no Supabase Vault, sem segredo versionado no repo.
- Pendencias: nenhuma pendencia tecnica aberta neste item.

### Item 3 - Validar compra real em producao: Stripe, webhook, pedido, grant e acesso do aluno

- Status: `bloqueado`
- Objetivo: comprovar o fluxo comercial real ponta a ponta.
- Base documental: `docs/02-regras-negocio.md`, `docs/10-autenticacao-seguranca.md`, `docs/11-integracoes.md`, `docs/14-deploy.md`, `docs/15-plano-de-implementacao.md`.
- Diagnostico inicial:
  - `create-checkout` e `payment-webhook` estao `ACTIVE`;
  - secrets Stripe de teste e live existem no Supabase;
  - migrations de pedidos, grants e hardening estao alinhadas;
  - ainda nao ha evidencia registrada de uma compra real de producao nesta rodada.
- Acoes planejadas:
  - executar checkout real em producao com conta de aluno controlada;
  - confirmar evento Stripe recebido pelo webhook;
  - confirmar `orders.status = paid`;
  - confirmar `access_grants.status = active`;
  - validar acesso do aluno ao curso comprado;
  - validar, quando seguro, refund/revogacao.
- Validacoes:
  - pedido pago no banco;
  - grant ativo;
  - dashboard do aluno libera apenas o conteudo autorizado;
  - logs/auditoria sem erro critico.
- Deploy necessario: nao ha deploy pendente para iniciar a validacao.
- Resultado: infraestrutura pronta; compra real ainda nao comprovada nesta rodada.
- Falhas: nenhuma falha de codigo encontrada nesta rodada.
- Pendencias para desbloquear:
  - autorizar uma compra real ou fornecer estrategia de compra controlada;
  - informar conta de aluno de teste;
  - informar se o pagamento sera reembolsado apos validacao.
- Atualizacao de fechamento em 2026-04-21:
  - usuario de teste confirmado: `agenciastudio4x@gmail.com`;
  - o perfil existe e esta `active`, `role = student`;
  - havia um pedido antigo com `payment_environment = test`, `checkout_session_id` de teste e grant ativo associado;
  - a reconciliacao foi acionada e processou o pedido `693fee1e-be66-43f4-ab63-cee0a4c8fc00`;
  - a auditoria de acesso foi acionada em seguida;
  - o grant inconsistente foi revogado porque o pedido permaneceu `status = failed`;
  - essa correcao eliminou um risco real de acesso indevido.
- Resultado atual:
  - a consistencia entre pedido falhado e grant foi corrigida;
  - ainda nao existe uma compra valida e paga para este aluno apos a correcao.
- Pendencias para desbloquear:
  - realizar uma nova compra de teste controlada ou compra real autorizada para `agenciastudio4x@gmail.com`;
  - confirmar se o checkout deve usar ambiente Stripe `test` ou `live`;
  - validar novo pedido com `status = paid`, grant ativo e acesso do aluno.

### Item 4 - Executar smoke test final de producao

- Status: `bloqueado`
- Objetivo: validar os fluxos essenciais em producao antes de considerar o plano inicial fechado.
- Base documental: `docs/14-deploy.md`, `docs/15-plano-de-implementacao.md`, `docs/16-proximas-etapas-cursos.md`.
- Diagnostico inicial:
  - dominio publico respondeu `200 OK`;
  - `manifest.webmanifest` respondeu `200 OK`;
  - Vercel esta `READY`;
  - Supabase esta com migrations e funcoes principais alinhadas;
  - smoke autenticado de admin/aluno ainda nao foi executado nesta rodada.
- Acoes planejadas:
  - validar home, catalogo, login, cadastro e checkout sem produto;
  - validar login de aluno, dashboard, curso, player, downloads assinados e suporte;
  - validar login admin, usuarios, cursos, pedidos, pagamentos, suporte, configuracoes e logs;
  - registrar falhas e correcoes.
- Validacoes:
  - smoke publico sem erro;
  - smoke aluno com grant real;
  - smoke admin com conta admin real;
  - ausencia de erros criticos visiveis no navegador.
- Deploy necessario: somente se algum ajuste for implementado durante o smoke.
- Resultado: smoke publico tecnico parcial OK; smoke autenticado ainda nao executado.
- Falhas: nenhuma falha encontrada nos checks HTTP simples.
- Pendencias para desbloquear:
  - fornecer credenciais ou sessao de uma conta admin;
  - fornecer credenciais ou sessao de aluno com grant ativo;
  - decidir se o smoke sera manual assistido ou automatizado com Playwright.
- Atualizacao de fechamento em 2026-04-21:
  - conta admin confirmada no banco: `contato@studio4x.com.br`, `role = admin`, `is_admin = true`, `status = active`;
  - conta aluno confirmada no banco: `agenciastudio4x@gmail.com`, `role = student`, `status = active`;
  - o aluno nao possui grant ativo apos a correcao do item 3;
  - sem senha/sessao das contas, nao foi possivel executar smoke autenticado real no navegador.
- Resultado atual:
  - pre-condicoes de existencia das contas foram confirmadas;
  - smoke publico e saude de backend foram validados;
  - smoke autenticado continua bloqueado por sessao/senha e por ausencia de grant ativo do aluno.
- Pendencias para desbloquear:
  - fornecer senha temporaria ou sessao para `contato@studio4x.com.br`;
  - fornecer senha temporaria ou sessao para `agenciastudio4x@gmail.com`;
  - concluir uma compra/grant valido para o aluno antes do smoke de acesso a conteudo.

### Item 5 - Validar PWA em Android e iOS reais

- Status: `em_andamento`
- Objetivo: confirmar que a instalacao e o uso standalone funcionam em dispositivos reais.
- Base documental: `docs/13-pwa.md`, `docs/14-deploy.md`, `docs/15-plano-de-implementacao.md`.
- Diagnostico inicial:
  - PWA basico existe com manifest, service worker, offline page e icones;
  - `manifest.webmanifest` remoto respondeu `200 OK`;
  - nao ha validacao registrada em Android/iOS reais nesta rodada.
- Acoes planejadas:
  - instalar no Android pelo navegador compativel;
  - adicionar a tela inicial no iOS;
  - validar abertura standalone, login, navegacao e fallback offline;
  - confirmar que conteudo protegido nao fica disponivel indevidamente offline.
- Validacoes:
  - app instalavel;
  - icone correto;
  - splash/standalone coerente;
  - fallback offline claro;
  - conteudo pago segue protegido.
- Deploy necessario: somente se forem encontrados problemas de PWA.
- Resultado: arquivos remotos existem; validacao fisica ainda nao feita.
- Falhas: nenhuma falha encontrada nos checks HTTP simples.
- Pendencias para desbloquear:
  - acesso a um dispositivo Android real;
  - acesso a um dispositivo iOS real;
  - conta de aluno para teste standalone autenticado.
- Atualizacao de fechamento em 2026-04-21:
  - o PWA permanece tecnicamente publicado e acessivel;
  - a validacao Android sera feita manualmente pelo usuario;
  - iOS segue sem validacao fisica registrada.
- Resultado atual:
  - item em validacao manual.
- Pendencias:
  - usuario confirmar resultado no Android;
  - validar iOS quando houver dispositivo disponivel;
  - repetir teste standalone autenticado quando houver aluno com grant ativo.

### Item 6 - Definir e implementar analytics e pixels, se houver IDs

- Status: `post_mvp`
- Objetivo: ativar medicao de conversao e comportamento sem comprometer privacidade ou seguranca.
- Base documental: `docs/11-integracoes.md`, `docs/13-pwa.md`, `docs/14-deploy.md`, `docs/15-plano-de-implementacao.md`.
- Diagnostico inicial:
  - os docs citam analytics/pixels como item de maturidade;
  - nao foi encontrada implementacao efetiva de GA4, Meta Pixel ou equivalente no frontend;
  - nao foram encontrados IDs versionados ou configurados no repo.
- Acoes planejadas:
  - receber IDs e politica de consentimento;
  - implementar rastreamento minimo de pageview e conversao;
  - garantir que compra validada continue tendo o banco como fonte de verdade.
- Validacoes:
  - pageviews chegando no provedor;
  - eventos de checkout/conversao sem dados sensiveis;
  - consentimento respeitado quando aplicavel.
- Deploy necessario: sim, quando implementado no frontend.
- Resultado: nao bloqueia o fechamento do MVP, salvo decisao de marketing.
- Falhas: nenhuma.
- Pendencias para promover a item ativo:
  - fornecer GA4 Measurement ID, Meta Pixel ID ou provedor escolhido;
  - definir politica de consentimento/cookies.

### Item 7 - Confirmar ambiente de staging completo

- Status: `post_mvp`
- Objetivo: ter ambiente separado de producao para homologacao continua.
- Base documental: `docs/14-deploy.md`, `docs/15-plano-de-implementacao.md`.
- Diagnostico inicial:
  - `docs/14-deploy.md` recomenda `develop` para staging;
  - nao ha evidencia local de workflow completo de staging;
  - `.vercel/project.json` aponta para o projeto de producao atual.
- Acoes planejadas:
  - criar ou confirmar projeto Vercel de staging;
  - definir variaveis de staging;
  - definir Supabase/staging ou estrategia de banco isolado;
  - registrar URL e fluxo de deploy.
- Validacoes:
  - deploy de branch de staging;
  - variaveis separadas;
  - smoke basico em staging.
- Deploy necessario: sim, quando o ambiente for criado.
- Resultado: fica como maturidade operacional pos-MVP.
- Falhas: nenhuma.
- Pendencias para promover a item ativo:
  - decidir se staging tera Supabase separado ou projeto compartilhado com dados isolados;
  - fornecer/acordar dominio ou URL de staging.

### Item 8 - Registrar push notifications como pos-MVP, salvo decisao contraria

- Status: `post_mvp`
- Objetivo: manter rastreabilidade da decisao sobre push notifications.
- Base documental: `docs/12-automacoes.md`, `docs/13-pwa.md`, `docs/15-plano-de-implementacao.md`.
- Diagnostico inicial:
  - notificacoes internas e email transacional existem;
  - web push nao foi encontrado como implementacao ativa;
  - o plano inicial lista push notifications em entregas pos-MVP.
- Acoes planejadas:
  - manter como pos-MVP ate haver decisao explicita;
  - se promovido, definir opt-in, VAPID keys, fila, permissao e politica de retry.
- Validacoes:
  - inscricao push;
  - envio de teste;
  - fallback para usuarios sem permissao.
- Deploy necessario: sim, se promovido para implementacao.
- Resultado: registrado como pos-MVP.
- Falhas: nenhuma.
- Pendencias para promover a item ativo:
  - decidir que push e necessario agora;
  - fornecer/autorizar VAPID keys e politica de consentimento.

### Item 9 - Fazer limpeza tecnica de diretorios/funcoes obsoletas, se confirmada

- Status: `concluido`
- Objetivo: evitar ruido entre funcoes reais e placeholders locais.
- Base documental: `docs/05-backend-edge-functions.md`, `docs/12-automacoes.md`, `docs/14-deploy.md`.
- Diagnostico inicial:
  - `admin-course-storage`, `admin-site-config` e `cron-process-notifications` existem localmente sem `index.ts`;
  - os tres diretorios estao vazios e nao possuem arquivos rastreados pelo Git;
  - as funcoes remotas ativas nao dependem desses diretorios vazios.
- Acoes planejadas:
  - nao criar commit de remocao porque nao ha arquivo rastreado pelo Git;
  - manter o item documentado para evitar confundir esses nomes com pendencias reais.
- Validacoes:
  - `git ls-files` nao retornou arquivos nesses diretorios;
  - listagem recursiva nao encontrou arquivos internos.
- Deploy necessario: nenhum.
- Resultado: concluido como limpeza documental; sem alteracao versionada necessaria.
- Falhas: nenhuma.
- Pendencias: nenhuma dentro do escopo.

### Item 10 - Expandir testes/E2E dos fluxos criticos

- Status: `bloqueado`
- Objetivo: cobrir compra, grant, download protegido, admin e aluno autenticado com testes reprodutiveis.
- Base documental: `docs/14-deploy.md`, `docs/15-plano-de-implementacao.md`.
- Diagnostico inicial:
  - existem testes unitarios de rotas protegidas/admin;
  - existe smoke E2E publico em `tests/e2e/app-smoke.spec.js`;
  - nao ha E2E cobrindo compra real, webhook, grants, downloads assinados e admin autenticado.
- Acoes planejadas:
  - definir contas de teste e dados seedados;
  - criar smoke autenticado de aluno;
  - criar smoke autenticado de admin;
  - criar teste de checkout em ambiente seguro, sem depender de pagamento real em cada execucao;
  - registrar como executar local e em CI.
- Validacoes:
  - `npm run test`;
  - `npm run test:e2e`;
  - evidencias de grant/download/admin em ambiente controlado.
- Deploy necessario: nao para testes locais; sim se houver ajustes de codigo ou CI.
- Resultado: cobertura atual e util, mas ainda insuficiente para fechamento operacional completo.
- Falhas: nenhuma.
- Pendencias para desbloquear:
  - fornecer ou autorizar criacao de contas/dados de teste;
  - definir se os testes usarao producao, staging ou ambiente local;
  - definir estrategia segura para checkout sem pagamento real recorrente.

## 7. Relatorio da rodada atual

### Sucessos

- Documento operacional criado para acompanhar o fechamento item a item.
- Producao respondeu `200 OK` no dominio principal.
- Vercel confirmou deploy `READY` no commit `eb27d1e0d597ccbc85c0ef8c8f557e50fa5fec1e`.
- Supabase remoto confirmou migrations `0001` a `0013` alinhadas apos aplicar a migration de scheduler.
- Supabase remoto confirmou funcoes criticas e cron jobs ativos.
- Supabase remoto confirmou secrets SMTP e `CRON_SECRET` presentes.
- Limpeza tecnica de diretorios vazios foi classificada sem pendencia versionada.
- Edge Function `admin-cron-scheduler` criada, implantada e protegida por admin auth.
- Scheduler interno ativado com cinco jobs `pg_cron` ativos.
- Email transacional para `agenciastudio4x@gmail.com` processado com sucesso via SMTP.
- Reconciliacao/auditoria corrigiu grant inconsistente ligado a pedido falhado.

### Falhas

- A chamada inicial ao Supabase via `npx` falhou por politica de execucao do PowerShell para `npx.ps1`; a validacao foi repetida com `npx.cmd` e concluida com sucesso.
- Uma tentativa de SQL temporario com BOM foi rejeitada pelo Supabase; o `CRON_SECRET` foi rotacionado em seguida e a configuracao foi refeita com arquivo sem BOM.
- A validacao do item 3 encontrou pedido de teste antigo com grant ativo, mas pedido em `failed`; o cron corrigiu revogando o grant.

### Pendencias bloqueadas

- Compra real: falta nova compra valida para `agenciastudio4x@gmail.com` apos a revogacao do grant inconsistente.
- Smoke autenticado: faltam senha/sessao das contas admin/aluno e aluno com grant ativo.
- PWA real: falta confirmacao manual no Android e validacao futura em iOS.
- E2E critico: faltam contas/dados/ambiente de teste.

### Pendencias pos-MVP

- Analytics/pixels, salvo decisao de marketing para antecipar.
- Staging completo, salvo decisao operacional para antecipar.
- Push notifications, salvo decisao de produto para antecipar.

### Recomendacao de prontidao

O nucleo tecnico do MVP esta pronto para homologacao final, e os itens de email e scheduler foram fechados tecnicamente. A producao ainda nao deve ser considerada totalmente fechada enquanto uma nova compra valida, smoke autenticado e validacao fisica do PWA nao forem comprovados.

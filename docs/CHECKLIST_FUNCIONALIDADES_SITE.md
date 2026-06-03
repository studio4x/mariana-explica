# Checklist de Validacao de Funcionalidades - Mariana Explica

Base de referencia:
- `docs/Estrutura Inicial/02-regras-negocio.md`
- `docs/Estrutura Inicial/03-arquitetura.md`
- `docs/Estrutura Inicial/04-banco-dados.md`
- `docs/Estrutura Inicial/05-backend-edge-functions.md`
- `docs/Estrutura Inicial/08-dashboard.md`
- `docs/Estrutura Inicial/09-admin.md`
- `docs/Estrutura Inicial/10-autenticacao-seguranca.md`
- `docs/Estrutura Inicial/11-integracoes.md`
- `docs/Estrutura Inicial/13-pwa.md`
- `docs/Referências/CHECKLIST_VALIDACAO_PLATAFORMA.md`
- rotas e modulos atuais do codigo (`src/routes/index.tsx`, `src/pages/*`, `supabase/functions/*`)

## Como usar (IA ou manual)
- Marcar `[x]` quando validado com sucesso.
- Manter `[ ]` quando ainda nao validado.
- Em falha, manter `[ ]` e acrescentar no final do item: `| NOK: <motivo curto>`.
- Sempre que possivel, acrescentar no final do item: `| Evidencia: <rota/comando/log/data>`.
- Nao remover IDs dos itens (ex.: `PUB-001`), eles servem para rastreabilidade.

---

## 1) Area Publica

### 1.1 Layout e navegacao publica
- [OK] PUB-001 Home (`/`) carrega sem erro bloqueante de console. | Evidencia: Playwright prod 2026-05-29, `consoleErrors=[]`, `pageErrors=[]`, `failedRequests=[]` em `https://www.mariana-explica.pt/`.
- [OK] PUB-002 Header publico aparece em desktop e mobile. | Evidencia: Playwright prod 2026-05-29, desktop `headerVisible=true` e mobile `headerVisible=true`.
- [OK] PUB-003 Footer publico aparece e exibe build discreto. | Evidencia: Playwright prod 2026-05-29, `footerVisible=true`, build exibido `bb41402`.
- [OK] PUB-004 Navbar publica mostra links principais esperados (`/materiais`, `/suporte`, login/conta). | Evidencia: Playwright prod 2026-05-29, links visiveis com `href` `/materiais`, `/suporte`, `/login`.
- [OK] PUB-005 `CookieConsentBanner` funciona sem quebrar navegacao. | Evidencia: Playwright prod 2026-05-29, banner visivel, acao `Aceitar cookies` fecha banner e navegacao para `/materiais` permanece funcional.
- [OK] PUB-006 Gate de manutencao publica respeita configuracao do site. | Evidencia: Playwright prod 2026-05-29, `site_maintenance_mode.enabled=false` retornado pela API publica e home renderizada fora da tela de manutencao.

### 1.2 Catalogo e pagina de material
- [OK] PUB-010 Catalogo (`/materiais`) lista materiais publicados. | Evidencia: Playwright prod 2026-05-29, API publica retornou `3` produtos publicados e `3` cards renderizados em `/materiais`.
- [OK] PUB-011 Busca no catalogo filtra por titulo/descricao/tipo. | Evidencia: Playwright prod 2026-05-29, filtros por `title=sebenta`, `description=teste`, `type=free` com contagens visiveis coerentes com os dados retornados pela API.
- [OK] PUB-012 Filtros rapidos do catalogo funcionam. | Evidencia: Playwright prod 2026-05-29, clique em categoria gerou `?categoria=sebentas-individuais` e lista filtrada com `2` resultados esperados.
- [OK] PUB-013 Estado de loading do catalogo aparece corretamente. | Evidencia: Playwright prod 2026-05-29, atraso artificial de `3000ms` na chamada `/rest/v1/products` exibiu `A carregar catalogo...` durante o carregamento.
- [OK] PUB-014 Estado vazio do catalogo aparece corretamente. | Evidencia: Playwright prod 2026-05-29, busca `__sem_resultado_catalogo_20260529__` exibiu `Nenhum material encontrado`.
- [OK] PUB-015 Estado de erro do catalogo aparece corretamente. | Evidencia: Playwright prod 2026-05-29, resposta `500` artificial em `/rest/v1/products` exibiu `Falha ao carregar o catalogo` + acao de retry.
- [OK] PUB-016 Pagina de material (`/materiais/:slug`) carrega dados dinamicos. | Evidencia: Playwright prod 2026-05-29, `/materiais/sebenta-gramatica` consumiu payload dinamico (`payload_slug=sebenta-gramatica`) e renderizou conteudo da pagina.
- [OK] PUB-017 CTA da pagina de material aponta para checkout com slug correto. | Evidencia: Playwright prod 2026-05-29, CTA principal da pagina de material com `href=/checkout?slug=sebenta-gramatica`.
- [OK] PUB-018 Reviews publicas renderizam sem quebrar o layout. | Evidencia: Playwright prod 2026-05-29, secao `Avaliacoes dos alunos` renderizada com estado valido (lista/empty) sem erro de console.
- [OK] PUB-019 Rotas legadas redirecionam corretamente (`/cursos*`, `/produtos*`, `/produto/:slug`). | Evidencia: Playwright prod 2026-05-29, redirecionamentos validados: `/cursos -> /materiais`, `/produtos -> /materiais`, `/cursos/sebenta-gramatica -> /materiais/sebenta-gramatica`, `/produto/sebenta-gramatica -> /materiais/sebenta-gramatica`.

### 1.3 Checkout e conversao
- [OK] PUB-030 Checkout (`/checkout?slug=...`) carrega resumo do material. | Evidencia: Playwright prod 2026-05-29, `/checkout?slug=c271877d-a354-4a6b-b8bf-6fc456d0e1e1` carregou com resumo do material (`title_visible=true`, `confirmacao=true`).
- [OK] PUB-031 Checkout de usuario deslogado redireciona para login com `redirect` preservado. | Evidencia: Playwright prod 2026-05-29, acesso deslogado em `/checkout/confirmacao?...mode=stripe&session_id=fake_session_1_3` redirecionou para `/login?redirect=<rota-original>`.
- [OK] PUB-032 Fluxo de produto gratuito conclui claim sem pagamento. | Evidencia: Playwright prod 2026-05-29, `claim-free-product` retornou `200` com `mode=free_claim`; nenhum request Stripe; fluxo finalizou em `/checkout/confirmacao?...mode=free`.
- [OK] PUB-033 Fluxo de produto pago redireciona para Stripe checkout URL. | Evidencia: Playwright prod 2026-05-29, `create-checkout` retornou `200` com `mode=stripe` e `checkout_url` Stripe; navegador navegou para `checkout.stripe.com`.
- [OK] PUB-034 Confirmacao (`/checkout/confirmacao`) exibe estado esperado. | Evidencia: Playwright prod 2026-05-29, rota `/checkout/confirmacao?...mode=free` exibiu heading `A tua inscricao foi recebida com sucesso`.
- [OK] PUB-035 Frontend nao confirma pagamento por conta propria (depende de backend/webhook). | Evidencia: Playwright prod 2026-05-29, em confirmacao com `session_id` fake o frontend chamou `checkout-autologin` (status `400`) e redirecionou para login, sem confirmar pagamento localmente.

### 1.4 Suporte publico e paginas institucionais
- [OK] PUB-040 Suporte (`/suporte`) carrega FAQ e busca. | Evidencia: Playwright prod 2026-05-29, `/suporte` com heading de suporte, `11` FAQs renderizadas e busca funcional (estado vazio exibido para termo sem resultado).
- [OK] PUB-041 CTA "Abrir chamado" do suporte aponta para `/aluno/chamados?openTicketModal=1&ticketStep=form`. | Evidencia: Playwright prod 2026-05-29, CTA visivel no suporte com `href=/aluno/chamados?openTicketModal=1&ticketStep=form`.
- [OK] PUB-042 Pagina `explicacoes` (`/explicacoes`) carrega sem erro. | Evidencia: Playwright prod 2026-05-29, `https://www.mariana-explica.pt/explicacoes` com `h1` renderizado, `console_errors=0` e `page_errors=0`.
- [OK] PUB-043 Pagina `sobre` (`/sobre`) carrega sem erro. | Evidencia: Playwright prod 2026-05-29, `https://www.mariana-explica.pt/sobre` com `h1` renderizado, `console_errors=0` e `page_errors=0`.
- [OK] PUB-044 Pagina `privacidade` (`/privacidade`) carrega sem erro. | Evidencia: Playwright prod 2026-05-29, `https://www.mariana-explica.pt/privacidade` com `h1` renderizado, `console_errors=0` e `page_errors=0`.
- [OK] PUB-045 Pagina `cookies` (`/cookies`) carrega sem erro. | Evidencia: Playwright prod 2026-05-29, `https://www.mariana-explica.pt/cookies` com `h1` renderizado, `console_errors=0` e `page_errors=0`.
- [OK] PUB-046 Pagina `termos-de-uso` (`/termos-de-uso`) carrega sem erro. | Evidencia: Playwright prod 2026-05-29, `https://www.mariana-explica.pt/termos-de-uso` com `h1` renderizado, `console_errors=0` e `page_errors=0`.

---

## 2) Autenticacao e Sessao

- [OK] AUTH-001 Login (`/login`) autentica usuario valido. | Evidencia: Playwright prod 2026-05-29, login de usuario ativo redirecionou para `https://www.mariana-explica.pt/aluno/dashboard`.
- [OK] AUTH-002 Cadastro (`/register` e `/criar-conta`) cria usuario conforme fluxo. | Evidencia: Playwright prod 2026-05-29, fluxos `/register` e `/criar-conta` concluíram com estado `pending_verification` para emails unicos de teste.
- [OK] AUTH-003 Callback (`/auth/callback`) conclui sessao sem loop. | Evidencia: Playwright prod 2026-05-29, magic link finalizou em `/aluno/dashboard` com `callback_hits=2` (sem loop persistente).
- [OK] AUTH-004 Recuperacao (`/recuperar-senha`) inicia fluxo corretamente. | Evidencia: Playwright prod 2026-05-29, rota abriu fluxo e exibiu mensagem de envio de email de recuperacao para usuario valido.
- [OK] AUTH-005 Redefinicao (`/redefinir-senha`) atualiza senha com token valido. | Evidencia: Playwright prod 2026-05-29, recovery link valido permitiu redefinir senha e concluir em `/aluno/dashboard`.
- [OK] AUTH-006 Rotas privadas sem sessao redirecionam para login. | Evidencia: Playwright prod 2026-05-29, acesso anonimo em `/aluno/dashboard` redirecionou para `/login`.
- [OK] AUTH-007 Rotas admin exigem role admin/is_admin. | Evidencia: Playwright prod 2026-05-29, anonimo `/admin -> /login`, aluno `/admin -> /`, admin ativo acessou `/admin`.
- [OK] AUTH-008 Sessao expirada invalida acesso privado de forma consistente. | Evidencia: Playwright prod 2026-05-29, sessao adulterada/expirada redirecionou de `/aluno/dashboard` para `/login`.
- [OK] AUTH-009 Logout limpa contexto privado e impede acesso por cache visual antigo. | Evidencia: Playwright prod 2026-05-29, apos logout em area privada, navegacao `voltar` manteve bloqueio e retornou para `/login`.

---

## 3) Area do Aluno (`/aluno`)

### 3.1 Dashboard e conta
- [OK] ALU-001 Dashboard (`/aluno/dashboard`) carrega dados do usuario. | Evidencia: Playwright prod 2026-05-29, login de aluno ativo carregou `/aluno/dashboard` com dados reais e material próprio (`QA ALU31 Material A 1780067157969`).
- [OK] ALU-002 Cursos (`/aluno/cursos`) lista apenas acessos permitidos. | Evidencia: Playwright prod 2026-05-29, `/aluno/cursos` exibiu somente material com grant do próprio aluno (`QA ALU31 Material A 1780067157969`) e ocultou material de outro usuário (`QA ALU31 Material B 1780067157969`).
- [OK] ALU-003 Detalhe de curso (`/aluno/cursos/:courseId`) respeita grant/acesso. | Evidencia: Playwright prod 2026-05-29, detalhe de curso com grant abriu normalmente e curso sem grant em `/aluno/cursos/02288fe7-25b8-4624-8bc9-71a07ceba8d3` retornou estado de bloqueio/indisponibilidade sem vazamento de conteúdo.
- [OK] ALU-004 Perfil (`/aluno/perfil`) atualiza dados permitidos. | Evidencia: Playwright prod 2026-05-29, alteração via UI persistiu `full_name`, `phone` e `nif`; validação backend confirmou preservação de `role=student` e `is_admin=false`.
- [OK] ALU-005 Pagamentos (`/aluno/pagamentos`) exibe historico do proprio usuario. | Evidencia: Playwright prod 2026-05-29, página mostrou somente pedido pago do próprio aluno (`QA ALU31 Material A 1780067157969`) e não exibiu pedido de outro usuário.
- [OK] ALU-006 Downloads (`/aluno/downloads`) mostra apenas arquivos liberados. | Evidencia: Playwright prod 2026-05-29, página exibiu apenas asset com `allow_download=true` do aluno, ocultou asset bloqueado (`allow_download=false`) e asset de outro usuário.
- [OK] ALU-007 Notificacoes (`/aluno/notificacoes`) lista e marca leitura corretamente. | Evidencia: Playwright prod 2026-05-29, listagem mostrou somente notificação própria e ação `Marcar como lida` atualizou status para `read` no banco sem afetar notificação de outro usuário.

### 4.5.2 Testes sugeridos - BLK-PRECOS
- [OK] ALU-010 Chamados (`/aluno/chamados`) lista tickets do proprio usuario. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-support-prod-check.mjs`), listagem exibiu apenas ticket proprio (`QA ALU-010 proprio 1780073051447`) e ocultou ticket de outro usuario.
- [OK] ALU-011 Criacao de ticket do aluno funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-support-prod-check.mjs`), criacao via UI redirecionou para `/aluno/chamados/4c964aa4-27f1-4428-81f0-066617a04ed5`.
- [OK] ALU-012 Detalhe de ticket (`/aluno/chamados/:ticketId`) mostra timeline correta. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-support-prod-check.mjs`), detalhe exibiu descricao inicial + resposta admin no historico.
- [OK] ALU-013 Resposta em ticket do aluno funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-support-prod-check.mjs`), resposta do aluno persistida em `support_ticket_messages` (`0486118b-1fea-48ec-89b4-0819e91a2de0`).

### 3.3 Player de curso e avaliacoes
- [OK] ALU-020 Player (`/aluno/cursos/:courseId/player`) abre sem erro. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-player-assessment-prod-check.mjs`), rota abriu e redirecionou para aula valida `/aluno/cursos/b1b68a31-ba38-4201-981f-f74903b71c9f/player/aulas/b4bcddec-0ecb-4f49-bfbc-6db5ba7f84ef`.
- [OK] ALU-021 Aula (`.../aulas/:lessonId`) carrega conteudo conforme permissao. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-player-assessment-prod-check.mjs`), aula com grant carregou conteudo e rota sem grant (`/aluno/cursos/6471d748-8d29-4a5b-9357-bddaa894c052/player/aulas/b003dad5-3f7a-4d38-8a4e-ad0d7942f50e`) ficou bloqueada.
- [OK] ALU-022 Materiais protegidos da aula exigem autorizacao backend. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-player-assessment-prod-check.mjs`), acesso autorizado chamou `generate-asset-access` com `200`; tentativa sem grant para asset `930b94e2-f509-41d3-a4de-38e322d540b7` foi negada pelo backend.
- [OK] ALU-023 Avaliacao (`.../avaliacoes/:assessmentId`) inicia/finaliza tentativa com persistencia oficial. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-player-assessment-prod-check.mjs`), tentativa oficial persistida em `assessment_attempts` (`bf44b657-c8a6-4674-a9f5-476843a992b3`) com status `failed` apos submissao.
- [OK] ALU-024 Redirecionamentos legados de `/dashboard/*` para `/aluno/*` funcionam. | Evidencia: Playwright prod 2026-05-29 (`scripts/student-player-assessment-prod-check.mjs`), redirects validados: `/dashboard->/aluno/dashboard`, `/dashboard/produtos->/aluno/cursos`, `/dashboard/produto/:id->/aluno/cursos/:id`, `/dashboard/downloads->/aluno/downloads`, `/dashboard/pagamentos->/aluno/pagamentos`, `/dashboard/perfil->/aluno/perfil`.

---

## 4) Area Admin (`/admin`)

### 4.1 Operacao geral
- [OK] ADM-001 Dashboard admin (`/admin`) carrega metricas principais. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-general-prod-check.mjs`), `/admin` carregou metricas principais (`Utilizadores=131`, `Materiais publicados=3`, `Pedidos pagos=10`, `Receita registada=78,00 EUR`).
- [OK] ADM-002 Navegacao admin so abre para usuario autorizado. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-general-prod-check.mjs`), anonimo `/admin -> /login`, aluno `/admin -> /`, admin ativo acessou `/admin`.
- [OK] ADM-003 Erros de modulo admin exibem estado de erro com retry. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-general-prod-check.mjs`), falha forcada nas 3 primeiras chamadas de `admin-dashboard` exibiu `Nao foi possivel carregar o admin` e `Tentar novamente` recuperou o dashboard.

### 4.2 Usuarios
- [OK] ADM-010 Usuarios (`/admin/usuarios`) lista usuarios. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), `/admin/usuarios` carregou com `143` linhas e admin QA visivel na tabela.
- [OK] ADM-011 Criacao de usuario por admin funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), criacao via UI concluida para `qa.adm42.user.1780079463209@example.com` com `profile.role=student` e `profile.status=active`.
- [OK] ADM-012 Edicao de usuario (nome/email/status/role) funciona com validacao backend. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), edicao via UI atualizou nome/email/role para `qa.adm42.user.updated.1780079463209@example.com` (`role=affiliate`) e backend rejeitou role invalida com `status 400`.
- [OK] ADM-013 Bloqueio/desbloqueio de usuario funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), status `blocked` aplicado; acesso privado bloqueado e, apos retorno para `active`, acesso privado voltou a funcionar.
- [OK] ADM-014 Reset de senha por admin funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), senha antiga falhou apos reset e nova senha autenticou com sucesso.
- [OK] ADM-015 Regras de seguranca em usuario sensivel (evitar autoexclusao/perda admin) estao ativas. | Evidencia: Playwright+API prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), backend bloqueou autoexclusao (`403`) e auto-rebaixamento de admin (`403`).
- [OK] ADM-016 Acoes sensiveis em usuarios geram trilha de auditoria. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-users-prod-check.mjs`), `audit_logs` registrou `admin.user_created`, `admin.user_updated` e `admin.user_password_reset` para actor admin de QA e entity do usuario alvo.

### 4.3 Materiais/cursos e construtor
- [OK] ADM-020 Materiais (`/admin/cursos`) lista cursos e status. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), `/admin/cursos` carregou com `5` cards e status visiveis (Publicado/Rascunho/Arquivado).
- [OK] ADM-021 Criacao de material funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), criacao via UI concluiu em `/admin/cursos/b60cb386-293d-4f1b-8d7f-0a422985b532/builder`.
- [OK] ADM-022 Edicao basica de material funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), `/builder/settings` atualizou titulo/preco para `QA ADM43 Material A Atualizado 1780086737974` e `12.34 EUR` com persistencia no banco.
- [OK] ADM-023 Exclusao de material funciona com confirmacao. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), exclusao com confirmacao removeu `QA ADM43 Excluir 1780086737974` e o registro deixou de existir no banco.
- [OK] ADM-024 Reordenacao de materiais (drag and drop) funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), drag and drop alterou ordem visual (`4/5 -> 5/4`) e persistiu `sort_order`.
- [OK] ADM-025 Importacao JSON de material funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), importacao JSON criou material `e4f2476c-eadd-4465-8181-926bfb68c510` com titulo/slug importados e estrutura inicial (`1` modulo, `0` aulas, `0` avaliacoes).
- [OK] ADM-026 Exportacao JSON de material funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), exportacao gerou `qa-adm43-importado-1780086737974.json` com titulo esperado.
- [OK] ADM-027 Aba de categorias em `/admin/cursos?tab=categorias` funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), aba abriu painel de categorias com metricas e formulario.
- [OK] ADM-028 Alunos do curso (`/admin/cursos/:courseId/alunos`) carrega listagem. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), rota `/admin/cursos/b60cb386-293d-4f1b-8d7f-0a422985b532/alunos` carregou e listou aluno ativo.
- [OK] ADM-029 Preview do curso (`/admin/cursos/:courseId/builder/preview`) carrega. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), preview em `/admin/cursos/e4f2476c-eadd-4465-8181-926bfb68c510/builder/preview` carregou sem erro.
- [OK] ADM-030 Builder (`/admin/cursos/:courseId/builder`) abre sem erro. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), builder abriu em `/admin/cursos/b60cb386-293d-4f1b-8d7f-0a422985b532/builder`.
- [OK] ADM-031 Builder `settings` salva configuracoes. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), `has_linear_progression=true` persistido apos save em `/builder/settings`.
- [OK] ADM-032 Builder `pagina-publica` salva/atualiza conteudo. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), headline `QA Headline ADM43 1780086737974` persistida em `public_page_content`.
- [OK] ADM-033 Builder `releases` aplica regras de liberacao. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), grant `8b0398e9-cf7c-4be8-a305-ed9d8a76ae5f` concedido e revogado com sucesso.
- [OK] ADM-034 Builder `assessments` funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), criacao de quiz de modulo `QA ADM43 Quiz 1780086737974` (`d97a3688-28b9-4a3d-984a-2834119b7d58`).
- [OK] ADM-035 Builder `assessments/final` funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), workspace final abriu e manteve `1` avaliacao final ativa.
- [OK] ADM-036 Builder modulo (`modulos/:moduleId`) funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), salvou alteracoes no modulo `00bb0346-ebe0-4177-a982-fd5a2cdb4dac`.
- [OK] ADM-037 Builder aula (`modulos/:moduleId/aulas/:lessonId`) funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), salvou alteracoes na aula `042a5135-5246-4c8a-a14d-8a936beac671`.
- [OK] ADM-038 Builder materiais de aula (`.../materiais`) funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), criou material de aula `271b1143-0165-4d58-9199-2756beb376d2`.
- [OK] ADM-039 Builder avaliacao de modulo (`.../avaliacoes/:assessmentId`) funciona. | Evidencia: Playwright prod 2026-05-29 (`scripts/admin-courses-builder-prod-check.mjs`), rota profunda abriu em `/builder/modulos/00bb0346-ebe0-4177-a982-fd5a2cdb4dac/avaliacoes/d97a3688-28b9-4a3d-984a-2834119b7d58`.

### 4.4 Financeiro, pedidos e pagamentos
- [ ] ADM-050 Pagamentos (`/admin/pagamentos`) lista pedidos e filtros.
- [ ] ADM-051 Reconciliacao de pedido funciona.
- [ ] ADM-052 Acao "marcar como pago" sincroniza acesso.
- [ ] ADM-053 Acao "reembolsar" revoga acesso conforme regra.
- [ ] ADM-054 Acao "cancelar pedido" funciona para pendentes.
- [ ] ADM-055 Mudanca de modo checkout (sandbox/producao) funciona e persiste.

### 4.5 Comunicacao, conteudo e operacao
- [ ] ADM-060 Suporte (`/admin/suporte`) lista tickets.
- [ ] ADM-061 Detalhe de ticket admin (`/admin/suporte/:ticketId`) responde e atualiza status.
- [ ] ADM-062 Formularios publicos (`/admin/formularios`) lista envios.
- [ ] ADM-063 FAQ (`/admin/perguntas-frequentes`) CRUD funcional.
- [ ] ADM-064 Reviews (`/admin/reviews`) moderacao funcional.
- [ ] ADM-065 Notificacoes (`/admin/notificacoes`) envio/listagem funcional.
- [ ] ADM-066 Afiliados (`/admin/afiliados`) operacao funcional.
- [ ] ADM-067 Cupons (`/admin/cupons`) operacao funcional.
- [ ] ADM-068 Editor de paginas (`/admin/editor-paginas`) abre, edita e publica.
- [ ] ADM-069 Minha conta admin (`/admin/minha-conta`) atualiza dados permitidos.

### 4.6 Configuracoes e operacoes internas
- [ ] ADM-080 Configuracoes (`/admin/configuracoes`) aba Branding funciona.
- [ ] ADM-081 Configuracoes (`/admin/configuracoes?tab=rastreamento`) funciona.
- [ ] ADM-082 Configuracoes (`/admin/configuracoes?tab=manutencao`) ativa/desativa modo manutencao.
- [ ] ADM-083 Configuracoes (`/admin/configuracoes?tab=operacoes`) mostra modulo operacional embutido.
- [ ] ADM-084 Operacoes: scheduler de crons carrega status.
- [ ] ADM-085 Operacoes: acao "reagendar crons" funciona.
- [ ] ADM-086 Operacoes: acao "testar fila de email" funciona.
- [ ] ADM-087 Operacoes: acao "executar todos os crons" funciona.
- [ ] ADM-088 Operacoes: lista de emails possui paginacao e retry.
- [ ] ADM-089 Operacoes: historico de jobs possui paginacao e status.

---

## 5) Edge Functions e Backend Serverless

### 5.1 Fluxos publicos e aluno
- [ ] API-001 `create-checkout` valida payload e cria sessao de checkout.
- [ ] API-002 `checkout-autologin` funciona no fluxo de retorno autenticado.
- [ ] API-003 `claim-free-product` cria grant sem duplicidade.
- [ ] API-004 `generate-asset-access` gera acesso assinado com validacao de permissao.
- [ ] API-005 `generate-module-pdf-access` protege PDFs de modulo.
- [ ] API-006 `create-support-ticket` cria ticket.
- [ ] API-007 `support-ticket-reply` registra resposta autorizada.
- [ ] API-008 `support-attachment-upload` aceita upload autorizado.
- [ ] API-009 `support-attachment-access` entrega anexo autorizado.
- [ ] API-010 `student-course-navigation` respeita regras de progressao.
- [ ] API-011 `student-assessment-attempts` persiste tentativas de avaliacao.
- [ ] API-012 `student-order-actions` executa acoes permitidas ao aluno.
- [ ] API-013 `profile-avatar-upload` upload de avatar funciona.

### 5.2 Pagamentos, pedidos e reconciliacao
- [ ] API-020 `payment-webhook` valida assinatura e processa eventos idempotentes.
- [ ] API-021 `reconcile-orders` reconcilia pedidos sem duplicar efeitos.
- [ ] API-022 `cron-reconcile-orders` executa reconciliacao automatica.
- [ ] API-023 `admin-orders` e `admin-orders-view` respondem com filtros e seguranca.
- [ ] API-024 `admin-payments-status` retorna estado operacional do checkout.
- [ ] API-025 `admin-checkout-mode` atualiza modo sandbox/producao com rastreabilidade.

### 5.3 Admin operacional e conteudo
- [ ] API-030 `admin-dashboard` retorna dados para painel admin.
- [ ] API-031 `admin-users` valida role admin e protege operacoes sensiveis.
- [ ] API-032 `admin-products` valida e persiste CRUD de produtos.
- [ ] API-033 `admin-content` opera conteudo de curso com permissao admin.
- [ ] API-034 `admin-course-releases` aplica regras de release e grants.
- [ ] API-035 `admin-coupons` valida regras de cupom no backend.
- [ ] API-036 `admin-affiliates` aplica regras de afiliacao/comissao.
- [ ] API-037 `admin-create-review` e `moderate-review` funcionam.
- [ ] API-038 FAQ admin (via policies/queries/funcoes de apoio) responde com permissao correta.
- [ ] API-039 `admin-notifications` executa envios e logs.
- [ ] API-040 `admin-public-forms` lista e opera submissions.
- [ ] API-041 `admin-page-builder` e `admin-page-assets` funcionam com controle admin.
- [ ] API-042 `admin-storage-upload` protege upload administrativo.
- [ ] API-043 `admin-operations` responde estado de fila/jobs/crons.
- [ ] API-044 `admin-cron-scheduler` gerencia scheduler com seguranca.
- [ ] API-045 `admin-email-status` fornece visibilidade da fila de email.
- [ ] API-046 `admin-support-ticket-delete` aplica regra de exclusao com auditoria.

### 5.4 Funcoes de cron e apoio
- [ ] API-050 `cron-process-email-deliveries` processa fila de emails.
- [ ] API-051 `cron-retry-email-deliveries` reenfileira falhas com seguranca.
- [ ] API-052 `cron-audit-access-consistency` audita consistencia de grants.
- [ ] API-053 `cron-clean-expired-links` limpa links expirados.
- [ ] API-054 `public-form-submit` registra formulario publico com validacao.
- [ ] API-055 `create-review` e `helpful-vote` funcionam no fluxo publico autenticado.

---

## 6) Banco de Dados, RLS e Regra Critica

- [ ] SEC-001 `access_grants` e a fonte real de autorizacao ao conteudo.
- [ ] SEC-002 `orders` representam estado comercial, nao autorizacao final.
- [ ] SEC-003 Grants ativos sao criados/revogados por backend (nao frontend).
- [ ] SEC-004 Tabelas privadas criticas estao com RLS ativo.
- [ ] SEC-005 Policies impedem leitura de dados de outro usuario comum.
- [ ] SEC-006 Policies/admin permitem operacao admin sem abrir dados indevidos.
- [ ] SEC-007 Campos sensiveis de perfil (`role`, `is_admin`, `status`) nao sao autoelevaveis no cliente.
- [ ] SEC-008 Conteudo pago nao fica publico em storage.
- [ ] SEC-009 Assets protegidos usam URL assinada temporaria.
- [ ] SEC-010 Webhook e funcoes sensiveis registram logs suficientes para auditoria.
- [ ] SEC-011 Migrations SQL versionadas cobrem alteracoes estruturais (sem dependencia manual).
- [ ] SEC-012 Triggers/constraints principais evitam dados inconsistentes em pedidos, grants e status.

---

## 7) Integracoes Externas

- [ ] INT-001 Stripe checkout e iniciado no backend.
- [ ] INT-002 Stripe webhook valida assinatura antes de alterar estado interno.
- [ ] INT-003 Mapeamento de status Stripe -> `orders.status` esta consistente.
- [ ] INT-004 Reembolso na Stripe reflete revogacao de acesso conforme regra.
- [ ] INT-005 Tracking de afiliado e cupom e validado no backend.
- [ ] INT-006 Integracao de email e desacoplada (falha de email nao corrompe pedido/grant).
- [ ] INT-007 Tracking/analytics (GTM, Pixel, custom codes) respeita configuracao e consentimento.

---

## 8) PWA e Mobile

- [ ] PWA-001 `manifest.webmanifest` existe e esta valido.
- [ ] PWA-002 `sw.js`/service worker registra sem quebrar app.
- [ ] PWA-003 Tela offline funciona (`offline.html` ou equivalente).
- [ ] PWA-004 Prompt de instalacao aparece em contexto apropriado.
- [ ] PWA-005 Modo standalone preserva login/sessao/rotas privadas.
- [ ] PWA-006 Conteudo protegido nao fica exposto por cache indevido.
- [ ] PWA-007 Atualizacao de versao limpa cache antigo e evita UI quebrada.
- [ ] PWA-008 Fluxos criticos mobile (catalogo, checkout, dashboard, suporte) funcionam.

---

## 9) Build, Deploy e Observabilidade

- [ ] OPS-001 Build local passa sem erro bloqueante.
- [ ] OPS-002 Versao exibida no footer/admin/construtor corresponde ao build atual no formato `VERSAO-DEPLOY-COMMIT`, e a mensagem final do deploy traz a build completa para conferência.
- [ ] OPS-003 Logs de erros criticos sao rastreaveis (frontend + functions).
- [ ] OPS-004 Dominio/ambiente ativo aponta para deploy esperado.
- [ ] OPS-005 SHA/deploy de producao corresponde ao HEAD publicado.
- [ ] OPS-006 Smoke test pos-deploy cobre publico, auth, checkout, aluno e admin.

---

## 10) Registro de Ciclo de Validacao

- Ciclo:
- Ambiente:
- Responsavel:
- Data:
- Commit/SHA:
- Resultado geral:
- Modulos com NOK:
- Riscos/Pendencias:

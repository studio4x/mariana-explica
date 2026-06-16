# Especificacao do Editor com IA

Documento reescrito em 2026-06-16 a partir do estado real do codigo da build `1.0.0-106-header-spacing-routing`, commit `d09a69a700d3168b670d9be9452f91909f1d2e8e`.

## 1. Visao Geral

O Editor com IA e um sistema administrativo de edicao assistida que permite:

- conversar com um launcher flutuante no frontend;
- entender o pedido do admin em linguagem natural;
- decidir se o pedido precisa de esclarecimento, confirmacao ou proposta pronta;
- gerar um patch seguro para paginas publicas geridas por `site_page_versions`;
- aplicar o resultado em modo rascunho, abrir previa, publicar, desfazer ou restaurar revisoes;
- editar separadamente o texto global do header e do footer;
- registrar uso, custo estimado, auditoria e metadados tecnicos no backend.

Ele nao e um gerador livre de paginas. O sistema foi desenhado para alteracoes localizadas, com prioridade para:

- texto;
- tipografia;
- spacing pontual;
- pequenos ajustes de estilo;
- ajustes de alvo com confirmacao;
- preservacao de estrutura, CTAs, rotas, responsividade e comportamento funcional.

## 2. Snapshot Atual

### 2.1 Build documentada

- Build label: `1.0.0-106-header-spacing-routing`
- Commit: `d09a69a700d3168b670d9be9452f91909f1d2e8e`
- Data da documentacao: `2026-06-16`

### 2.2 Arquivos principais

Frontend:

- `src/components/common/SiteAiPageEditorLauncher.tsx`
- `src/components/common/SiteAiPageEditorLauncher.test.tsx`
- `src/pages/admin/AdminAiPageEditor.tsx`
- `src/lib/ai-page-editor.ts`
- `src/lib/ai-page-editor-response.ts`
- `src/lib/site-page-preview.ts`
- `src/services/admin.service.ts`
- `src/hooks/useAdmin.ts`
- `src/types/app.types.ts`

Backend:

- `supabase/functions/admin-ai-page-editor/index.ts`
- `supabase/functions/admin-ai-page-editor/conversation.ts`
- `supabase/functions/admin-ai-page-editor/spacing-intent.ts`
- `supabase/functions/admin-ai-page-editor/contract.ts`
- `supabase/functions/admin-ai-page-editor/safety.ts`
- `supabase/functions/admin-ai-page-editor/patch-engine.ts`
- `supabase/functions/admin-ai-page-editor/confirmed-intent.ts`
- `supabase/functions/admin-ai-page-editor/operational-state.ts`
- `supabase/functions/admin-ai-page-editor/proposal-guards.ts`

Banco e suporte:

- `public.site_config`
- `public.site_pages`
- `public.site_page_versions`
- `public.ai_page_editor_usage_events`
- `public.audit_logs`
- `vault.decrypted_secrets`

## 3. Objetivo de Produto

O objetivo operacional do editor hoje e:

- permitir ajustes pontuais por chat sem abrir o builder completo;
- manter uma conversa curta e nao tecnica com o admin;
- validar se o pedido e claro antes de gerar proposta;
- favorecer um fluxo deterministico quando o pedido confirmado bater com padroes conhecidos de spacing;
- bloquear sucesso falso quando nao houver diff real, previa valida ou base segura;
- separar claramente:
  - conversa de entendimento;
  - proposta pronta;
  - copia global de header/footer;
  - fluxo persistivel de draft/preview/publish;
  - telemetria e auditoria.

## 4. Arquitetura Atual

### 4.1 Visao em camadas

1. Frontend administrativo e layouts publicos/aluno montam o launcher.
2. O launcher recolhe contexto da rota atual, HTML atual, `layout_json`, `style_json`, anexos e estado conversacional.
3. O frontend envia pedidos para a Edge Function `admin-ai-page-editor`.
4. A Edge Function:
   - valida admin e rota;
   - seleciona a base segura da pagina;
   - processa entendimento conversacional;
   - gera proposta deterministica ou via provedor;
   - devolve estado operacional completo.
5. O frontend avalia se a proposta e aplicavel.
6. Quando aplicavel, o frontend salva draft via `admin-page-builder`, grava previa local e oferece:
   - confirmar publicacao;
   - desfazer;
   - restaurar revisao.

### 4.2 Onde o launcher aparece

O componente `SiteAiPageEditorLauncher` e montado em:

- `src/layouts/PublicLayout.tsx`
- `src/layouts/DashboardLayout.tsx`
- `src/pages/student/StudentCoursePlayerLayout.tsx`

Isso significa que o launcher pode aparecer em areas publicas e privadas, mas a renderizacao continua condicionada por:

- usuario autenticado;
- `isAdmin === true`;
- rota suportada;
- rota permitida em configuracao;
- editor habilitado.

### 4.3 Tela administrativa dedicada

A tela `src/pages/admin/AdminAiPageEditor.tsx` existe para:

- ativar/desativar o editor;
- definir `launcher_label`;
- selecionar rotas permitidas;
- escolher provedor principal e fallback;
- configurar modelos Gemini/OpenAI;
- configurar quantidade e tamanho maximo de anexos;
- editar o `base_prompt`;
- controlar `require_confirmation`;
- escolher `panel_width`;
- guardar chaves Gemini/OpenAI;
- testar provedores;
- visualizar metricas e eventos recentes.

## 5. Rotas Suportadas

As rotas padrao vivem em `AI_PAGE_EDITOR_ROUTE_OPTIONS` em `src/lib/ai-page-editor.ts`.

### 5.1 Rotas com fluxo persistivel

Estas rotas possuem `slug` conhecido e participam do fluxo de draft/preview/publish:

- `/` -> `home`
- `/sobre` -> `sobre`
- `/privacidade` -> `privacidade`
- `/cookies` -> `cookies`
- `/termos-de-uso` -> `termos`

### 5.2 Rotas somente de contexto

Estas rotas podem aparecer na configuracao e no launcher, mas hoje nao entram no fluxo persistivel de patch publicado:

- `/aluno/dashboard`
- `/aluno/cursos`
- `/aluno/cursos/:courseId`
- `/aluno/cursos/:courseId/player/*`
- `/aluno/downloads`
- `/aluno/pagamentos`
- `/aluno/notificacoes`
- `/aluno/chamados`
- `/aluno/perfil`

### 5.3 Modos internos de capacidade

`getAiPageEditorRouteCapability(pathname)` classifica a rota em:

- `managed_site_page`
- `context_only`

E devolve:

- `routeOption`
- `supportsPersistibleFlow`
- `mode`
- `reason`

Quando `supportsPersistibleFlow === false`, o launcher informa que o fluxo seguro com draft/preview/publish esta restrito a paginas publicas com slug conhecido.

## 6. Configuracao e Segredos

### 6.1 Chave de configuracao

O editor usa:

```sql
public.site_config.config_key = 'ai_page_editor_config'
```

### 6.2 Estrutura atual de `config_value`

```json
{
  "enabled": false,
  "launcher_label": "Editar com IA",
  "allowed_paths": ["/", "/sobre", "/privacidade", "/cookies", "/termos-de-uso"],
  "primary_provider": "openai",
  "fallback_provider": "gemini",
  "gemini_model": "gemini-2.0-flash",
  "openai_model": "gpt-4.1-mini",
  "max_attachments": 2,
  "max_attachment_size_mb": 8,
  "base_prompt": "",
  "require_confirmation": true,
  "panel_width": "wide"
}
```

### 6.3 Normalizacao aplicada no backend

`normalizeConfigValue(raw)` em `index.ts` aplica:

- `enabled`: so fica `true` quando o valor recebido e explicitamente `true`;
- `launcher_label`: fallback para `Editar com IA`;
- `allowed_paths`: array de strings normalizadas;
- `primary_provider`: `gemini` ou `openai`;
- `fallback_provider`: `gemini` ou `openai`, com fallback pratico para `openai` quando o valor nao e `gemini`;
- `gemini_model`: fallback `gemini-2.0-flash`;
- `openai_model`: fallback `gpt-4.1-mini`;
- `max_attachments`: clamp entre `0` e `6`;
- `max_attachment_size_mb`: clamp entre `1` e `20`;
- `base_prompt`: string;
- `require_confirmation`: `true` por padrao;
- `panel_width`: `compact` ou `wide`.

### 6.4 Segredos

Segredos usados:

- `mariana_explica_ai_gemini_api_key`
- `mariana_explica_ai_openai_api_key`

Regras:

- os valores reais nao voltam para o frontend;
- o frontend recebe apenas `gemini_api_key_present` e `openai_api_key_present`;
- escrita e leitura sao feitas pelo backend com Vault.

## 7. Provedores e Modelos

### 7.1 Provedores suportados

- Gemini
- OpenAI

### 7.2 Modelos padrao

- Gemini: `gemini-2.0-flash`
- OpenAI: `gpt-4.1-mini`

### 7.3 Ordem de execucao

Sempre que ha geracao por LLM:

1. tenta o provedor principal configurado;
2. se faltar chave ou houver erro, tenta o fallback;
3. acumula falhas por provedor;
4. retorna erro consolidado se nenhum responder.

### 7.4 Teste de provedores

A action `test_providers`:

- testa os provedores na ordem configurada;
- devolve `provider_results`;
- classifica cada provedor como:
  - `ok`
  - `missing_key`
  - `quota_exceeded`
  - `error`
- grava evento de uso quando houver resposta com tokens;
- grava auditoria `admin.ai_page_editor_provider_tested`.

## 8. Tipos e Contratos Principais

### 8.1 Escopos

`AdminAiPageEditorScope`:

- `text`
- `block`
- `section`
- `page`
- `header`
- `footer`

### 8.2 Modos

`AdminAiPageEditorMode`:

- `text_patch`
- `style_patch`
- `spacing_patch`
- `section_layout_patch`
- `section_replace`

### 8.3 Tipos de operacao

`AdminAiPageEditorOperationType`:

- `set_style`
- `remove_style`
- `update_text`
- `move_node`
- `replace_section`
- `set_responsive_rule`
- `wrap_children`
- `unwrap_children`
- `change_columns`

### 8.4 Breakpoints

- `mobile`
- `tablet`
- `desktop`
- `all`

### 8.5 Status finais

`AdminAiPageEditorFinalStatus`:

- `needs_clarification`
- `awaiting_intent_confirmation`
- `proposal_ready`
- `draft_saved`
- `no_visible_change`
- `blocked`
- `error`

### 8.6 Fases conversacionais

`AdminAiPageEditorConversationPhase`:

- `understanding`
- `needs_clarification`
- `awaiting_intent_confirmation`
- `ready_for_proposal`

### 8.7 Estrutura de `edit_plan`

```json
{
  "scope": "section",
  "mode": "spacing_patch",
  "target_ids": ["page_wrapper_spacing"],
  "risk_level": "low",
  "requires_strict_confirmation": true,
  "operations": [
    {
      "type": "set_style",
      "target_id": "page_wrapper_spacing",
      "path": "padding-top",
      "value": 0,
      "breakpoint": "all"
    }
  ]
}
```

### 8.8 Estrutura de resposta conversacional

`generate_proposal` devolve sempre estado operacional, mesmo quando ainda nao existe proposta final:

```json
{
  "success": true,
  "request_id": "string",
  "client_request_id": "string | null",
  "provider_used": "openai | gemini",
  "conversation_phase": "needs_clarification | awaiting_intent_confirmation | ready_for_proposal",
  "assistant_message": "string",
  "quick_replies": ["string"],
  "understanding_summary": "string | null",
  "confirmation_token": "string | null",
  "confirmation_consumed": true,
  "requires_user_confirmation": false,
  "can_generate_proposal": true,
  "warnings": ["string"],
  "summary": "string",
  "explanation": "string",
  "edit_plan": {},
  "proposal": {},
  "final_status": "proposal_ready",
  "change_detected": true,
  "draft_saved": false,
  "preview_available": true,
  "change_summary": {
    "layout_changed": true,
    "style_changed": true,
    "html_changed": false
  }
}
```

### 8.9 Metadados da proposta

`proposal.metadata` pode conter:

- `ai_contract_version`
- `ai_edit_plan`
- `base_version`
- `ai_invariants`

Campos relevantes dentro de `ai_invariants`:

- `target_resolutions`
- `spacing_diagnosis`
- `supports_persistible_flow`
- `scoped_patch`
- `preview_renderable`
- `desktop_renderable`
- `mobile_renderable`
- `context_source`
- `degraded_draft_bypassed`
- `context_selection_reason`
- `published_version_id`
- `latest_draft_id`
- `plan_source`
- `patch_engine_version`

## 9. Frontend: Launcher

### 9.1 Componente principal

`SiteAiPageEditorLauncher` e o centro do fluxo interativo.

Responsabilidades:

- descobrir a rota atual;
- decidir se o launcher pode renderizar;
- ler a pagina atual publica e o detalhe admin da pagina;
- compor o contexto atual do chat;
- gerir anexos, captura de area e token de previa;
- rotear pedidos de header/footer;
- chamar o backend para entendimento/proposta;
- avaliar se a proposta e aplicavel;
- salvar draft, publicar, desfazer e restaurar revisoes.

### 9.2 Renderizacao

O launcher so aparece quando:

- `isAdmin === true`;
- `authLoading === false`;
- `allowedPath === true`;
- a configuracao nao esta desativada.

### 9.3 Mensagem inicial do chat

O texto inicial informa que o sistema:

- ajusta texto, partes da pagina e areas globais;
- precisa que header/footer sejam mencionados explicitamente;
- aceita imagem colada ou captura de area;
- nao altera permissoes, pagamentos, RLS, integracoes ou segredos;
- tende a ser conservador em pedidos vagos;
- reinicia a conversa depois de uma alteracao concluida.

### 9.4 Estado interno relevante

O launcher mantem, entre outros:

- `message`
- `attachments`
- `proposal`
- `messages`
- `feedback`
- `sendStatus`
- `conversationPhase`
- `understandingSummary`
- `clarificationQuestionsCount`
- `lastQuickReplySelected`
- `confirmationToken`
- `awaitingImplementation`
- `pendingPublication`
- `postApplyDecision`
- `selectedRevisionId`
- estado de captura de area
- `activeClientRequestIdRef`

### 9.5 Captura de pagina e anexos

Suporta:

- `paste` de imagens;
- upload de imagem por input;
- recorte de area com `html2canvas`;
- armazenamento local dos anexos como `data_url`.

Limites:

- quantidade maxima vem de `config.config_value.max_attachments`;
- tamanho maximo por ficheiro vem de `max_attachment_size_mb`.

### 9.6 Preview local temporario

`src/lib/site-page-preview.ts` grava uma previa em `localStorage` com:

- prefixo `me:site-page-preview:`
- query param `builder-preview`
- TTL de 6 horas

O payload guarda:

- `slug`
- `html`
- `css`
- `summary`
- `explanation`
- `warnings`
- `editPlan`
- `baseVersion`
- `targetResolutions`
- `aiInvariants`
- `highlightSelectors`

## 10. Frontend: Ordem de Roteamento em `handleSend`

Quando o admin envia uma mensagem, o launcher segue esta ordem:

1. monta `conversationContext`;
2. cria `clientRequestId`;
3. detecta se a mensagem consome uma confirmacao simples pendente;
4. adiciona a mensagem ao chat;
5. aguarda um frame para estabilizar a UI;
6. tenta um dos branches abaixo.

### 10.1 Branch de header global

Executa somente se `messageStrictlyTargetsGlobalHeader(message)` devolver `true`.

Regra atual:

- nao basta mencionar `cabecalho/header`;
- o pedido precisa parecer explicitamente textual;
- pedidos visuais de spacing perto do header sao bloqueados desse branch.

O launcher usa `messageLooksLikeVisualSpacingRequest()` para evitar falsos positivos como:

- `entre o cabecalho e a primeira secao`
- `faixa branca entre o menu e a primeira secao`
- `espaco acima da primeira secao`

Se o branch de header roda:

- chama `generateAdminAiHeaderCopyProposal`;
- so considera sucesso quando o texto persistido muda de facto;
- atualiza `site_branding`;
- faz broadcast de branding;
- reinicia a conversa apos sucesso.

### 10.2 Branch de footer global

Fluxo analogo ao do header, usando:

- `generateAdminAiFooterCopyProposal`
- `footer_description`

### 10.3 Branch bloqueado por rota nao persistivel

Se a rota atual for `context_only`, o launcher devolve uma mensagem amigavel dizendo que o fluxo seguro de draft/preview/publicacao esta restrito a paginas publicas geridas por `site_page_versions`.

### 10.4 Branch principal de proposta de pagina

Quando a rota suporta persistencia:

- chama `generateAdminAiPageEditorProposal`;
- passa `clientRequestId`;
- envia `slug`, `title`, `path`, `message`;
- envia `currentLayoutJson`, `currentStyleJson`, `currentHtml`;
- envia anexos;
- envia `conversationContext`.

Protecoes relevantes:

- respostas stale sao ignoradas quando `client_request_id` nao bate;
- respostas stale tambem sao ignoradas quando `activeClientRequestIdRef` mudou;
- `blocked` e `error` limpam a fase conversacional local;
- `no_visible_change` remove a proposta da UI e mostra a mensagem padrao de no-op.

## 11. Frontend: Aplicacao da Proposta

### 11.1 Avaliacao local

O launcher usa `assessAiPageEditorProposal()` para decidir se a proposta:

- esta `ready`;
- precisa de `review`;
- ou esta `blocked`.

Essa avaliacao verifica:

- se a rota suporta persistencia;
- se `change_detected === true`;
- se `preview_available === true`;
- se existe `base_version`;
- se todos os targets foram resolvidos;
- se nao ha confidence baixa;
- se o resultado e renderizavel em preview, desktop e mobile;
- se ha operacoes semiassistidas (`move_node`, `wrap_children`, `unwrap_children`).

### 11.2 Guardar rascunho

`applyDraftFromProposal()`:

1. reavalia a proposta;
2. monta snapshot da versao atual;
3. salva draft via `saveAdminSitePageDraft`;
4. sincroniza cache local;
5. compara diff persistido real com `detectManagedPageOperationDiff()`;
6. grava previa local;
7. abre o token `builder-preview` na mesma rota.

O draft recebe metadata adicional:

- `editor: "ai-page-editor"`
- `source: provider_used`
- `updated_at`
- `ai_revision_kind: "proposal_apply"`

### 11.3 Confirmar alteracoes

`handleConfirmAppliedChanges()`:

- publica o draft via `publishMutation`;
- limpa preview local;
- refaz queries e conteudo atual;
- guarda `postApplyDecision`;
- mostra mensagem de sucesso.

### 11.4 Desfazer alteracao pendente

`handleUndoAppliedChanges()`:

- pega no snapshot anterior;
- salva um novo draft com esse estado;
- reabre a previa;
- atualiza cache;
- marca que a pagina voltou ao estado anterior.

### 11.5 Revisoes

O launcher permite:

- pre-visualizar qualquer revisao;
- cancelar a pre-visualizacao;
- definir a revisao escolhida como atual via `rollbackMutation`;
- restaurar uma revisao como novo draft.

## 12. Backend: Edge Function `admin-ai-page-editor`

### 12.1 Regras gerais

- action unica com `POST`;
- `requireAdmin(req)` em todas as actions;
- leitura do body via `readJsonBody<Body>()`;
- resposta sempre com `request_id`;
- auditoria via `writeAuditLog`;
- uso/custo via `recordUsageEvent`.

### 12.2 Actions suportadas

- `get_config`
- `update_config`
- `test_providers`
- `generate_proposal`
- `generate_header_copy`
- `generate_footer_copy`
- `get_usage_metrics`

### 12.3 `get_config`

Retorna:

- `config`
- `secret_status`

### 12.4 `update_config`

Recebe:

- `configValue`
- `geminiApiKey`
- `openaiApiKey`

E faz:

- normalizacao de `configValue`;
- escrita em `site_config`;
- escrita opcional das chaves no Vault;
- retorno da configuracao salva;
- retorno de `secret_status`;
- auditoria `admin.ai_page_editor_config_updated`.

### 12.5 `test_providers`

Retorna:

- `summary`
- `details`
- `provider_results`
- `secret_status`

### 12.6 `get_usage_metrics`

Normaliza `periodDays` entre `1` e `365` e devolve:

- `summary`
- `breakdown`
- `recent_events`
- `pricing_reference`

## 13. Backend: Pipeline de `generate_proposal`

### 13.1 Entradas obrigatorias

- `slug`
- `title`
- `path`
- `message`
- `currentLayoutJson`
- `currentStyleJson`
- `currentHtml`

Entradas adicionais:

- `attachments`
- `conversationContext`
- `client_request_id`

### 13.2 Validacoes iniciais

O backend:

- confirma que o editor esta ativo;
- confirma que a rota esta em `allowed_paths`;
- valida anexos:
  - `data_url` obrigatoria;
  - tamanho por anexo;
  - quantidade maxima;
- normaliza `conversationContext`.

### 13.3 Selecao da base segura

Para rotas publicas com slug conhecido, a function obtem:

- `publishedVersion`
- `latestDraft`

Depois chama `selectAiBaseVersion()` de `safety.ts`.

Essa escolha pode:

- usar `latest_draft`;
- usar `published_version`;
- ou retornar `none`.

`published_version` ganha prioridade quando o draft parecer degradado, por exemplo:

- versao mais antiga que a publicada;
- sem blocos geridos;
- com menos blocos que a publicada;
- com texto muito mais curto;
- sem texto suficiente para contexto.

O resultado segue com:

- `baseVersion`
- `baseVersionSource`
- `degradedDraftBypassed`
- `baseVersionSelectionReason`

### 13.4 Roteamento conversacional

O backend decide entre tres branches internos:

1. `understanding_turn`
2. `confirmed_intent_patch`
3. `provider_full_proposal`

O log dessa decisao fica em:

- `branch_selected`
- `confirmed_intent_scope`
- `fallback_reason`

## 14. Branch `understanding_turn`

Este branch roda quando o entendimento ainda nao foi confirmado.

### 14.1 Como a confirmacao e detectada

Usa:

- `isExplicitUnderstandingConfirmation()`
- `isExplicitUnderstandingRejection()`
- `buildUnderstandingConfirmationToken()`
- `matchesUnderstandingConfirmationToken()`

Uma confirmacao simples so vale quando:

- a fase recebida era `awaiting_intent_confirmation`;
- a mensagem e curta e afirmativa;
- o token bate, quando existe token.

### 14.2 O que o modelo de entendimento devolve

O entendimento trabalha com:

- `phase`
- `assistant_message`
- `understanding_summary`
- `quick_replies`
- `ambiguity_detected`

O sistema prompt obriga:

- linguagem nao tecnica;
- uma pergunta curta por vez quando faltar contexto;
- distincao entre:
  - espaco externo antes da primeira secao;
  - topo da primeira secao;
  - espaco interno da primeira secao;
  - header textual vs spacing visual.

### 14.3 Estados resultantes

Se a fase for:

- `needs_clarification`: o frontend recebe quick replies e volta a perguntar;
- `awaiting_intent_confirmation`: o frontend recebe `confirmation_token`;
- `ready_for_proposal`: nao deveria ser o estado principal desta etapa, mas e suportado pelo contrato conversacional.

## 15. Branch `confirmed_intent_patch`

Este branch e a maior diferenca do editor atual em relacao ao estado antigo.

### 15.1 Objetivo

Quando o pedido foi confirmado e bate com um conjunto conhecido de intents de spacing, o backend evita nova rodada cara de LLM e materializa uma proposta deterministica.

### 15.2 Modulo usado

`materializeConfirmedIntentProposal()` em `confirmed-intent.ts`.

### 15.3 Casos cobertos

O fluxo hoje esta centrado em spacing no topo da pagina e da primeira secao, incluindo os alvos:

- `page_wrapper_spacing`
- `first_section_spacing`
- `section_internal_spacing`

### 15.4 Distincao semantica atual

1. `page_wrapper_spacing`
   - espaco branco antes da primeira secao;
   - fora da primeira secao;
   - entre o header/menu e a primeira secao;
   - inicio da pagina;
   - antes do conteudo comecar.

2. `first_section_spacing`
   - topo da primeira secao;
   - topo da area da secao;
   - subir a faixa azul da primeira secao.

3. `section_internal_spacing`
   - dentro da primeira secao;
   - espaco interno;
   - padding interno da secao.

### 15.5 Regras fortes adicionadas

O sistema atual prioriza fluxo visual quando o pedido menciona:

- `espaco`
- `faixa branca`
- `distancia`
- `respiro`
- `intervalo visual`
- `entre`
- `acima`
- `inicio da pagina`

E nao permite que a palavra `cabecalho` sozinha puxe para header textual quando o pedido e claramente visual.

### 15.6 Resultado do branch

Quando o branch deterministico consegue gerar a proposta:

- `provider_used` fica no provedor principal configurado, mas sem consumo de tokens;
- `input_tokens`, `output_tokens` e `total_tokens` ficam `0`;
- `pricing_source` fica `deterministic_confirmed_intent`;
- `confirmation_consumed` fica `true`;
- `can_generate_proposal` fica `true`;
- `quick_replies` ficam vazias;
- o backend devolve proposta final com estado operacional completo.

Se a materializacao falhar:

- nao ha fallback textual antigo;
- o backend devolve erro amigavel de alvo;
- o frontend nao mistura recusa textual com `no_visible_change`.

## 16. Branch `provider_full_proposal`

Quando a intent confirmada nao e coberta pelo branch deterministico, o backend:

1. monta prompt com HTML atual, `layout_json`, `style_json`, anexos e contexto;
2. chama provedor principal/fallback;
3. faz parse do JSON retornado;
4. valida a proposta;
5. estabiliza o resultado para aplicacao segura;
6. calcula estado operacional;
7. devolve a proposta final.

## 17. Modulos Internos do Backend

### 17.1 `conversation.ts`

Responsabilidades:

- normalizar `conversationContext`;
- sanitizar texto e quick replies para remover termos tecnicos;
- gerar e validar token de confirmacao;
- detetar confirmacao e rejeicao explicitas.

Substituicoes de linguagem feitas por `sanitizeConversationText()` incluem:

- `padding` -> `espaco`
- `margin` -> `espaco`
- `wrapper` -> `bloco`
- `layout` -> `estrutura`
- `patch` -> `ajuste`
- `proposal` -> `ajuste`
- `css` -> `estilo`
- `dom` -> `pagina`

### 17.2 `spacing-intent.ts`

Centraliza a leitura semantica de spacing.

Helpers atuais:

- `isVisualSpacingIntent`
- `isHeaderAdjacentSpacingRequest`
- `isHeaderVisualSpacingRequest`
- `isExplicitHeaderTextEditRequest`
- `isPageStartSpacingRequest`
- `protectsSectionInternalSpacing`
- `wantsOnlyPageWrapperSpacing`
- `wantsOnlyFirstSectionSpacing`
- `wantsOnlySectionInternalSpacing`

Esse modulo e hoje a base comum para:

- classificacao heuristica;
- confirmed intent;
- distincao entre header textual e spacing visual.

### 17.3 `contract.ts`

Responsabilidades:

- normalizar o `edit_plan` vindo do modelo;
- preencher fallback heuristico quando nao houver plano explicito;
- classificar `scope`, `mode`, `risk_level` e operacoes;
- garantir `target_ids` e `breakpoint`.

O estado atual usa as versoes internas:

- `classifyScopeFromMessageV2`
- `classifyModeFromMessageV2`
- `buildFallbackTargetIdsV2`

Detalhes importantes:

- `quero mudar o texto do cabecalho` continua em `header` + `text_patch`;
- `faixa branca entre o menu e a primeira secao` vai para `page` + `spacing_patch`;
- o fallback target de spacing pode ser:
  - `page_wrapper_spacing`
  - `first_section_spacing`
  - `section_internal_spacing`
  - `global-header` quando o pedido e realmente spacing visual do header global.

### 17.4 `safety.ts`

Responsabilidades:

- decidir se o draft atual e seguro para ser base de contexto;
- comparar draft vs publicado;
- validar padroes de rotas permitidas;
- transformar a versao escolhida em `PatchEngineBaseVersion`.

### 17.5 `patch-engine.ts`

E o motor de patch seguro para paginas persistiveis.

Responsabilidades:

- extrair blocos do builder;
- gerar candidatos de alvo;
- pontuar candidatos;
- aplicar operacoes seguras em JSON e/ou CSS;
- resolver targets com confidence;
- gerar warnings e invariantes.

Tipos relevantes:

- `PatchEngineBaseVersion`
- `PatchEngineTargetResolution`
- `SpacingSourceDiagnosis`
- `RefinedSpacingPlanResult`

Restricoes de estilo importantes:

- bloqueia `script`, `url(`, `javascript:`, `expression(`, `@import`;
- bloqueia `position: fixed|absolute`;
- bloqueia `z-index`;
- bloqueia `transform`;
- restringe conjuntos seguros para:
  - `display`
  - `flex-direction`
  - `text-align`
  - alinhamentos
  - backgrounds
  - colors
  - borders
  - box-shadow
  - grid template

Alvos virtuais de spacing suportados pelo patch engine:

- `page_wrapper_spacing`
- `first_section_spacing`
- `section_internal_spacing`

Classes conhecidas para detectar spacing da primeira secao:

- `me-about-page`
- `me-home-section`
- `me-legal-page`

### 17.6 `refineSpacingEditPlanForKnownWrappers()`

Esse passo:

- detecta fontes reais de spacing no topo;
- produz `diagnosis`;
- escolhe os `target_ids` corretos;
- transforma o plano em `spacing_patch` seguro com `padding-top = 0`.

### 17.7 `confirmed-intent.ts`

Responsabilidades:

- reconstruir o texto-fonte confirmado;
- decidir o `ConfirmedSpacingScope`;
- gerar um `edit_plan` seed;
- refina-lo com o patch engine;
- aplicar o patch deterministico;
- produzir copia amigavel para o chat;
- gerar metadata completa com `ai_invariants`.

Scopes internos:

- `wrapper_only`
- `first_section_only`
- `section_internal_only`
- `wrapper_and_first_section`

### 17.8 `operational-state.ts`

Centraliza o calculo de estado operacional.

Para propostas persistiveis:

- `no_visible_change` quando nao ha diff;
- `blocked` quando nao ha previa renderizavel;
- `needs_clarification` quando faltam resolucoes ou ha confidence baixa;
- `awaiting_intent_confirmation` quando ha confidence intermediaria ou `requires_strict_confirmation`;
- `proposal_ready` quando tudo esta seguro.

Para header/footer textual:

- `proposal_ready` quando o texto mudou;
- `no_visible_change` quando nao mudou.

### 17.9 `proposal-guards.ts`

Ultima barreira antes de aceitar uma proposta como persistivel.

Garante existencia de:

- `summary`
- `explanation`
- `proposal`
- `slug`
- `title`
- `layout_json`
- `style_json`
- `metadata`
- `edit_plan` ou fallback permitido

## 18. Semantica Atual de Intencao

### 18.1 Header textual

Exemplos:

- `quero mudar o texto do cabecalho`
- `troca a mensagem do topo`
- `atualiza a chamada do header`

Resultado esperado:

- branch de `generate_header_copy`
- escopo `header`
- modo `text_patch`

### 18.2 Header visual spacing

A palavra `cabecalho` por si so nao significa texto.

Se vier junto com sinais visuais como:

- `espaco`
- `faixa branca`
- `distancia`
- `respiro`
- `entre`
- `acima`

o sistema tenta fluxo visual, nao textual.

### 18.3 `page_wrapper_spacing`

Exemplos:

- `antes da primeira secao`
- `acima da primeira secao`
- `espaco branco antes da area`
- `antes do conteudo comecar`
- `entre o cabecalho e a primeira secao`
- `faixa branca entre o menu e a primeira secao`

### 18.4 `first_section_spacing`

Exemplos:

- `topo da primeira secao`
- `no topo da primeira secao`
- `subir a faixa azul`

### 18.5 `section_internal_spacing`

Exemplos:

- `dentro da primeira secao`
- `espaco interno`
- `padding interno da secao`

### 18.6 Protecao explicita

Se o pedido disser:

- `manter o padding interno da secao`
- `sem mexer no espaco interno`

o backend respeita isso como sinal forte para nao tocar `section_internal_spacing`.

## 19. Estado Operacional e Mensagens

### 19.1 Mensagem padrao de no-op no frontend

Constante:

`AI_PAGE_EDITOR_NO_VISIBLE_CHANGE_MESSAGE`

Texto atual:

`Analisei a pagina, mas esta tentativa nao gerou nenhuma alteracao visivel. Vou precisar ajustar melhor o alvo.`

### 19.2 Regras atuais de coerencia

O sistema atual nao deve:

- devolver recusa textual antiga para casos visuais suportados;
- misturar `no_visible_change` com sucesso;
- misturar recusa textual de header com tentativa de patch visual;
- expor erros crus como `proposal is not defined`.

`normalizeAdminAiPageEditorError()` converte erros desse tipo numa mensagem amigavel de resposta incompleta do servidor.

## 20. Auditoria e Uso

### 20.1 Eventos de uso

Os eventos gravados em `ai_page_editor_usage_events` podem incluir:

- `action`
- `provider`
- `model`
- `slug`
- `path`
- `mode`
- `scope`
- `risk_level`
- `target_ids`
- `requires_strict_confirmation`
- `contract_version`
- `invariants`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost_usd`
- `request_id`
- `metadata`

### 20.2 Metadados frequentes

Os metadados de uso/auditoria costumam guardar:

- `attachment_count`
- `conversation_phase`
- `clarification_questions_count`
- `user_confirmed_understanding`
- `understanding_summary`
- `ambiguity_detected`
- `quick_reply_selected`
- `proposal_summary`
- `edit_plan_operation_count`
- `warning_count`
- `target_resolution_count`
- `require_confirmation`
- `pricing_source`
- `base_version_id`
- `base_version_number`
- `base_version_status`
- `context_source`
- `degraded_draft_bypassed`
- `context_selection_reason`
- `published_version_id`
- `latest_draft_id`
- `provider_failures`
- `final_status`
- `change_detected`
- `draft_saved`
- `preview_available`
- `change_summary`
- `branch_selected`
- `confirmed_intent_source_text`

### 20.3 Auditoria

Actions de auditoria relevantes:

- `admin.ai_page_editor_config_updated`
- `admin.ai_page_editor_provider_tested`
- `admin.ai_page_editor_proposal_generated`
- `admin.ai_page_editor_header_copy_generated`
- `admin.ai_page_editor_footer_copy_generated`

## 21. Testes Atuais

Arquivos de teste atuais do backend:

- `conversation.test.ts`
- `spacing-intent.test.ts`
- `contract.test.ts`
- `confirmed-intent.test.ts`
- `operational-state.test.ts`
- `proposal-guards.test.ts`
- `patch-engine.test.ts`
- `safety.test.ts`

Frontend:

- `SiteAiPageEditorLauncher.test.tsx`
- `ai-page-editor-response.test.ts`
- `ai-page-editor.test.ts`

Cobertura funcional relevante ja presente:

- fluxo de clarificacao;
- fluxo de confirmacao de entendimento;
- token de confirmacao;
- proposta pronta para previa;
- bloqueio de no-op;
- erros amigaveis;
- roteamento de header/footer;
- roteamento visual de spacing;
- distincao entre:
  - `page_wrapper_spacing`
  - `first_section_spacing`
  - `section_internal_spacing`
- protecao de spacing interno quando o pedido diz para manter;
- nao mistura entre recusa textual e `no_visible_change`;
- ignorar respostas stale por `client_request_id`.

## 22. Limites e Decisoes de Produto no Estado Atual

1. O fluxo persistivel completo continua restrito a paginas publicas com slug conhecido.
2. Rotas do aluno podem ser analisadas, mas nao entram no pipeline seguro de publicacao.
3. Header e footer globais sao tratados fora do fluxo de draft de pagina.
4. O branch deterministico de confirmed intent esta especializado em spacing conhecido, nao em toda a superficie do editor.
5. Operacoes semiassistidas ainda forcam avaliacao mais conservadora.
6. O frontend so oferece botao de previa quando o backend e a avaliacao local confirmam que ha diff real e previa segura.
7. O launcher foi explicitamente ajustado para nao confundir:
   - pedido de texto do cabecalho;
   - pedido de spacing entre header/menu e primeira secao.

## 23. Resumo Executivo da Estrutura Atual

Em termos praticos, o editor atual funciona assim:

1. O admin abre o launcher numa rota permitida.
2. O sistema tenta primeiro entender o pedido em linguagem natural.
3. Se o pedido ainda estiver ambiguo, faz pergunta curta.
4. Se o pedido estiver claro, pede confirmacao curta.
5. Depois da confirmacao:
   - se for um caso conhecido de spacing, gera patch deterministico;
   - caso contrario, chama o provedor IA para proposta completa.
6. O backend devolve proposta + estado operacional + metadados de alvo.
7. O frontend so habilita previa segura quando o resultado passa por todas as guardas.
8. O admin pode:
   - preparar previa;
   - confirmar;
   - desfazer;
   - restaurar revisao.
9. Header e footer globais continuam em fluxos dedicados.
10. Todo o caminho deixa rasto em uso, custo estimado e auditoria.

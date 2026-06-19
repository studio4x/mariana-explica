# ESPECIFICACAO DO EDITOR IA

## 1. Objetivo deste documento

Este documento descreve a estrutura **atual** do editor com IA da Mariana Explica com base na implementacao real em producao no repositorio.

Ele nao substitui os documentos canonicos do projeto. Em caso de conflito, continuam a prevalecer:

1. `docs/Estrutura Inicial/03-arquitetura.md`
2. `docs/Estrutura Inicial/05-backend-edge-functions.md`
3. `docs/Estrutura Inicial/06-frontend-estrutura.md`
4. `docs/Estrutura Inicial/10-autenticacao-seguranca.md`

Este arquivo existe para documentar com precisao:

- como o editor esta montado no frontend;
- como a Edge Function roteia a conversa e gera propostas;
- como funciona o fluxo seguro de draft, preview, publicacao e revisoes;
- como a captura visual identifica alvos reais da pagina;
- quais contratos, estados, guardrails e limites existem hoje.

---

## 2. Snapshot da implementacao

- Data de levantamento: `2026-06-19`
- Build de entrega auditada: `1.0.0-119-captured-target-materialization-hardening`
- Esta versao inclui endurecimentos para `text anchor`, baseline viva do DOM, blindagem extra da captura e persistencia forte de alvo resolvido por captura
- Arquivo de build: `build-info.ts`
- Escopo auditado:
  - `src/components/common/SiteAiPageEditorLauncher.tsx`
  - `src/pages/admin/AdminAiPageEditorScreen.tsx`
  - `src/lib/ai-page-editor.ts`
  - `src/lib/ai-page-editor-response.ts`
  - `src/lib/site-page-builder.ts`
  - `src/services/admin.service.ts`
  - `src/types/app.types.ts`
  - `supabase/functions/admin-ai-page-editor/*.ts`

Este documento reflete o editor como ele esta **agora**, nao como foi desenhado em iteracoes anteriores.

---

## 3. Visao geral funcional

O editor com IA e um sistema hibrido composto por:

- launcher conversacional embutido no site;
- configuracao e observabilidade no admin;
- Edge Function administrativa dedicada;
- geracao de propostas persistiveis para paginas publicas geridas;
- fluxos especiais para header global e footer global;
- captura visual de area com enriquecimento de DOM e contexto;
- mecanismos deterministicos para certos tipos de patch antes de recorrer a proposta ampla do modelo.

Na pratica, o editor trabalha em dois modos:

1. `managed_site_page`
   - usado quando a rota e publica, permitida e mapeavel para um slug gerido;
   - suporta draft, preview, publicacao, undo e revisoes.

2. `context_only`
   - usado em rotas privadas, sensiveis ou fora das rotas permitidas;
   - a conversa existe, mas o fluxo persistivel seguro fica bloqueado;
   - excecao importante: pedidos estritamente globais de header e footer ainda podem seguir pelo fluxo proprio.

---

## 4. Mapa de modulos

### 4.1 Frontend principal

- `src/components/common/SiteAiPageEditorLauncher.tsx`
  - launcher conversacional;
  - captura de area;
  - anexos;
  - chamada da Edge Function;
  - aplicacao de draft;
  - preview local;
  - publicacao;
  - undo;
  - navegacao entre revisoes.

- `src/lib/ai-page-editor.ts`
  - mapa de rotas do editor;
  - avaliacao de capacidade da rota;
  - heuristica para cair de draft degradado para `published_version`;
  - avaliacao local de propostas.

- `src/lib/ai-page-editor-response.ts`
  - validacao forte da resposta da Edge Function;
  - normalizacao de erros;
  - diff de estado gerido.

- `src/lib/site-page-builder.ts`
  - renderer HTML das paginas geridas;
  - emissao de atributos estaveis `data-*` usados pelo editor para resolver alvos.

- `src/services/admin.service.ts`
  - invocacao autenticada da Edge Function `admin-ai-page-editor`;
  - serializacao de payload;
  - timeout;
  - retries limitados para contencao de auth.

- `src/types/app.types.ts`
  - contratos de conversa;
  - contratos de proposta;
  - tipos de captura;
  - metadata de anexos;
  - estados pendentes.

### 4.2 Frontend administrativo

- `src/pages/admin/AdminAiPageEditorScreen.tsx`
  - configuracao funcional;
  - segredos;
  - custos e uso;
  - rotas permitidas;
  - escolha de provider/model por etapa.

### 4.3 Backend

- `supabase/functions/admin-ai-page-editor/index.ts`
  - ponto de entrada;
  - autenticacao admin;
  - roteamento por `action`;
  - pipeline completo de `generate_proposal`.

- Modulos de suporte relevantes:
  - `conversation.ts`
  - `contract.ts`
  - `operational-state.ts`
  - `route-capability.ts`
  - `page-bootstrap.ts`
  - `capture-target-resolution.ts`
  - `image-intent.ts`
  - `image-patch.ts`
  - `explicit-css-intent.ts`
  - `explicit-css-patch.ts`
  - `confirmed-intent.ts`
  - `localized-intent.ts`
  - `localized-patch.ts`
  - `patch-engine.ts`
  - `pre-resolved-target.ts`
  - `model-routing.ts`
  - `proposal-guards.ts`
  - `safety.ts`

---

## 5. Onde o launcher existe hoje

O componente `SiteAiPageEditorLauncher` esta montado em:

- `src/layouts/PublicLayout.tsx`
- `src/layouts/DashboardLayout.tsx`
- `src/pages/student/StudentCoursePlayerLayout.tsx`

Isto significa que o editor pode ser aberto:

- na area publica;
- em areas do aluno;
- no player do curso.

Mas disponibilidade visual nao significa capacidade persistivel total. O comportamento final depende da capacidade da rota.

---

## 6. Modelo de rotas do editor

O mapa principal esta em `AI_PAGE_EDITOR_ROUTE_OPTIONS` em `src/lib/ai-page-editor.ts`.

### 6.1 Rotas publicas geridas

Estas rotas possuem `slug` conhecido e podem participar do fluxo persistivel quando tambem estiverem em `allowed_paths`:

- `/` -> `home`
- `/sobre` -> `sobre`
- `/explicacoes` -> `explicacoes`
- `/materiais` -> `materiais`
- `/suporte` -> `suporte`
- `/privacidade` -> `privacidade`
- `/cookies` -> `cookies`
- `/termos-de-uso` -> `termos`

### 6.2 Rotas sensiveis

Estas rotas sao tratadas como sensiveis e nao entram no fluxo seguro de draft/preview/publicacao:

- `/login`
- `/criar-conta`
- `/checkout`
- `/checkout/confirmacao`
- `/materiais/:slug`

### 6.3 Rotas privadas/contextuais

Tambem existem opcoes conhecidas para a area do aluno, mas elas funcionam em modo contextual:

- `/aluno/dashboard`
- `/aluno/cursos`
- `/aluno/cursos/:courseId`
- `/aluno/cursos/:courseId/player/*`
- `/aluno/downloads`
- `/aluno/pagamentos`
- `/aluno/notificacoes`
- `/aluno/chamados`
- `/aluno/perfil`

### 6.4 Capacidade calculada por rota

O frontend devolve `AiPageEditorRouteCapability` com:

- `routeOption`
- `normalizedPath`
- `managedSlug`
- `routeIsAllowed`
- `routeIsPublic`
- `routeIsSensitive`
- `supportsPersistibleFlow`
- `mode`
- `reason`

Regras principais:

- `routeIsPublic` so e verdadeiro para paginas publicas nao sensiveis.
- `managedSlug` so existe para rotas publicas resolvidas.
- `supportsPersistibleFlow` exige:
  - rota publica;
  - rota permitida;
  - `managedSlug` resolvido.
- `mode` vira:
  - `managed_site_page` quando o fluxo persistivel e suportado;
  - `context_only` nos demais casos.

Mensagens de bloqueio ja sao produzidas por essa camada, por exemplo:

- rota privada/sensivel;
- rota ainda nao incluida em `allowed_paths`;
- caminho publico ainda nao preparado de forma segura.

---

## 7. Montagem do contexto persistivel da pagina

Quando a rota suporta fluxo persistivel, o editor opera sobre `site_pages` e `site_page_versions`.

### 7.1 Bootstrap de baseline

O backend usa `ensureManagedPageContext` em `page-bootstrap.ts` para:

- buscar `site_pages` pelo slug;
- criar a pagina se ainda nao existir;
- buscar versoes;
- criar a baseline `version_number = 1` se ainda nao houver versoes;
- recusar bootstrap sem contexto suficiente;
- recusar baseline incompleta.

Para uma baseline ser considerada completa, o backend exige essencialmente:

- blocos geridos em `layout_json`, e
- HTML base disponivel.

Se a baseline nao estiver segura, a funcao pode devolver a mensagem:

- `BASELINE_INCOMPLETE_MESSAGE`

### 7.2 Selecao da base de trabalho

O editor nao assume que o ultimo draft e sempre a melhor base.

Existe heuristica em `shouldUsePublishedVersionForAiContext` para preferir `published_version` quando o draft parece degradado, por exemplo:

- numero de blocos inferior ao publicado;
- ausencia de blocos onde o publicado tem estrutura;
- texto muito menor que o publicado;
- versao de draft atrasada numericamente.

No backend, o resultado dessa selecao e refletido em:

- `baseVersion`
- `baseVersionSource`
  - `latest_draft`
  - `published_version`
  - `none`
- `degradedDraftBypassed`
- `baseVersionSelectionReason`

Esses campos voltam tambem em `proposal.metadata.ai_invariants`.

### 7.3 Baseline viva enviada pelo frontend

Quando o launcher esta numa rota publica gerida, ele tambem tenta construir uma baseline efemera do DOM vivo atual via `buildLiveDomBaseline()`:

- gera `currentDomHtml` a partir de `getSanitizedDomSnapshot()`;
- converte esse HTML em documento builder com `convertLegacyHtmlToBuilderDocument(pageSlug)`;
- monta `currentDomLayoutJson`;
- monta `currentDomStyleJson` minimo para a raiz `.me-managed-page-root`.

Esse snapshot nao substitui a baseline persistida por padrao. Ele existe para:

- dar contexto real da pagina que o admin esta a ver naquele momento;
- reduzir falsos negativos quando `site_page_versions` estiver desatualizado face ao DOM vivo;
- permitir retry deterministico de patches localizados que dependem de texto visivel atual.

### 7.4 Fallback controlado para `request_live_dom_snapshot`

No backend, `index.ts` pode materializar um `requestSnapshotBaseVersion` efemero com `source = "request_live_dom_snapshot"` quando:

- `currentDomLayoutJson` chega no request;
- `currentDomStyleJson` chega no request;
- `currentDomHtml` chega no request;
- `assessBootstrapBaseline()` considera esse conjunto completo e seguro.

Esse base version efemero:

- recebe `id = "request-snapshot:<requestId>"`;
- reutiliza `page_id`, `version_number` e `status` de referencia;
- existe apenas para a materializacao daquela proposta;
- nao cria versao persistida por si so.

O uso principal hoje e destravar casos em que a baseline persistida ainda nao contem um texto visivel que ja esta no DOM atual.

---

## 8. Identidade estrutural do DOM gerido

O sistema de captura e resolucao de alvo depende de atributos estaveis emitidos pelo builder.

`src/lib/site-page-builder.ts` injeta:

### 8.1 No wrapper do bloco

- `data-block-id="<block.id>"`
- `data-block-type="<block.type>"`
- `data-managed-node-id="block:<block.id>"`
- `data-ai-editor-id="managed:<block.id>"`
- `data-section-index="<index>"`

### 8.2 No conteudo do bloco

- `data-parent-block-id="<block.id>"`
- `data-managed-node-id="content:<block.id>"`
- `data-ai-editor-id="managed:<block.id>:content"`
- `data-block-type="<block.type>"`

### 8.3 Root da pagina

O HTML gerido e envolvido por `.me-managed-page-root`.

Este conjunto de marcadores e a base para:

- localizar o alvo capturado no DOM atual;
- reconciliar o recorte visual com o layout persistido;
- produzir seletores seguros;
- reduzir o risco de alterar o elemento errado.

---

## 9. Estrutura conversacional do launcher

### 9.1 Mensagem inicial

Ao abrir, o launcher comeca com uma mensagem assistente que ja fixa:

- capacidade de ajustar texto, partes da pagina e areas globais;
- forma correta de pedir;
- uso de imagem colada;
- uso do botao `Capturar area`;
- limites de seguranca.

Os limites explicitados incluem:

- nao mexer em permissoes;
- nao mexer em pagamentos;
- nao mexer em RLS;
- nao mexer em integracoes;
- nao mexer em segredos.

### 9.2 Estado local relevante

O launcher mantem, entre outros:

- abertura/fecho do painel;
- mensagens da conversa;
- texto atual do composer;
- anexos;
- proposta atual;
- `awaitingImplementation`;
- `pendingPublication`;
- `postApplyDecision`;
- `conversationPhase`;
- `understandingSummary`;
- `clarificationQuestionsCount`;
- `confirmationToken`;
- `pendingImageInsert`;
- `pendingTargetClarification`;
- `selectedRevisionId`;
- estados de captura:
  - `isSelectingCaptureArea`
  - `captureStartPoint`
  - `captureRect`
  - `isCapturingPage`

### 9.3 Contexto de conversa enviado ao backend

`buildConversationContext()` envia:

- `phase`
- `understanding_summary`
- `clarification_questions_count`
- `quick_reply_selected`
- `confirmation_token`
- `pending_image_insert`
- `pending_target_clarification`
- ultimas mensagens relevantes `recent_messages`

O historico e intencionalmente curto. O launcher envia apenas a cauda recente da conversa.

Nesta versao, `pending_target_clarification` ja pode voltar do backend com `resolvedTarget` preenchido. O frontend preserva esse objeto e o reenvia no turno seguinte, em vez de depender apenas de `recent_messages` para reconstruir a captura.

### 9.4 Reset de sessao

`resetConversation()` limpa:

- mensagens e intro;
- campo de texto;
- anexos;
- proposta;
- pending preview/publication auxiliares;
- estados de confirmacao;
- captura;
- pendencias de imagem e clarificacao;
- revisao selecionada.

Depois de uma alteracao concluida, a conversa pode:

- continuar na mesma sessao, ou
- ser reiniciada numa nova sessao limpa.

---

## 10. Anexos e papeis de anexo

O editor hoje reconhece quatro papeis:

- `target_capture`
- `insert_image_asset`
- `reference_image`
- `unknown`

### 10.1 Metadata de anexo

Cada anexo pode transportar:

- `source`
  - `capture`
  - `upload`
  - `paste`
  - `link`
  - `unknown`
- `target_path`
- `target_slug`
- `capture_rect`
- `viewport`
- `target_capture`

O campo `target_capture` e novo e central na arquitetura atual.

### 10.2 Regras de frontend

- colar imagem no textarea cria anexo de imagem;
- upload tambem suporta inferencia de papel;
- se houver `pendingImageInsert` a tendencia e inferir `insert_image_asset`;
- se a mensagem parecer referencia visual, a tendencia e inferir `reference_image`.

### 10.3 Regras de backend

O backend valida:

- presenca de `data_url`;
- tamanho maximo por arquivo;
- numero maximo de anexos;
- papel permitido.

Os limites hoje sao configuraveis, mas normalizados no backend para:

- `max_attachments`: `0` a `6`
- `max_attachment_size_mb`: `1` a `20`

Defaults observados:

- `max_attachments = 2`
- `max_attachment_size_mb = 8`

Para o papel `target_capture`, o launcher nao deve limpar o anexo imediatamente depois de uma resposta intermediaria. A captura e mantida ate:

- o patch virar draft;
- o fluxo ser cancelado;
- ou a conversa ser reiniciada manualmente.

---

## 11. Captura visual de area

Esta e uma das principais diferencas entre a especificacao antiga e a implementacao atual.

### 11.1 Ativacao

O launcher possui o botao `Capturar area`.

Ao ativar:

- o painel fecha;
- o cursor muda para `crosshair`;
- a pagina entra em modo de selecao;
- `Esc` cancela.

### 11.2 Validacoes basicas

A captura falha se:

- o limite de anexos ja foi atingido;
- a area for pequena demais;
- `html2canvas` falhar.

### 11.3 Screenshot

O recorte e produzido com `html2canvas` usando:

- `backgroundColor: "#ffffff"`
- `useCORS: true`
- `scale` limitado a `2`
- coordenadas reais da selecao
- exclusao do proprio launcher via `ignoreElements`

O launcher e marcado com `data-ai-page-editor-root` para nao contaminar a imagem nem a varredura.

### 11.4 Enriquecimento semantico do recorte

Antes de anexar o screenshot, o launcher chama `collectTargetCapture(rect, attachmentId, pathname)`.

Essa rotina:

- escolhe como raiz:
  - `.me-managed-page-root`, senao
  - `main`, senao
  - `body`
- coleta candidatos via `elementsFromPoint` no:
  - centro,
  - quatro cantos internos do retangulo;
- varre o DOM inteiro da raiz procurando interseccao real com a selecao;
- percorre text nodes com `TreeWalker`;
- deduplica candidatos;
- ordena por confianca;
- limita a `48` candidatos;
- escolhe `primaryCandidate`;
- guarda ate `12` `textFragments`.

### 11.4.1 Higiene contra overlays e content scripts externos

Durante testes reais na rota `/explicacoes`, apareceram erros tipicos de extensoes/content scripts no console, por exemplo:

- `Could not establish connection. Receiving end does not exist.`
- `Identifier 'makeAnObject' has already been declared`

Esses erros nao sao tratados como defeito intrinseco da aplicacao, mas podem poluir a captura se um overlay externo entrar em `elementsFromPoint()` ou na varredura do DOM.

Por isso, `collectTargetCapture()` aplica `shouldAcceptCaptureNode()` para rejeitar:

- nos desconectados do DOM;
- qualquer elemento dentro de `[data-ai-page-editor-root]`;
- `html`, `head`, `body`, `script`, `style`, `link`, `meta`;
- quando a raiz escolhida nao e `body`, qualquer no fora dessa raiz.

Na pratica, isto reduz interferencia de:

- barras flutuantes de extensoes;
- overlays de tradutores;
- scripts de acessibilidade injetados;
- widgets externos nao geridos pela pagina.

Mesmo com essa blindagem, a captura continua a ser evidencia auxiliar, nao a fonte primaria para texto explicitamente citado entre aspas.

### 11.5 Estrutura do `target_capture`

O payload resultante guarda:

- `id`
- `role = "target_capture"`
- `pathname`
- `capturedAt`
- `viewport`
  - `width`
  - `height`
  - `scrollX`
  - `scrollY`
  - `devicePixelRatio`
- `selectionRect`
  - `x`
  - `y`
  - `width`
  - `height`
  - `pageX`
  - `pageY`
- `screenshot`
  - `attachmentId`
  - `mimeType`
  - `width`
  - `height`
- `domCandidates`
- `primaryCandidate`
- `textFragments`
- `captureDiagnostics`

### 11.6 Caracteristicas de cada candidato DOM

Cada `domCandidate` inclui:

- identidade
  - `candidateId`
  - `tagName`
  - `safeSelector`
  - `domPath`
  - `managedNodeId`
  - `blockId`
  - `componentId`
  - `idAttribute`
  - `role`
- contexto visual
  - `rect`
  - `intersectionRatio`
  - `intersectsSelection`
  - `computedStyle`
- contexto semantico
  - `textContent`
  - `normalizedText`
  - `textFingerprint`
  - `parentContext`
- classificadores
  - `isTextBearing`
  - `isHeading`
  - `isButton`
  - `isImage`
  - `isEditableManagedContent`
- `confidence`
- `source`
  - `elementsFromPoint`
  - `rect_intersection`
  - `text_node`

### 11.7 Escolha do `primaryCandidate`

O launcher privilegia:

- candidato gerido editavel que intersecta a selecao;
- se nao houver, qualquer candidato que intersecte;
- se ainda nao houver, o primeiro da lista ordenada.

Se uma extensao injetar elementos por cima da pagina:

- eles podem aparecer cedo em `elementsFromPoint()`;
- mas devem ser descartados se estiverem fora da raiz gerida real ou em tags proibidas;
- por isso o `primaryCandidate` final deve tender a permanecer num alvo dentro de `.me-managed-page-root` quando esse root existe.

---

## 12. Resolucao backend do alvo capturado

O modulo `capture-target-resolution.ts` faz a ponte entre o recorte visual e os candidatos do layout persistivel.

### 12.1 Entrada

Ele recebe:

- anexos;
- candidatos de aplicacao;
- `textAnchor` opcional;
- `fallbackCapture` opcional.

### 12.2 Fontes de evidencia

O resolvedor combina:

- `managed_node_id`
- `block_id`
- `safeSelector`
- texto ancora extraido da mensagem quando ha aspas explicitas
- texto exato da captura
- texto normalizado da captura
- interseccao com a selecao
- indicio de conteudo gerido editavel

### 12.3 Fontes de resolucao possiveis

`resolutionSource` pode ser:

- `managed_node_id`
- `block_id`
- `dom_primary_candidate`
- `capture_text_exact`
- `capture_text_normalized`
- `baseline_text_exact`
- `baseline_text_normalized`
- `combined_evidence`
- `not_found`

### 12.4 Prioridade real da resolucao por captura

Quando existe `target_capture`, o resolvedor backend nao aceita mais o primeiro match textual que aparecer.

A ordem forte de decisao passou a ser:

1. `managed_node_id`
2. `block_id`
3. `dom_primary_candidate`
4. apenas depois disso, `capture_text_exact` ou `capture_text_normalized`

Isto evita que um candidato estruturalmente amplo, como `page-root`, ganhe antes do bloco real apenas porque contem texto semelhante.

### 12.5 Sinais de saida

O resultado devolve:

- `found`
- `confidence`
- `resolutionSource`
- `selectedTarget`
- `candidateCount`
- `evidence`
- `rejectionReasons`
- `capture`

### 12.6 Motivos de rejeicao relevantes

O sistema distingue casos como:

- `capture_missing`
- `capture_target_external_or_dynamic`
- `capture_target_external_image`
- `capture_without_dom_candidates`
- `capture_target_not_found_in_managed_content`
- `pre_resolved_target_not_found_in_current_base`

Isto e importante porque o editor atual ja sabe diferenciar:

- alvo gerido e editavel;
- alvo externo;
- imagem externa;
- area ambigua;
- area sem mapeamento seguro.

### 12.7 Ordem real de confianca para texto entre aspas

Para pedidos do tipo:

- `mude a cor do texto "..." para branco`
- `alinhe o titulo "..." ao centro`
- `remova a linha abaixo de "..."`

o comportamento esperado e deliberadamente deterministico:

1. extrair o `text anchor` da propria mensagem;
2. tentar resolver o alvo seguro pela baseline ativa;
3. se a baseline persistida falhar e houver snapshot vivo completo, repetir sobre `request_live_dom_snapshot`;
4. so usar captura como evidencia complementar;
5. so pedir nova captura ou mais contexto quando o texto nao for encontrado ou for ambiguo.

Ou seja: texto explicito entre aspas nao deve depender primariamente de screenshot.

---

## 13. Tipos de conversa e estados pendentes

### 13.1 Fases da conversa

O contrato atual usa:

- `understanding`
- `needs_clarification`
- `awaiting_intent_confirmation`
- `ready_for_proposal`

### 13.2 Estados finais operacionais

Os resultados do editor usam:

- `needs_clarification`
- `awaiting_intent_confirmation`
- `proposal_ready`
- `draft_saved`
- `no_visible_change`
- `blocked`
- `error`

### 13.3 Estado pendente de insercao de imagem

`pending_image_insert` carrega:

- `target_source = "capture"`
- `target_page`
- `target_slug`
- `target_hint = "selected_area"`
- `capture_attachment_id`
- `capture_attachment_name`
- `image_asset_attachment_id`
- `image_asset_url`
- `status`
  - `waiting_for_image_asset`
  - `awaiting_confirmation`

### 13.4 Estado pendente de clarificacao de alvo

`pending_target_clarification` carrega:

- `requestedAt`
- `intent`
  - `set_text_color`
  - `set_style`
  - `replace_image`
  - `other`
- `textAnchor`
- `requestedProperty`
- `requestedValue`
- `awaiting`
  - `capture`
  - `context_text`
  - `selection_confirmation`
- `capturedTarget`
- `resolvedTarget`

Este estado e uma das maiores adicoes da versao atual. Ele permite retomar uma conversa ja sabendo:

- que tipo de ajuste o sistema tentou fazer;
- qual propriedade queria alterar;
- qual valor queria aplicar;
- se falta nova captura, mais texto de contexto ou confirmacao da selecao;
- e, quando a captura ja foi validada tecnicamente, qual alvo gerido foi realmente resolvido.

`resolvedTarget` existe para impedir falso positivo conversacional. A assistente so pode responder algo equivalente a "ja localizei" quando esse objeto existir com:

- `found = true`
- `resolutionSource` valido
- `selectedTarget` tecnico
- `evidence` preenchido
- `sourceBaseVersion` quando disponivel

---

## 14. Contrato de plano de edicao

O contrato normalizado em `contract.ts` trabalha com:

### 14.1 Escopos

- `text`
- `block`
- `section`
- `page`
- `header`
- `footer`

### 14.2 Modos

- `text_patch`
- `style_patch`
- `spacing_patch`
- `section_layout_patch`
- `image_patch`
- `section_replace`

### 14.3 Operacoes

- `set_style`
- `remove_style`
- `update_text`
- `set_asset`
- `move_node`
- `replace_section`
- `set_responsive_rule`
- `wrap_children`
- `unwrap_children`
- `change_columns`

### 14.4 Breakpoints

- `mobile`
- `tablet`
- `desktop`
- `all`

### 14.5 Risco

- `low`
- `medium`
- `high`

### 14.6 Operacoes semiassistidas

O frontend marca como semiassistidas, por enquanto:

- `move_node`
- `wrap_children`
- `unwrap_children`

Essas operacoes nao sao tratadas como fluxo principal seguro de autoaplicacao.

---

## 15. Pipeline frontend -> backend

### 15.1 Transporte

O frontend invoca a Edge Function `admin-ai-page-editor` via `invokeAdminFunction()` em `src/services/admin.service.ts`.

### 15.2 Regras de auth

Antes de invocar:

- usa `getFreshFunctionAuthContext()`;
- exige sessao fresca;
- envia:
  - header `Authorization: Bearer <token>`
  - `access_token` tambem no body JSON

### 15.3 Robustez de chamada

- timeout de `45s`
- ate `3` tentativas
- retry apenas para contencao de lock de auth

### 15.4 Acoes expostas no frontend

- `fetchAdminAiPageEditorConfig`
- `updateAdminAiPageEditorConfig`
- `testAdminAiPageEditorProviders`
- `fetchAdminAiPageEditorUsageMetrics`
- `generateAdminAiPageEditorProposal`
- `generateAdminAiHeaderCopyProposal`
- `generateAdminAiFooterCopyProposal`

### 15.4.1 Payload adicional enviado em `generateAdminAiPageEditorProposal`

O request principal do launcher para proposta hoje pode carregar tambem:

- `currentDomLayoutJson`
- `currentDomStyleJson`
- `currentDomHtml`

Esses campos seguem junto com:

- mensagem;
- anexos;
- contexto conversacional;
- rota atual;
- slug gerido, quando existir.

### 15.5 Validacao de resposta

`ensureAdminAiPageEditorConversationResponse()` exige:

- campos operacionais completos;
- `provider_used`;
- `assistant_message`;
- `conversation_phase`;
- `quick_replies`;
- `requires_user_confirmation`;
- `can_generate_proposal`;
- `warnings`;
- e, quando `can_generate_proposal === true`:
  - `edit_plan`
  - `proposal`
  - `summary`
  - `explanation`

Tambem preserva:

- `pending_image_insert`
- `pending_target_clarification`

`pending_target_clarification` e tratado como estado opaco controlado pelo backend. A camada `ai-page-editor-response.ts` nao tenta recomputar `capturedTarget` nem `resolvedTarget`; ela apenas valida a forma minima e repassa o contrato normalizado ao launcher.

---

## 16. Acoes suportadas pela Edge Function

O `index.ts` expoe hoje:

- `get_config`
- `update_config`
- `test_providers`
- `generate_proposal`
- `generate_header_copy`
- `generate_footer_copy`
- `get_usage_metrics`

Isto significa que o editor nao e apenas um gerador de patch. Ele tambem centraliza:

- configuracao funcional;
- segredos;
- teste de providers;
- telemetria de custo;
- copy global de header;
- copy global de footer.

---

## 17. Configuracao funcional do editor

O valor persistido do config do editor hoje comporta:

- `enabled`
- `launcher_label`
- `allowed_paths`
- `primary_provider`
- `fallback_provider`
- `gemini_model`
- `openai_model`
- `conversation_provider`
- `conversation_model`
- `planner_provider`
- `planner_model`
- `complex_provider`
- `complex_model`
- `fallback_model`
- `max_attachments`
- `max_attachment_size_mb`
- `base_prompt`
- `require_confirmation`
- `panel_width`

### 17.1 Defaults e normalizacao

No backend:

- `launcher_label` default: `Editar com IA`
- `gemini_model` default: `gemini-2.0-flash`
- `openai_model` default: `gpt-4.1-mini`
- `require_confirmation` default: `true`
- `panel_width`:
  - `compact`
  - `wide`

### 17.2 Roteamento por etapa

`model-routing.ts` separa o modelo por estagio:

- `conversation`
- `planner`
- `complex_proposal`
- `provider_test`

Para cada estagio existe:

- selecao primaria;
- provider/model de fallback.

Isto e importante porque o editor atual **nao** esta mais preso a um unico modelo para tudo.

---

## 18. Tela administrativa do editor

`AdminAiPageEditorScreen.tsx` esta organizada em quatro tabs:

- `config`
- `secrets`
- `usage`
- `routes`

### 18.1 Tab de configuracao

Permite editar:

- `enabled`
- `launcher_label`
- `max_attachments`
- `max_attachment_size_mb`
- `base_prompt`
- `require_confirmation`
- `panel_width`

Tambem exibe cards separados para provider/model de:

- conversa;
- planner;
- proposta complexa;
- fallback.

### 18.2 Tab de segredos

Trata as chaves:

- Gemini API key
- OpenAI API key

O admin recebe `secret_status` com:

- `gemini_api_key_present`
- `openai_api_key_present`

### 18.3 Tab de uso e custos

Consome `get_usage_metrics` e organiza:

- resumo;
- breakdown;
- eventos recentes;
- referencia de pricing.

### 18.4 Tab de rotas permitidas

Cruza:

- presets de `AI_PAGE_EDITOR_ROUTE_OPTIONS`;
- `allowed_paths` persistidos;
- slug gerido quando a rota e publica;
- `site_pages` existentes para esse slug.

Isto permite ver, para cada rota, se ela esta:

- ativa no editor;
- ligada a uma pagina gerida real;
- ou apenas catalogada como rota conhecida.

---

## 19. Pipeline de conversa em `generate_proposal`

O fluxo atual do backend e em camadas.

### 19.1 Etapas fixas antes do roteamento

O backend:

1. exige admin autenticado;
2. normaliza rota e capacidade gerida;
3. monta ou confirma o contexto persistivel da pagina;
4. valida anexos;
5. normaliza `conversationContext`;
6. detecta confirmacao explicita;
7. detecta rejeicao explicita;
8. detecta retomada de `pending_target_clarification`.

Se a conversa estiver a retomar um pedido que ja tem captura anexada, `index.ts` pode entrar antes do turno normal de entendimento no branch `captured_target_clarification`.

Esse branch:

- reavalia a captura contra a base ativa ou `requestSnapshotBaseVersion`;
- persiste `pending_target_clarification.resolvedTarget` quando houver alvo tecnico valido;
- responde com `awaiting_intent_confirmation` apenas se `resolvedTarget.found = true`;
- devolve `needs_clarification` diagnostico se a captura nao corresponder a nenhum bloco gerido persistivel.

### 19.2 Branch de imagem

`image-intent.ts` tenta resolver cedo pedidos do tipo:

- inserir imagem;
- trocar imagem;
- colocar banner/foto/ilustracao.

Estados possiveis:

- `not_applicable`
- `waiting_for_image_asset`
- `awaiting_confirmation`
- `needs_target_capture`
- `invalid_image_asset`

Esse branch decide se ainda falta:

- a imagem em si;
- um link HTTPS;
- uma captura de alvo;
- uma confirmacao final.

### 19.3 Branch de CSS explicito

Se o pedido vier como intencao CSS explicita, o sistema entra num fluxo proprio:

- extrai selector e declaracoes;
- valida seguranca do selector;
- valida valores suportados;
- pede confirmacao;
- materializa patch CSS em `style_json.css`.

Guardrails importantes:

- bloqueio de seletores amplos como `*`, `html`, `body`, `:root`;
- bloqueio de `url(...)`, `javascript:`, `@import`, `script`;
- bloqueio de propriedades perigosas como certos `position`, `z-index`, `transform`;
- whitelist de propriedades/valores suportados.

### 19.4 Branch de diagnostico visual localizado

Existe branch especifico para certos diagnosticos, especialmente espacamento junto ao footer.

Ele permite:

- diagnosticar sem aplicar imediatamente;
- devolver entendimento;
- pedir confirmacao antes da proposta.

### 19.5 Branch de entendimento conversacional

Se nenhum branch deterministico capturar o pedido cedo, o backend chama o turno de entendimento com o modelo da etapa `conversation`.

Esse turno devolve:

- fase da conversa;
- mensagem da assistente;
- quick replies;
- resumo simples do que foi entendido;
- se precisa de clarificacao ou confirmacao.

### 19.6 Materializacao apos confirmacao

Quando o entendimento e confirmado, o backend tenta materializar a proposta por ordem de especializacao:

1. `image_insert_patch`
2. `explicit_css_patch`
3. `confirmed_intent_patch`
4. `localized_visual_patch`
5. `provider_full_proposal`

Ou seja: a proposta ampla do modelo virou fallback, nao o primeiro recurso para tudo.

---

## 20. Branches deterministicos principais

### 20.1 `image_insert_patch`

`image-patch.ts`:

- exige `pending_image_insert.status = "awaiting_confirmation"`;
- persiste o asset de imagem;
- localiza bloco de imagem placeholder ou imagem provavel;
- altera `layout_json`;
- gera `edit_plan.mode = "image_patch"`;
- devolve proposal persistivel.

### 20.2 `confirmed_intent_patch`

`confirmed-intent.ts` e usado sobretudo para intents de espacamento conhecidas e confirmadas.

Escopos observados:

- `wrapper_only`
- `first_section_only`
- `section_internal_only`
- `wrapper_and_first_section`

Ele usa o patch engine para gerar mudancas pequenas e explicitas.

### 20.3 `localized_visual_patch`

`localized-patch.ts` e hoje um dos modulos mais importantes.

Ele trata pedidos localizados como:

- cor de texto;
- alinhamento;
- linha decorativa;
- borda;
- sombra;
- estilo de botao;
- espacamento localizado;
- outros ajustes visuais pontuais.

Esse branch:

- classifica a intencao localizada;
- extrai `text anchor` quando a mensagem cita texto entre aspas;
- tenta resolver alvo com a captura;
- tenta resolver alvo diretamente pelo texto citado;
- gera `target_resolutions`;
- aplica patch localizado;
- se falhar com seguranca, devolve falha amigavel e pode preencher `pending_target_clarification`.

### 20.3.1 Retry com baseline viva para `text anchor`

`localized-patch.ts` hoje pode executar duas passagens de materializacao:

1. tentativa principal sobre `baseVersion` persistida;
2. retry sobre `requestSnapshotBaseVersion` quando houver:
   - `targetText`;
   - falha por `low_confidence_target`, `no_visible_change` ou `needs_clarification_after_patch`;
   - ou mensagem compativel com `procurei o texto indicado` ou `texto semelhante`.

Quando isso acontece, o `baseVersionSelectionReason` recebe o sufixo:

- `request_live_dom_snapshot_text_anchor_retry`

E os invariants finais podem indicar:

- `baseline_source = "request_live_dom_snapshot"`
- `text_anchor_found = true`

Esse mecanismo existe exatamente para casos em que o admin ve no navegador um texto que ainda nao esta refletido de forma fiel na baseline persistida.

### 20.3.2 Clarificacao de alvo mais especifica

`pending_target_clarification.awaiting` hoje ja diferencia tres familias de pendencia:

- `selection_confirmation`
  - quando o `text anchor` encontrou multiplos candidatos ou nao foi suficientemente distintivo;
- `context_text`
  - quando o texto nao foi encontrado com seguranca ou a captura aponta para conteudo externo ou dinamico;
- `capture`
  - quando ainda falta mapear visualmente o alvo real da pagina.

O launcher usa isso para mudar a copy de status da conversa, em vez de responder sempre com uma mensagem generica de "ainda estou a perceber".

### 20.3.3 Reuso de alvo pre-resolvido apos captura

Quando a captura ja foi validada no branch `captured_target_clarification`, a materializacao final em `localized-patch.ts` passa a reutilizar esse alvo por `preResolvedCaptureTarget`.

Na pratica:

- `pending_target_clarification.resolvedTarget` deixa de ser apenas contexto conversacional;
- ele vira contrato tecnico reaproveitavel pelo `patch-engine.ts`;
- a confirmacao final nao volta a resolver do zero somente por `request_live_dom_snapshot`;
- `applyPatchPlan()` emite invariants como:
  - `capture_target_pre_resolved`
  - `used_pre_resolved_target`

Esse endurecimento existe especificamente para o caso:

- texto entre aspas falha na baseline;
- usuario captura a area;
- backend acha o bloco gerido;
- usuario confirma;
- patch localizado reaproveita o alvo ja resolvido em vez de reabrir loop de captura.

### 20.3.4 Falha apos captura sem repetir o mesmo pedido

Se a captura ja foi usada e mesmo assim nao houver alvo persistivel seguro, a falha amigavel nao deve pedir automaticamente a mesma captura outra vez.

As mensagens passam a privilegiar:

- diagnostico de alvo externo ou dinamico;
- falta de `data-managed-node-id` ou `data-block-id` compativel;
- pedido de texto vizinho para desambiguar;
- aviso de base atual desatualizada quando um alvo pre-resolvido deixa de existir.

### 20.4 `provider_full_proposal`

E o branch mais amplo.

Ele entra quando:

- nenhum branch deterministico conseguiu materializar com seguranca;
- ou o pedido e realmente mais aberto.

Mesmo nesse caso, o backend continua a devolver:

- contrato normalizado;
- proposal persistivel;
- `ai_invariants`;
- `target_resolutions` quando disponiveis;
- estado operacional.

---

## 21. Avaliacao operacional da proposta

`operational-state.ts` calcula o estado final com base em:

- diff real de `layout_json`;
- diff real de `style_json`;
- diff de HTML comparavel;
- renderizabilidade do preview;
- confianca dos alvos resolvidos;
- necessidade de confirmacao estrita.

### 21.1 Thresholds

- low confidence: `< 0.65`
- faixa de review: `>= 0.65` e `< 0.8`

### 21.2 Regras resumidas

- sem diff -> `no_visible_change`
- sem preview renderizavel -> `blocked`
- sem alvos resolvidos quando havia targets -> `needs_clarification`
- target incompleto ou baixa confianca -> `needs_clarification`
- confianca intermediaria ou confirmacao estrita -> `awaiting_intent_confirmation`
- resto -> `proposal_ready`

### 21.3 Estrutura do estado operacional

Toda proposta ou resposta conversa usa:

- `final_status`
- `change_detected`
- `draft_saved`
- `preview_available`
- `change_summary`

`change_summary` pode informar:

- `layout_changed`
- `style_changed`
- `html_changed`
- `text_changed`

---

## 22. Avaliacao local do frontend antes de autoaplicar

O frontend nao grava qualquer proposta cegamente.

`assessAiPageEditorProposal()` revalida:

- suporte persistivel da rota;
- `base_version` devolvida;
- `supports_persistible_flow`;
- `preview_renderable`;
- `desktop_renderable`;
- `mobile_renderable`;
- `target_resolutions`;
- confianca minima e media;
- operacoes semiassistidas;
- branch selecionado;
- guardrails extras para `explicit_css_patch`.

Resultado local:

- `ready`
- `review`
- `blocked`

Autoaplicacao so e desbloqueada quando:

- a rota suporta fluxo persistivel;
- houve diff real;
- o preview esta disponivel;
- nao ha razoes bloqueantes;
- todos os contexts exigidos renderizam.

---

## 23. Fluxo de draft, preview e publicacao

### 23.1 Preparar previa

Quando a proposta esta pronta e pode ser aplicada:

- o launcher oferece `Preparar previa`;
- chama `applyDraftFromProposal()`;
- salva um novo draft em `site_page_versions`;
- sincroniza cache;
- valida persistencia quando o branch e CSS explicito;
- cria preview local no site atual.

### 23.2 Preview local

O preview:

- renderiza HTML e CSS da versao;
- e empurrado para a pagina corrente;
- usa token de preview em query string;
- fica visivel apenas para quem esta na sessao atual.

### 23.3 Estado `pendingPublication`

Depois do draft aplicado com preview valido, o launcher guarda:

- `draftVersion`
- `previousVersionSnapshot`

Enquanto `pendingPublication` existir, a interface oferece:

- confirmar alteracoes;
- desfazer e voltar.

### 23.4 Confirmar alteracoes

`handleConfirmAppliedChanges()`:

- publica a versao draft selecionada;
- limpa preview;
- refresca conteudo atual;
- limpa pendencias;
- marca decisao pos-aplicacao.

### 23.5 Desfazer antes de publicar

`handleUndoAppliedChanges()`:

- restaura o snapshot anterior como novo draft;
- reabre preview desse estado;
- limpa pendencias da proposta atual.

### 23.6 Mensagens em linguagem natural

O launcher tambem entende comandos conversacionais do tipo:

- pedido para aplicar proposta;
- pedido para publicar;
- confirmacao textual de uma previa ja pronta.

---

## 24. Fluxo de revisoes

O launcher atual tem bloco proprio de `Revisoes`.

### 24.1 O que mostra

Para cada versao:

- `version_number`
- `status`
- `created_at`
- selo `Atual` quando corresponde a versao vigente

### 24.2 Acoes por revisao

- `Ver revisao`
  - carrega preview da versao escolhida
- `Definir esta revisao`
  - promove a revisao selecionada para estado atual da pagina
- `Voltar a publicada`
  - descarta a previa temporaria da revisao

### 24.3 Restauracao e rollback

Existem dois caminhos:

1. restaurar revisao como novo draft
   - `handleRestoreRevision()`
   - metadata `source: "revision_restore"`

2. definir revisao diretamente como atual
   - `handleApplySelectedRevision()`
   - usa `rollbackMutation`

Isto significa que o editor atual nao e apenas um gerador de patch. Ele ja participa do ciclo completo de revisao operacional da pagina.

---

## 25. Fluxos especiais de header e footer globais

Antes de verificar se a rota suporta fluxo persistivel, o launcher detecta pedidos estritos de:

- header global;
- footer global.

### 25.1 Header global

Quando o pedido e reconhecido como estritamente do topo global:

- chama `generateAdminAiHeaderCopyProposal`;
- valida se houve alteracao real;
- atualiza `branding.header_announcement`;
- invalida cache e faz broadcast.

### 25.2 Footer global

Quando o pedido e reconhecido como estritamente do rodape global:

- chama `generateAdminAiFooterCopyProposal`;
- valida se houve alteracao real;
- atualiza `branding.footer_description`;
- invalida cache e faz broadcast.

### 25.3 Importancia estrutural

Esses dois fluxos:

- nao passam por `site_pages`;
- nao usam draft/preview/publicacao de pagina;
- sao tratados como alteracao global de branding.

---

## 26. Uso de providers e custos

O backend mantem catalogo de pricing por modelo em `index.ts`.

Hoje ha catalogo para familias como:

- Gemini 2.0 Flash
- Gemini 2.5 Flash
- Gemini 2.5 Flash-Lite
- Gemini 2.5 Pro
- Gemini 3.1 Flash-Lite
- Gemini 3.5 Flash
- GPT-4.1 mini
- GPT-4.1
- GPT-4o mini

O sistema regista por evento:

- provider
- model
- input tokens
- output tokens
- total tokens
- custo estimado
- request_id
- slug
- path
- metadata do branch e do contrato

As acoes de uso rastreadas hoje sao:

- `generate_proposal`
- `test_providers`

---

## 27. Auditoria e observabilidade

O backend escreve auditoria e logs em multiplos pontos.

Metadados recorrentes incluem:

- `branch_selected`
- `understanding_summary`
- `conversation_phase`
- `user_confirmed_understanding`
- `model_stage`
- `fallback_used`
- `pricing_source`
- `target_resolutions`
- `published_version_id`
- `latest_draft_id`
- `context_source`
- `degraded_draft_bypassed`
- `baseVersionSource`
- `baseVersionNumber`
- `textAnchor`
- `requestedProperty`
- `requestedValue`
- `hasLiveDomSnapshot`
- `hasTargetCaptureAttachment`
- `domCandidatesCount`
- `primaryCandidateManagedNodeId`
- `primaryCandidateBlockId`
- `primaryCandidateSafeSelector`
- `capturedTargetFound`
- `capturedTargetConfidence`
- `capturedTargetResolutionSource`
- `usedPreResolvedTarget`
- `materializationResult`
- `failureReasons`

Os branches auditados explicitamente incluem, entre outros:

- `baseline_incomplete`
- `understanding_turn`
- `captured_target_clarification`
- `image_insert_patch`
- `explicit_css_patch`
- `confirmed_intent_patch`
- `localized_visual_patch`
- `provider_full_proposal`
- `localized_visual_diagnostic`

---

## 28. Guardrails de seguranca

A arquitetura atual respeita os principios canonicos do projeto:

- frontend nao e fonte final de verdade;
- Edge Function revalida acesso admin;
- operacoes persistiveis passam pelo backend;
- a pagina gerida trabalha com versoes persistidas;
- o editor nao mexe em grants, pagamentos, RLS, segredos ou integracoes sensiveis.

Guardrails observados diretamente na implementacao:

- rota sensivel nao abre fluxo persistivel;
- baseline incompleta bloqueia proposta segura;
- preview precisa ser renderizavel;
- low confidence bloqueia autoaplicacao;
- certas operacoes continuam semiassistidas;
- CSS explicito passa por whitelist severa;
- alvo externo ou dinamico pode forcar clarificacao adicional;
- o proprio launcher e excluido da captura visual.

---

## 29. O que mudou em relacao a especificacoes anteriores

Os pontos de evolucao mais relevantes da estrutura atual sao:

- suporte real a `image_patch`;
- introducao de `target_capture` rico em DOM e contexto;
- introducao de `pending_target_clarification`;
- introducao de `resolvedTarget` como contrato tecnico persistido entre turnos;
- prioridade pratica para `text anchor` em pedidos com texto entre aspas;
- retry seguro sobre `request_live_dom_snapshot` quando a baseline persistida esta stale;
- blindagem adicional da captura contra overlays e content scripts externos;
- resolucao de alvo baseada em `data-managed-node-id`, `blockId`, seletor seguro e texto, com prioridade forte para IDs estaveis;
- materializacao final capaz de reutilizar alvo capturado ja resolvido, sem perder o estado na confirmacao seguinte;
- providers e modelos separados por etapa;
- rotas publicas persistiveis ampliadas;
- heuristica de fallback para `published_version` quando o draft degrada;
- revisoes integradas no launcher;
- branchs deterministicos maduros antes do fallback de proposta ampla;
- validacao local mais forte antes de aplicar qualquer draft.

---

## 30. Resumo executivo da estrutura atual

Hoje o editor IA da Mariana Explica e um sistema de edicao assistida com:

- conversa curta e guiada;
- entendimento incremental;
- captura visual com mapeamento de DOM;
- proposals persistiveis para paginas publicas geridas;
- fluxos globais dedicados para header/footer;
- validacao dupla frontend + backend;
- preview seguro antes de publicar;
- undo;
- revisoes;
- telemetria de custo;
- configuracao granular por etapa de modelo.

Ele ja nao deve ser entendido como um simples chat que devolve HTML. A estrutura atual e a de um **orquestrador de edicao segura**, apoiado em:

- contexto persistido;
- identificadores estruturais;
- patch engine;
- contratos fortes;
- estados de confianca;
- auditoria e revisoes.

---

## 31. Arquivos-base desta especificacao

### 31.1 Documentacao canonica usada como governanca

- `docs/Estrutura Inicial/03-arquitetura.md`
- `docs/Estrutura Inicial/05-backend-edge-functions.md`
- `docs/Estrutura Inicial/06-frontend-estrutura.md`
- `docs/Estrutura Inicial/10-autenticacao-seguranca.md`

### 31.2 Implementacao auditada para este retrato

- `build-info.ts`
- `src/components/common/SiteAiPageEditorLauncher.tsx`
- `src/pages/admin/AdminAiPageEditorScreen.tsx`
- `src/lib/ai-page-editor.ts`
- `src/lib/ai-page-editor-response.ts`
- `src/lib/site-page-builder.ts`
- `src/services/admin.service.ts`
- `src/types/app.types.ts`
- `supabase/functions/admin-ai-page-editor/index.ts`
- `supabase/functions/admin-ai-page-editor/conversation.ts`
- `supabase/functions/admin-ai-page-editor/contract.ts`
- `supabase/functions/admin-ai-page-editor/capture-target-resolution.ts`
- `supabase/functions/admin-ai-page-editor/operational-state.ts`
- `supabase/functions/admin-ai-page-editor/route-capability.ts`
- `supabase/functions/admin-ai-page-editor/page-bootstrap.ts`
- `supabase/functions/admin-ai-page-editor/model-routing.ts`
- `supabase/functions/admin-ai-page-editor/image-intent.ts`
- `supabase/functions/admin-ai-page-editor/image-patch.ts`
- `supabase/functions/admin-ai-page-editor/confirmed-intent.ts`
- `supabase/functions/admin-ai-page-editor/explicit-css-patch.ts`
- `supabase/functions/admin-ai-page-editor/localized-intent.ts`
- `supabase/functions/admin-ai-page-editor/localized-patch.ts`
- `supabase/functions/admin-ai-page-editor/pre-resolved-target.ts`

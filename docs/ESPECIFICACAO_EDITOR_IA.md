# Especificação do Editor com IA

Documento gerado em 2026-06-15 com base no estado do código da build `1.0.0-94-ai-editor-safe-draft-context`.

## 1. Objetivo

O Editor com IA permite que administradores façam ajustes pontuais em páginas do site através de um chat embutido no frontend.

O objetivo operacional é:

- propor alterações em páginas geridas pelo builder;
- aplicar apenas mudanças locais, principalmente texto e tipografia;
- preservar estrutura, layout, CTAs, rotas, responsividade e lógica funcional;
- exigir confirmação antes de persistir e publicar;
- manter auditoria, telemetria de uso e segredos no backend/Supabase.

O editor não é um gerador livre de páginas. Ele é um assistente restrito para alterações cirúrgicas em conteúdo existente.

## 2. Componentes Principais

### Frontend

Arquivos principais:

- `src/components/common/SiteAiPageEditorLauncher.tsx`
- `src/pages/admin/AdminAiPageEditor.tsx`
- `src/lib/ai-page-editor.ts`
- `src/services/admin.service.ts`
- `src/hooks/useAdmin.ts`
- `src/types/app.types.ts`
- `src/lib/site-page-builder.ts`
- `src/lib/site-page-preview.ts`

Funções principais:

- `SiteAiPageEditorLauncher`: chat flutuante disponível nas rotas habilitadas.
- `AdminAiPageEditor`: tela administrativa de configuração, provedores, segredos, rotas e métricas.
- `getAiPageEditorRouteOption`: resolve se a rota atual é suportada pelo editor.
- `isAiPageEditorAllowedPath`: valida rotas liberadas por configuração.
- `generateAdminAiPageEditorProposal`: chama a Edge Function para gerar proposta.
- `saveAdminSitePageDraft`: persiste a proposta como rascunho.
- `publishAdminSitePageVersion`: publica a versão confirmada.
- `rollbackAdminSitePageVersion`: define outra versão como publicada.

### Supabase Edge Functions

Funções principais:

- `admin-ai-page-editor`
- `admin-page-builder`
- `admin-page-assets`

`admin-ai-page-editor` gera propostas, testa provedores, lê/grava configuração e registra métricas.

`admin-page-builder` salva rascunhos, publica versões, faz rollback e lista versões.

`admin-page-assets` trata upload de assets do builder visual.

### Banco de Dados

Tabelas envolvidas:

- `public.site_config`
- `public.site_pages`
- `public.site_page_versions`
- `public.site_page_assets`
- `public.ai_page_editor_usage_events`
- `public.audit_logs`
- `vault.decrypted_secrets`

Funções SQL relevantes:

- `public.get_platform_vault_secret(p_name text)`
- `public.upsert_platform_vault_secret(p_name text, p_secret text, p_description text)`
- `public.is_admin()`
- `public.set_updated_at()`

## 3. Rotas e Visibilidade

As rotas padrão estão em `src/lib/ai-page-editor.ts`.

Rotas configuradas por padrão:

- `/`
- `/sobre`
- `/privacidade`
- `/cookies`
- `/termos-de-uso`
- `/aluno/dashboard`
- `/aluno/cursos`
- `/aluno/cursos/:courseId`
- `/aluno/cursos/:courseId/player/*`
- `/aluno/downloads`
- `/aluno/pagamentos`
- `/aluno/notificacoes`
- `/aluno/chamados`
- `/aluno/perfil`

O launcher só renderiza quando:

- o usuário está autenticado;
- o usuário é admin;
- a rota atual corresponde a uma rota configurada;
- o editor está habilitado na configuração;
- a rota está presente em `allowed_paths`.

Páginas com `slug` conhecido podem persistir rascunhos no builder. Rotas sem `slug` podem gerar análise/proposta, mas não seguem o mesmo fluxo de rascunho de página pública.

## 4. Configuração Administrativa

A tela `AdminAiPageEditor` permite configurar:

- ativação do editor;
- texto do botão/launcher;
- rotas permitidas;
- provedor principal;
- provedor fallback;
- modelo Gemini;
- modelo OpenAI;
- limite de anexos;
- tamanho máximo por anexo;
- prompt base;
- exigência de confirmação;
- largura do painel;
- chaves Gemini/OpenAI.

A configuração fica em:

```sql
public.site_config.config_key = 'ai_page_editor_config'
```

Estrutura de `config_value`:

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
  "base_prompt": "...",
  "require_confirmation": true,
  "panel_width": "wide"
}
```

Normalizações aplicadas no backend:

- `primary_provider`: somente `gemini` ou `openai`, com fallback para `gemini`.
- `fallback_provider`: somente `gemini` ou `openai`, com fallback para `openai`.
- `max_attachments`: limitado entre 0 e 6.
- `max_attachment_size_mb`: limitado entre 1 e 20.
- `require_confirmation`: verdadeiro por padrão.
- `panel_width`: `wide` ou `compact`.

## 5. Segredos e Provedores IA

Os segredos não ficam no frontend.

Nomes dos segredos:

- `mariana_explica_ai_gemini_api_key`
- `mariana_explica_ai_openai_api_key`

Leitura:

```sql
public.get_platform_vault_secret(p_name text)
```

Gravação:

```sql
public.upsert_platform_vault_secret(p_name text, p_secret text, p_description text)
```

Permissões:

- execução concedida para `service_role`;
- não expõe o valor real ao frontend;
- o frontend recebe apenas status booleano:
  - `gemini_api_key_present`
  - `openai_api_key_present`

Provedores suportados:

- Gemini via `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- OpenAI via `https://api.openai.com/v1/responses`

Modelos padrão:

- Gemini: `gemini-2.0-flash`
- OpenAI: `gpt-4.1-mini`

Ordem de execução:

- tenta o provedor principal;
- se falhar ou estiver sem chave, tenta o fallback;
- registra falhas por provedor;
- retorna erro consolidado se nenhum provedor responder.

## 6. Ações da Edge Function `admin-ai-page-editor`

Todas as ações exigem admin via `requireAdmin(req)`.

`verify_jwt = false` no `supabase/config.toml`, portanto a validação JWT é manual dentro da função.

### `get_config`

Retorna:

- configuração normalizada;
- status dos segredos.

### `update_config`

Entrada:

- `configValue`
- `geminiApiKey`
- `openaiApiKey`

Comportamento:

- normaliza configuração;
- grava `site_config`;
- grava segredos no Vault quando enviados;
- registra auditoria `admin.ai_page_editor_config_updated`.

### `test_providers`

Comportamento:

- testa provedores na ordem configurada;
- usa prompt mínimo para obter `{"ok": true}`;
- classifica falhas como:
  - `ok`
  - `missing_key`
  - `quota_exceeded`
  - `error`
- registra uso em `ai_page_editor_usage_events` quando há resposta com tokens;
- registra auditoria `admin.ai_page_editor_provider_tested`.

### `get_usage_metrics`

Entrada:

- `periodDays`, normalizado entre 1 e 365.

Retorna:

- resumo de pedidos;
- tokens de entrada/saída;
- custo estimado;
- breakdown por provedor/modelo/ação;
- últimos 20 eventos.

### `generate_proposal`

Entrada obrigatória:

- `slug`
- `title`
- `path`
- `message`
- `currentLayoutJson`
- `currentStyleJson`
- `currentHtml`
- `attachments`

Comportamento:

- valida configuração ativa;
- valida rota em `allowed_paths`;
- bloqueia CSS estrutural em páginas geridas por blocos quando não é tipografia;
- valida anexos;
- monta prompt de sistema;
- monta prompt de usuário com HTML, layout JSON e style JSON atuais;
- chama provedor principal/fallback;
- valida JSON de resposta;
- estabiliza a proposta para proteger layout;
- registra uso;
- registra auditoria `admin.ai_page_editor_proposal_generated`.

### `generate_header_copy`

Atualiza apenas texto global de header.

Entrada:

- `title`
- `path`
- `message`
- `currentHeaderText`

Retorno:

- `header_announcement`

Auditoria:

- `admin.ai_page_editor_header_copy_generated`

### `generate_footer_copy`

Atualiza apenas texto global de footer.

Entrada:

- `title`
- `path`
- `message`
- `currentFooterText`

Retorno:

- `footer_description`

Auditoria:

- `admin.ai_page_editor_footer_copy_generated`

## 7. Contrato da Proposta IA

Resposta esperada para edição de página:

```json
{
  "summary": "string",
  "explanation": "string",
  "warnings": ["string"],
  "proposal": {
    "slug": "string",
    "title": "string",
    "layout_json": "{\"projectData\":{\"blocks\":[]}}",
    "style_json": "{}",
    "metadata": "{}"
  }
}
```

Observações:

- `layout_json`, `style_json` e `metadata` devem vir como strings JSON.
- O backend também aceita objetos em alguns casos, mas o prompt exige string JSON.
- `layout_json` deve conter `projectData.blocks`, `blocks` no root ou HTML convertível.
- HTML bruto solto é convertido em bloco `rich_text` fallback somente quando necessário.
- JSON serializado dentro de `html` é desembrulhado recursivamente antes de salvar.

## 8. Fluxo de Edição no Frontend

### 1. Abertura

O botão flutuante aparece nas rotas permitidas para admin.

O chat inicial informa:

- que pode ajustar texto e áreas globais;
- que header/footer precisam ser citados explicitamente;
- que pode receber anexos ou captura de área;
- que não altera permissões, pagamentos, RLS, integrações ou segredos.

### 2. Envio da mensagem

Ao enviar:

- adiciona mensagem do usuário ao chat;
- bloqueia textarea/botão;
- mostra status de processamento;
- identifica se o pedido mira header/footer global;
- bloqueia CSS estrutural em página de blocos;
- envia contexto atual para `admin-ai-page-editor`.

### 3. Geração da proposta

O backend retorna:

- resumo;
- explicação;
- warnings;
- proposta.

O frontend mostra botões de confirmação quando a página pode persistir rascunho.

### 4. Implementar

Ao clicar em `Implementar`:

- salva draft com `admin-page-builder.save_draft`;
- gera prévia local com `storeSitePagePreview`;
- navega para a mesma página com token de preview;
- mostra botões:
  - `Confirmar alterações`
  - `Desfazer e voltar`

### 5. Confirmar alterações

Ao confirmar:

- publica o draft via `admin-page-builder.publish`;
- invalida queries de página pública/admin;
- mantém a versão publicada como estado real.

### 6. Desfazer

Ao desfazer:

- se houver snapshot anterior, salva um novo draft com o estado anterior;
- publica esse draft para restaurar;
- invalida queries;
- limpa preview.

### 7. Revisões

O painel permite:

- visualizar revisões;
- carregar prévia de revisão;
- definir revisão como atual via rollback.

## 9. Seleção Segura de Contexto

O editor pode receber:

- latest draft;
- versão publicada;
- versão pública carregada.

Regra atual:

- usa `latest_draft` somente se ele não estiver degradado e não for mais antigo que a publicada;
- usa publicada quando o draft tem `version_number` menor que a publicada;
- usa publicada quando o draft tem menos blocos geridos que a publicada;
- usa publicada quando o texto do draft está muito menor que o texto publicado.

Função:

- `shouldUsePublishedVersionForAiContext`

Motivo:

- evitar que drafts antigos ou quebrados contaminem o contexto enviado à IA;
- impedir falhas como “não encontrei alvo” quando o draft não contém o texto da página publicada.

## 10. Regras de Segurança de Layout

O backend não confia cegamente na resposta da IA.

Principais proteções:

- valida JSON de resposta;
- normaliza `layout_json`;
- recusa proposta sem blocos ou HTML convertível;
- detecta pedido de texto;
- detecta pedido de tipografia;
- detecta pedido estrutural;
- bloqueia CSS/classe estrutural em páginas geridas por blocos;
- impede fragmentos parciais de `rich_text`;
- impede troca de estrutura de blocos;
- impede remoção de seções;
- impede introdução inesperada de imagem placeholder;
- exige preservação de footprint HTML em rich text;
- exige que alterações textuais localizadas afetem no máximo um ponto;
- exige envelope completo para propostas estruturais.

### Envelope de layout

A proposta precisa preservar:

- quantidade de blocos;
- tipos de blocos;
- número de colunas/children em containers;
- número de items em columns;
- footprint HTML de blocos `rich_text`.

Funções relacionadas:

- `proposalPreservesLayoutEnvelope`
- `blockPreservesLayoutEnvelope`
- `richTextPreservesStructuralFootprint`

### Texto

Para substituições textuais com frase citada:

- tenta aplicar diretamente no bloco correspondente;
- mantém o layout atual;
- altera apenas conteúdo textual;
- se a IA sugerir alteração ampla, rejeita.

Funções relacionadas:

- `extractTextEditReplacement`
- `applyQuotedTextReplacementToLayout`
- `proposalRepresentsLocalizedTextPatch`
- `mergeTextOnlyProposalWithCurrentLayout`

### Tipografia

Para pedidos tipográficos:

- extrai frase-alvo;
- extrai declarações seguras;
- cria classe `me-ai-typography-target-{uuid}`;
- injeta a classe no elemento HTML mais próximo do alvo;
- adiciona CSS em `style_json.css`;
- preserva estrutura.

Propriedades permitidas:

- `color`
- `font-family`
- `font-size`
- `font-style`
- `font-weight`
- `letter-spacing`
- `line-height`
- `text-align`
- `text-decoration`
- `text-transform`

Valores proibidos:

- `url(`
- `expression(`
- `@import`
- `javascript:`
- `</style`

Formatos de `font-size` suportados:

- `font-size:22px`
- `font-size 22px`
- `fonte em 22px`
- `fonte para 22px`
- `tamanho da fonte 22px`
- `aumente ... para 22px`
- `22px de fonte`

Funções relacionadas:

- `extractQuotedTypographyTarget`
- `extractTypographyDeclarations`
- `applyTypographyTargetToLayout`
- `buildTypographyCssRule`
- `appendCssPatchToStyleJson`

Mensagem de erro quando não há alvo:

```text
Não encontrei um alvo tipográfico local e seguro na página atual para aplicar esse ajuste sem mexer no resto da página.
```

## 11. Anexos e Captura de Área

O frontend suporta:

- upload de imagens;
- colagem de imagens;
- captura de área via `html2canvas`.

Limites vêm de configuração:

- `max_attachments`
- `max_attachment_size_mb`

O backend valida:

- `data_url` iniciado por `data:`;
- tamanho máximo;
- número máximo de anexos.

As imagens são enviadas ao provedor:

- Gemini: partes com `inline_data`;
- OpenAI: `input_image` com `image_url`.

## 12. Supabase: Tabelas

### `site_config`

Criada em `0002_domain_security.sql`.

Campos relevantes:

- `config_key`
- `config_value`
- `description`
- `is_public`
- `updated_by`
- `updated_at`

Uso no editor:

- armazena `ai_page_editor_config`;
- `is_public=false`;
- acesso admin via RLS;
- escrita pelo backend com service role.

RLS:

- público lê apenas `is_public=true`;
- admin lê todos;
- admin gerencia todos.

### `site_pages`

Criada em `0031_site_page_builder_foundation.sql`.

Campos:

- `id`
- `slug`
- `title`
- `status`
- `published_version_id`
- `created_by`
- `created_at`
- `updated_at`

Uso:

- define a página lógica;
- aponta para a versão publicada.

Status:

- `draft`
- `published`
- `archived`

RLS:

- público lê páginas publicadas;
- admin lê e gerencia.

### `site_page_versions`

Criada em `0031_site_page_builder_foundation.sql`.

Campos:

- `id`
- `page_id`
- `version_number`
- `status`
- `layout_json`
- `style_json`
- `metadata`
- `created_by`
- `created_at`

Uso:

- cada alteração gera nova versão;
- IA salva primeiro como draft;
- confirmação publica a versão;
- rollback publica versão anterior.

RLS:

- público lê somente versão publicada referenciada por `site_pages.published_version_id`;
- admin lê e gerencia.

### `site_page_assets`

Criada em `0031_site_page_builder_foundation.sql`.

Uso:

- assets do builder visual;
- não é o mecanismo principal do chat IA;
- relevante para páginas geridas pelo builder.

RLS:

- admin lê e gerencia.

### `ai_page_editor_usage_events`

Criada em `0034_ai_page_editor_usage_metrics.sql`.

Campos:

- `id`
- `action`
- `provider`
- `model`
- `user_id`
- `slug`
- `path`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost_usd`
- `currency`
- `request_id`
- `metadata`
- `created_at`

Constraints:

- `action in ('generate_proposal', 'test_providers')`
- `provider in ('gemini', 'openai')`
- tokens não negativos;
- custo nulo ou não negativo.

Índices:

- `created_at desc`
- `(action, created_at desc)`
- `(provider, model)`
- `slug`
- `user_id`

RLS:

- select permitido para admin.

Observação:

- inserts são feitos pela Edge Function com service role.

### `audit_logs`

Criada em `0002_domain_security.sql`.

Uso:

- audita atualização de configuração;
- teste de provedores;
- geração de proposta;
- geração de header/footer;
- draft salvo;
- publicação;
- rollback.

RLS:

- select permitido para admin.

## 13. Supabase: Migrations Relevantes

### `0002_domain_security.sql`

Define:

- `site_config`;
- `audit_logs`;
- RLS de `site_config`;
- RLS de `audit_logs`;
- trigger `site_config_updated_at`.

### `0013_platform_cron_scheduler.sql`

Define:

- `public.upsert_platform_vault_secret`.

Embora criada para cron, é reutilizada pelo editor IA para gravar segredos.

### `0031_site_page_builder_foundation.sql`

Define:

- `site_pages`;
- `site_page_versions`;
- `site_page_assets`;
- índices;
- trigger;
- FK de versão publicada;
- RLS do builder;
- seeds de páginas institucionais.

### `0032_ai_page_editor.sql`

Define:

- extensão `supabase_vault`;
- `public.get_platform_vault_secret`;
- seed de `ai_page_editor_config`.

### `0034_ai_page_editor_usage_metrics.sql`

Define:

- tabela `ai_page_editor_usage_events`;
- constraints;
- índices;
- RLS admin.

### `0035_ai_page_editor_provider_order.sql`

Atualiza:

- `primary_provider = openai`;
- `fallback_provider = gemini`.

### `0036_ai_page_editor_base_prompt_refresh.sql`

Atualiza prompt base antigo para o prompt seguro atual quando o valor está vazio ou igual ao prompt legado.

## 14. Supabase: Edge Function `admin-page-builder`

Ações:

- `list_pages`
- `get_page`
- `save_draft`
- `publish`
- `rollback`
- `unpublish`

Todas exigem admin.

### `get_page`

Retorna:

- página;
- até 60 versões;
- versão publicada;
- latest draft;
- assets.

`latest_draft` é a primeira versão com status `draft` ao ordenar por `version_number desc`.

### `save_draft`

Comportamento:

- calcula próximo `version_number`;
- insere nova versão com status `draft`;
- mantém página `published` quando já estava publicada;
- registra auditoria `admin.page_builder_draft_saved`.

### `publish` e `rollback`

Comportamento:

- valida versão da página;
- arquiva versão publicada anterior;
- marca versão alvo como `published`;
- atualiza `site_pages.published_version_id`;
- registra auditoria.

### `unpublish`

Comportamento:

- arquiva versões publicadas;
- define página como `draft`;
- limpa `published_version_id`.

## 15. Métricas e Custos

O backend extrai tokens de:

- Gemini response usage metadata;
- OpenAI response usage.

O custo é estimado com tabela interna:

Gemini:

- `gemini-3.5-flash`
- `gemini-3.1-flash-lite`
- `gemini-2.0-flash`
- `gemini-2.5-flash-lite`
- `gemini-2.5-flash`
- `gemini-2.5-pro`

OpenAI:

- `gpt-4.1-mini`
- `gpt-4.1`
- `gpt-4o-mini`

Se o modelo não estiver mapeado:

- evento fica sem custo estimado;
- aparece como `unpriced_requests`.

## 16. Header e Footer Globais

O launcher intercepta pedidos que mencionam:

- `header`
- `cabeçalho`
- `topo`
- `navbar`
- `rodapé`
- `footer`

Header:

- chama `generate_header_copy`;
- atualiza `branding.config_value.header_announcement`;
- faz broadcast de branding.

Footer:

- chama `generate_footer_copy`;
- atualiza `branding.config_value.footer_description`;
- faz broadcast de branding.

Esses fluxos não salvam `site_page_versions`.

## 17. Estados de Interface

Estados principais no launcher:

- `open`
- `message`
- `attachments`
- `proposal`
- `messages`
- `feedback`
- `sendStatus`
- `awaitingImplementation`
- `pendingPublication`
- `postApplyDecision`
- `selectedRevisionId`
- `isCapturingPage`
- `isSelectingCaptureArea`
- `captureRect`

Estados de confirmação:

- proposta aguardando implementação;
- draft aplicado aguardando publicação/desfazer;
- alteração guardada aguardando continuar/terminar.

## 18. Erros Esperados

Mensagens importantes:

- `Editor via IA desativado`
- `Rota nao habilitada para o editor via IA`
- `Pedido de CSS/classe estrutural detectado...`
- `A proposta da IA está incompleta`
- `A proposta da IA precisa incluir projectData.blocks ou um HTML convertível`
- `A proposta da IA não preservou a estrutura completa da página atual. Nenhum rascunho foi aplicado.`
- `A proposta da IA alterou mais do que o trecho pedido. Apenas ajustes locais num único ponto da página podem ser aplicados.`
- `A proposta da IA alterou a estrutura da página num pedido textual. Nenhum rascunho foi aplicado para proteger o layout.`
- `Não encontrei um alvo tipográfico local e seguro na página atual para aplicar esse ajuste sem mexer no resto da página.`
- `Nenhum provedor disponível para gerar a proposta.`

## 19. Limitações Atuais

- A validação de `allowed_paths` no backend compara path literal, enquanto o frontend suporta padrões com `:param` e `*`.
- `require_confirmation` é registrado em métricas, mas o fluxo atual do launcher sempre usa confirmação para páginas persistíveis.
- O editor é mais confiável em páginas públicas com `slug` e builder document estruturado.
- Em páginas privadas sem `slug`, não há fluxo completo de rascunho/publicação via `site_page_versions`.
- O match tipográfico depende de a frase existir no `layout_json` usado como contexto.
- Drafts antigos podem interferir se não forem filtrados; o frontend atual evita drafts mais antigos/degradados, mas o backend `admin-page-builder.get_page` ainda retorna `latest_draft` sem aplicar esse filtro.
- O custo é estimado e depende da tabela interna de preços estar atualizada.

## 20. Checklist de Validação Funcional

### Configuração

- Entrar no admin como usuário admin.
- Abrir tela `Editor via IA`.
- Ativar editor.
- Confirmar rotas permitidas.
- Salvar prompt base.
- Configurar OpenAI/Gemini.
- Testar provedores.
- Confirmar que status dos segredos aparece sem exibir chave.

### Launcher

- Abrir rota permitida como admin.
- Confirmar botão flutuante.
- Abrir chat.
- Ver mensagem inicial.
- Enviar mensagem simples.
- Confirmar bloqueio temporário do textarea/botão.
- Confirmar status “A processar”.

### Texto

- Pedir substituição de frase exata.
- Confirmar que surge proposta.
- Clicar `Implementar`.
- Confirmar preview.
- Clicar `Confirmar alterações`.
- Recarregar página.
- Confirmar que só a frase mudou.

### Tipografia

Testar formatos:

- `altere a fonte do texto "..." para font-size:22px`
- `ajuste o texto "..." para ficar onde ele está, mas com fonte em 22px`
- `aumente a fonte do texto "..." para 22px`

Validar:

- proposta gerada;
- botão `Implementar` aparece;
- draft preserva página inteira;
- após refresh, todas as seções continuam visíveis;
- `style_json.css` contém classe `me-ai-typography-target-*`;
- `layout_json` contém a classe aplicada no alvo.

### Segurança de Layout

- Pedir alteração estrutural vaga.
- Confirmar que a IA rejeita ou avisa.
- Pedir CSS estrutural em página de blocos.
- Confirmar bloqueio.
- Tentar gerar fragmento HTML isolado.
- Confirmar que backend não salva página truncada.

### Header/Footer

- Pedir alteração explícita no header.
- Confirmar atualização global do header.
- Pedir alteração explícita no footer.
- Confirmar atualização global do footer.

### Supabase

- Conferir `site_config` para `ai_page_editor_config`.
- Conferir `ai_page_editor_usage_events` após teste/geração.
- Conferir `audit_logs` após ações.
- Conferir `site_page_versions` após `Implementar`.
- Conferir `site_pages.published_version_id` após publicação.
- Conferir que chaves não aparecem no frontend.

## 21. SQL Útil de Diagnóstico

### Ver configuração

```sql
select config_key, config_value, is_public, updated_at
from public.site_config
where config_key = 'ai_page_editor_config';
```

### Ver versões de uma página

```sql
select
  p.slug,
  v.id,
  v.version_number,
  v.status,
  jsonb_array_length(coalesce(v.layout_json->'projectData'->'blocks','[]'::jsonb)) as project_blocks,
  v.layout_json ? 'html' as has_html_key,
  length(v.layout_json::text) as layout_len,
  v.created_at
from public.site_pages p
join public.site_page_versions v on v.page_id = p.id
where p.slug = 'sobre'
order by v.version_number desc;
```

### Ver versão publicada

```sql
select
  p.slug,
  v.version_number,
  v.status,
  jsonb_array_length(coalesce(v.layout_json->'projectData'->'blocks','[]'::jsonb)) as project_blocks,
  v.layout_json ? 'html' as has_html_key,
  v.layout_json::text like '%Sou a cara por detrás deste projeto%' as has_intro
from public.site_pages p
join public.site_page_versions v on v.id = p.published_version_id
where p.slug = 'sobre';
```

### Ver uso da IA

```sql
select
  created_at,
  action,
  provider,
  model,
  slug,
  path,
  input_tokens,
  output_tokens,
  total_tokens,
  estimated_cost_usd,
  request_id
from public.ai_page_editor_usage_events
order by created_at desc
limit 50;
```

### Ver auditoria

```sql
select
  created_at,
  action,
  entity_type,
  entity_id,
  actor_user_id,
  metadata
from public.audit_logs
where action like 'admin.ai_page_editor%'
   or action like 'admin.page_builder%'
order by created_at desc
limit 50;
```

## 22. Critérios de Aceitação

O Editor com IA está funcional quando:

- aparece apenas para admin nas rotas habilitadas;
- configuração é salva em `site_config`;
- segredos são gravados no Vault e não retornam ao frontend;
- provedores podem ser testados;
- propostas retornam JSON válido;
- texto e tipografia local são aplicados sem remover seções;
- toda edição persistível passa por draft;
- publicação só ocorre após confirmação;
- desfazer restaura estado anterior;
- métricas são registradas;
- auditoria é registrada;
- reload da página mantém todo o conteúdo;
- `site_pages.published_version_id` aponta para versão íntegra.

## 23. Pontos de Melhoria Recomendados

- Aplicar a mesma regra de draft seguro no backend `admin-page-builder.get_page`, não apenas no frontend.
- Fazer a validação backend de `allowed_paths` suportar padrões `:param` e `*`.
- Criar testes automatizados para:
  - extração de `font-size`;
  - match de frase em HTML com tags;
  - rejeição de fragmentos parciais;
  - preservação de envelope de layout;
  - seleção segura de draft/publicada.
- Adicionar rotina administrativa para arquivar drafts degradados.
- Versionar internamente a estrutura `layout_json` para facilitar migrações.
- Exibir no chat qual versão foi usada como contexto: draft ou publicada.

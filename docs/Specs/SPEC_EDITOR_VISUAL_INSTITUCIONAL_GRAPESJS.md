# SPEC — Editor Visual de Páginas (Institucionais + Home) com GrapesJS

## 1. Objetivo

Implementar no painel admin um editor visual estilo Elementor para:

- páginas institucionais;
- página Home;
- edição de texto com experiência TinyMCE;
- upload e substituição de imagens.

Escopo da fase inicial: apenas conteúdo público institucional e Home, sem mexer no fluxo de checkout, catálogo e área do aluno/admin operacional.

---

## 2. Decisões Técnicas (fechadas)

1. Motor visual: `GrapesJS` (open-source), embutido no admin.
2. Editor de texto: `TinyMCE` como rich text editor integrado aos blocos de texto do GrapesJS.
3. Armazenamento de imagens: Supabase Storage com upload via backend/Edge Function (sem expor segredos).
4. Publicação: modelo versionado com `draft` e `published`.
5. Renderização pública: renderer React próprio com validação de schema.

---

## 3. Escopo Funcional da Fase 1

### 3.1 Páginas cobertas

- `/` (Home)
- `/sobre`
- `/privacidade`
- `/cookies`
- `/termos-de-uso`

### 3.2 Capacidades do editor

- drag-and-drop de seções e blocos;
- edição visual de estilos (spacing, cores, tipografia, fundo, borda, radius);
- editor de texto WYSIWYG com toolbar TinyMCE;
- upload de imagem nova;
- troca/substituição de imagem existente;
- biblioteca de assets para reuso;
- salvar rascunho;
- preview;
- publicar;
- histórico de versões e rollback.

### 3.3 Blocos mínimos iniciais

- `section`
- `container`
- `columns`
- `heading`
- `rich_text` (TinyMCE)
- `image`
- `button`
- `divider`
- `spacer`

### 3.4 Home (regra especial)

A Home possui partes dinâmicas (ex.: reviews). Na fase 1:

- blocos dinâmicos viram `widgets bloqueados` (editável posição/layout, não a lógica);
- conteúdo textual e visual das seções estáticas fica totalmente editável;
- comportamento de queries e dados dinâmicos permanece no código/hook.

---

## 4. Arquitetura de Dados

## 4.1 Novas tabelas

### `site_pages`
- `id uuid pk`
- `slug text unique` (`home`, `sobre`, `privacidade`, `cookies`, `termos`)
- `title text`
- `status text` (`draft`, `published`, `archived`)
- `published_version_id uuid null`
- `created_at timestamptz`
- `updated_at timestamptz`

### `site_page_versions`
- `id uuid pk`
- `page_id uuid fk -> site_pages.id`
- `version_number int`
- `layout_json jsonb` (árvore de blocos GrapesJS normalizada)
- `style_json jsonb` (tokens/estilos serializados)
- `metadata jsonb` (viewport, observações, etc.)
- `created_by uuid fk -> profiles.id`
- `created_at timestamptz`

### `site_page_assets`
- `id uuid pk`
- `page_id uuid fk -> site_pages.id`
- `bucket text`
- `path text`
- `public_url text`
- `file_name text`
- `mime_type text`
- `file_size_bytes bigint`
- `uploaded_by uuid fk -> profiles.id`
- `created_at timestamptz`

## 4.2 RLS e policies

- leitura pública apenas da versão publicada;
- leitura/escrita completa apenas admin ativo;
- operações sensíveis com validação backend.

## 4.3 Migrations

Criar migrations SQL versionadas para:

- criação de tabelas;
- índices;
- triggers `updated_at`;
- RLS/policies;
- seed inicial das páginas base.

---

## 5. Backend / Edge Functions

## 5.1 Funções novas

1. `admin-page-builder`
- `action: get_page`
- `action: save_draft`
- `action: publish`
- `action: rollback`
- valida `is_admin`, `role=admin`, `status=active`.

2. `admin-page-assets`
- upload/substituição de imagem;
- valida tipo/tamanho;
- grava metadados em `site_page_assets`.

## 5.2 Extensão opcional

Alternativamente, pode-se estender `admin-storage-upload` com novo `kind: page_builder_asset`, mantendo regra de autorização centralizada.

---

## 6. Frontend Admin

## 6.1 Nova rota

- `/admin/editor-paginas`

## 6.2 UX mínima

- seletor de página (`Home`, `Sobre`, `Privacidade`, `Cookies`, `Termos`);
- canvas GrapesJS;
- painel lateral de propriedades;
- modal/sidepanel de assets (upload e trocar imagem);
- status de rascunho;
- ações: salvar, preview, publicar, histórico.

## 6.3 TinyMCE

- TinyMCE como editor de rich text dos blocos texto;
- presets de toolbar;
- limpeza/sanitização de HTML permitido.

---

## 7. Frontend Público (Renderer)

1. Buscar versão publicada por slug.
2. Validar payload contra schema (zod/validador).
3. Renderizar blocos permitidos em componentes React.
4. Fallback:
- se sem publicação: render padrão em código atual;
- se payload inválido: fallback seguro + log operacional.

---

## 8. Segurança

1. Nenhum segredo no frontend.
2. Upload sempre autenticado e validado no backend.
3. Sanitização de conteúdo rich text.
4. Lista permitida de componentes/blocos.
5. Auditoria de publicar e rollback.

---

## 9. Fases de Execução

## Fase A — Fundação (dados + backend)

- migrations das 3 tabelas;
- policies RLS;
- Edge Function `admin-page-builder` (draft/publish);
- upload de assets (`admin-page-assets` ou extensão da existente).

## Fase B — Editor Admin (MVP)

- rota `/admin/editor-paginas`;
- GrapesJS embutido;
- TinyMCE integrado;
- salvar rascunho e publicar;
- upload/troca de imagem.

## Fase C — Renderer Público

- render dinâmico em `/sobre`, `/privacidade`, `/cookies`, `/termos-de-uso`;
- incluir Home com widgets dinâmicos preservados;
- fallback resiliente.

## Fase D — Operação

- histórico + rollback;
- telemetria/logs;
- hardening de permissões e limites de upload.

---

## 10. Critérios de Pronto (DoD)

1. Admin edita e publica `Sobre` sem deploy.
2. Admin edita Home (parte estática) sem quebrar widgets dinâmicos.
3. Upload de imagem funciona com troca/substituição.
4. Texto rico via TinyMCE com sanitização e preservação visual.
5. Rollback para versão anterior em 1 clique.
6. RLS e validações de admin cobrindo todas as operações.
7. Build/deploy sem regressão das páginas públicas.

---

## 11. Riscos e Mitigações

1. Risco: payload livre quebrar layout.
- Mitigação: schema estrito + whitelist de blocos + fallback.

2. Risco: Home perder comportamento dinâmico.
- Mitigação: widgets dinâmicos bloqueados na fase 1.

3. Risco: abuso de upload.
- Mitigação: limite de tamanho, MIME allowlist, compressão e versionamento.

4. Risco: experiência visual inferior ao Elementor no início.
- Mitigação: começar com blocos essenciais e evoluir em ciclos curtos.

---

## 12. Estimativa

- MVP funcional (institucionais + Home + upload + TinyMCE + publish): `3 a 6 semanas`.
- Evolução para nível “Elementor avançado” (templates, animações, colaboração, etc.): `2 a 4 meses`.


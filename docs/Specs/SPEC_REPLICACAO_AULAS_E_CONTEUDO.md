# SPEC_REPLICACAO_AULAS_E_CONTEUDO: Configuracao Atual para Replicacao Exata

## 1. Objetivo

Este documento descreve, com fidelidade de implementacao, a configuracao atual de aulas e consumo de conteudo do projeto Mariana Explica para replicacao em outra plataforma com arquitetura semelhante.

Foco principal:

- opcoes de consumo da aula:
  - `video` (apenas video)
  - `text` (apenas texto)
  - `hybrid` (video + texto)
  - `file` (apenas ficheiro)
- regras de persistencia, upload, acesso e renderizacao no player.

---

## 2. Fontes de Verdade Usadas

Canonicas:

1. `docs/Estrutura Inicial/04-banco-dados.md`
2. `docs/Estrutura Inicial/03-arquitetura.md`
3. `docs/Estrutura Inicial/05-backend-edge-functions.md`
4. `docs/Estrutura Inicial/10-autenticacao-seguranca.md`

Implementacao real (codigo):

- `supabase/migrations/0009_course_structure_foundation.sql`
- `supabase/migrations/0012_lesson_file_type.sql`
- `supabase/functions/admin-content/index.ts`
- `supabase/functions/admin-storage-upload/index.ts`
- `supabase/functions/generate-asset-access/index.ts`
- `src/pages/admin/builder/CourseLessonDetailPanel.tsx`
- `src/pages/admin/builder/CourseLessonMaterialsPanel.tsx`
- `src/pages/student/StudentLessonPage.tsx`
- `src/components/common/LessonPrimaryMedia.tsx`
- `src/lib/lesson-video.ts`
- `src/services/admin.service.ts`
- `src/services/dashboard.service.ts`
- `src/types/app.types.ts`

---

## 3. Modelo de Dados Exato

## 3.1 Tabela `product_lessons`

Campos relevantes:

- `id uuid pk`
- `module_id uuid fk -> product_modules.id`
- `title text not null`
- `description text null`
- `position integer not null default 0`
- `is_required boolean not null default true`
- `lesson_type text not null default 'text'`
- `youtube_url text null`
- `text_content text null`
- `estimated_minutes integer not null default 0`
- `starts_at timestamptz null`
- `ends_at timestamptz null`
- `status text not null default 'published'`

Constraints:

- `lesson_type`:
  - originalmente: `video | text | hybrid` (migration `0009`)
  - atual: `video | text | hybrid | file` (migration `0012`)
- `status`: `draft | published | archived`
- `estimated_minutes >= 0`

## 3.2 Tabela `module_assets`

Campos relevantes:

- `id uuid pk`
- `module_id uuid fk -> product_modules.id`
- `asset_type text not null`
- `title text not null`
- `sort_order integer`
- `storage_bucket text null`
- `storage_path text null`
- `external_url text null`
- `mime_type text null`
- `file_size_bytes bigint null`
- `allow_download boolean not null default false`
- `allow_stream boolean not null default true`
- `watermark_enabled boolean not null default false`
- `status text not null default 'active'`

Constraints:

- `asset_type`: `pdf | video_file | video_embed | external_link`
- `status`: `active | inactive`
- regra de origem (XOR):
  - ou `storage_bucket + storage_path`
  - ou `external_url`
  - nunca os dois ao mesmo tempo

---

## 4. Tipos de Aula e Persistencia (Exato)

## 4.1 `video` (apenas video)

Comportamento:

- aula depende de fonte audiovisual.
- `youtube_url` armazena a origem de video.

Origens validas no frontend atual:

- YouTube (`youtube.com`, `m.youtube.com`, `youtu.be`)
- URL direta com extensao: `mp4`, `webm`, `ogg`, `ogv`, `m4v`, `mov`
- referencia de asset privado: `asset:<uuid>`

Persistencia ao salvar:

- `lesson_type = "video"`
- `youtube_url = <url ou asset:uuid>`
- `text_content = null`

## 4.2 `text` (apenas texto)

Comportamento:

- aula centrada em conteudo textual editado em blocos.
- nao depende de video.

Persistencia ao salvar:

- `lesson_type = "text"`
- `youtube_url = null`
- `text_content = <html serializado por blocos>`

## 4.3 `hybrid` (video + texto)

Comportamento:

- combina video e texto.

Persistencia ao salvar:

- `lesson_type = "hybrid"`
- `youtube_url = <url ou asset:uuid>`
- `text_content = <html serializado por blocos>`

## 4.4 `file` (apenas ficheiro)

Comportamento:

- consumo principal orientado para materiais protegidos do modulo.
- nao usa player de video como fonte principal da aula.

Persistencia ao salvar:

- `lesson_type = "file"`
- `youtube_url = null`
- `text_content = null`

Observacao importante de modelagem atual:

- `module_assets` pertence ao **modulo**, nao a uma aula especifica.
- logo, aula `file` consome o conjunto de materiais do modulo.

---

## 5. Fluxo de Video no Admin (Exato)

## 5.1 Modo `URL do video`

Entrada:

- admin informa URL (YouTube ou ficheiro direto).

Salvar aula:

- valor vai para `youtube_url`.

## 5.2 Modo `upload protegido`

Fluxo:

1. frontend pede signed upload:
   - `admin-storage-upload` com `kind = "module_asset_signed_url"`
2. backend responde:
   - bucket/path
   - token/signed URL de upload
   - `max_file_size_bytes` (quando aplicavel)
3. frontend envia ficheiro com `supabase.storage.uploadToSignedUrl(...)`
4. frontend cria `module_asset` (`asset_type = "video_file"`, `allow_download = false`, `allow_stream = true`)
5. frontend grava no draft da aula:
   - `youtube_url = "asset:<assetId>"`
6. persistencia final ocorre ao clicar em salvar aula.

---

## 6. Fluxo de Ficheiro no Admin (Exato)

No modo de aula `file`, upload do bloco principal usa:

1. `admin-storage-upload` com `kind = "module_asset"` (upload direto)
2. `create_asset` no `admin-content`

Mapeamento atual do tipo de asset:

- se MIME inicia com `video/` -> `asset_type = "video_file"`
- senao -> `asset_type = "pdf"` (inclui imagens no comportamento atual)

Flags aplicadas na criacao desse asset:

- `allow_download = !file.type.startsWith("video/")`
- `allow_stream = true`
- `watermark_enabled = false`
- `status = "active"`

---

## 7. Renderizacao no Player do Aluno

Tela: `StudentLessonPage`

Comportamento de consumo:

1. sempre tenta renderizar `LessonPrimaryMedia` com `lesson.youtube_url`
2. se `lesson.text_content` existir, renderiza bloco textual
3. se `lesson_type === "file"` e sem `text_content`, mostra card informando consumo via materiais
4. secao "Materiais da aula" lista:
   - PDF base do modulo (quando houver)
   - todos os `module_assets` do modulo

Abertura de material:

- frontend chama `requestAssetAccess(assetId)`
- backend (`generate-asset-access`) valida acesso
- retorna URL temporaria
- frontend abre em nova aba

---

## 8. Parser de Fonte de Video (Exato)

Helper: `src/lib/lesson-video.ts`

Regras:

- `asset:<uuid>` -> video protegido (solicita URL assinada backend)
- YouTube suportado:
  - `youtu.be/<id>`
  - `youtube.com/watch?v=<id>`
  - `youtube.com/embed/<id>`
  - `youtube.com/shorts/<id>`
- parametros de inicio aceitos:
  - `start`, `t`, `time_continue`, hash `#t=...`
- URL direta valida apenas com protocolos `http/https` e extensoes:
  - `mp4`, `webm`, `ogg`, `ogv`, `m4v`, `mov`

---

## 9. Estrutura de `text_content` (Exato)

Editor/render usa blocos serializados em HTML:

- `rich-text`
- `table`
- `image-hotspots`

Observacoes:

- `image-hotspots` serializa payload no atributo `data-hcm-payload`
- ao renderizar hotspots, imagem usa:
  - `signed_url` quando existir
  - fallback para `storage_path`

---

## 10. Seguranca e Autorizacao (Exato)

Principios aplicados:

- `access_grants` e a base real de autorizacao paga.
- frontend nao decide acesso final a arquivo.
- URL temporaria sempre gerada no backend para asset privado.

`generate-asset-access` valida:

- status do asset/modulo/produto;
- contexto do usuario (`admin`, `public`, `registered`, `paid_only`);
- grant ativo para `paid_only`;
- retorna:
  - `mode = "external_url"` quando `external_url` existe
  - `mode = "signed_url"` para storage privado

RLS relevante:

- `product_lessons`: leitura por `can_access_product_lesson(...)` + policy admin
- `module_assets`: gerenciamento admin; aluno acessa arquivo via Edge Function

---

## 11. Diretriz Obrigatoria: Sem Conteudo Padrao

Para a plataforma de destino, este spec deve ser aplicado com **estrutura padrao**, mas **sem conteudo editorial padrao**.

Isso significa:

- nao criar registros de exemplo (ex.: "Aula 1", "Modulo 1", textos ficticios);
- nao preencher `title`, `description`, `text_content` com placeholders;
- nao carregar URLs de video de teste;
- nao manter seeds de materiais dummy em `module_assets`.

Regras de replicacao:

- schema, constraints, policies e fluxos podem ser replicados 1:1;
- conteudo (titulos, textos, arquivos, URLs) deve vir somente de importacao real da plataforma destino;
- qualquer criacao automatica de aula/modulo no frontend admin deve usar labels dinamicas da plataforma destino, ou ficar desabilitada ate entrada manual.

---

## 12. Plano de Migracao Supabase (Detalhado)

## 12.1 Escopo de migracao

Aplicar migracoes para garantir:

- suporte a `lesson_type = 'file'`;
- consistencia de `module_assets` (regra XOR de origem);
- politicas RLS para leitura segura de aulas;
- compatibilidade com Edge Functions de upload/acesso.

## 12.2 Ordem de execucao recomendada

1. backup logico do banco de destino;
2. aplicar migration estrutural de `product_lessons` e `module_assets`;
3. aplicar migration de constraints/checks;
4. aplicar migration de RLS/policies/funcoes auxiliares;
5. publicar Edge Functions (`admin-content`, `admin-storage-upload`, `generate-asset-access`);
6. publicar frontend admin/player;
7. executar validacao SQL e smoke tests funcionais.

## 12.3 Migration SQL 01 - `product_lessons` com `file`

Arquivo sugerido: `supabase/migrations/<timestamp>_lessons_file_type.sql`

```sql
alter table public.product_lessons
  drop constraint if exists product_lessons_lesson_type_check;

alter table public.product_lessons
  add constraint product_lessons_lesson_type_check
  check (lesson_type in ('video', 'text', 'hybrid', 'file'));
```

## 12.4 Migration SQL 02 - Garantir integridade de `module_assets`

Arquivo sugerido: `supabase/migrations/<timestamp>_module_assets_integrity.sql`

```sql
alter table public.module_assets
  drop constraint if exists module_assets_asset_type_check;

alter table public.module_assets
  add constraint module_assets_asset_type_check
  check (asset_type in ('pdf', 'video_file', 'video_embed', 'external_link'));

alter table public.module_assets
  drop constraint if exists module_assets_status_check;

alter table public.module_assets
  add constraint module_assets_status_check
  check (status in ('active', 'inactive'));

alter table public.module_assets
  drop constraint if exists module_assets_source_check;

alter table public.module_assets
  add constraint module_assets_source_check
  check (
    (
      storage_bucket is not null
      and storage_path is not null
      and external_url is null
    )
    or (
      external_url is not null
      and storage_bucket is null
      and storage_path is null
    )
  );
```

## 12.5 Migration SQL 03 - Defaults tecnicos (nao editoriais)

Arquivo sugerido: `supabase/migrations/<timestamp>_lessons_assets_technical_defaults.sql`

Objetivo:

- manter defaults de estrutura tecnica;
- nao inserir conteudo padrao.

```sql
alter table public.product_lessons
  alter column position set default 0,
  alter column is_required set default true,
  alter column lesson_type set default 'text',
  alter column estimated_minutes set default 0;

alter table public.module_assets
  alter column allow_download set default false,
  alter column allow_stream set default true,
  alter column watermark_enabled set default false,
  alter column status set default 'active';
```

Observacao:

- estes defaults sao de **comportamento tecnico da estrutura**, nao de conteudo da aula.

## 12.6 Migration SQL 04 - RLS/policies minimas

Arquivo sugerido: `supabase/migrations/<timestamp>_lessons_assets_rls.sql`

```sql
alter table public.product_lessons enable row level security;

drop policy if exists product_lessons_select_accessible on public.product_lessons;
create policy product_lessons_select_accessible on public.product_lessons
for select using (public.can_access_product_lesson(id));

drop policy if exists product_lessons_admin_manage on public.product_lessons;
create policy product_lessons_admin_manage on public.product_lessons
for all using (public.is_admin()) with check (public.is_admin());

alter table public.module_assets enable row level security;

drop policy if exists module_assets_admin_select on public.module_assets;
create policy module_assets_admin_select on public.module_assets
for select using (public.is_admin());

drop policy if exists module_assets_admin_manage on public.module_assets;
create policy module_assets_admin_manage on public.module_assets
for all using (public.is_admin()) with check (public.is_admin());
```

Observacao:

- no desenho atual, aluno nao le `module_assets` diretamente para abrir arquivo;
- acesso real ao ficheiro passa por `generate-asset-access`.

## 12.7 Edge Functions obrigatorias na migracao

Publicar e validar:

- `admin-content`
- `admin-storage-upload`
- `generate-asset-access`

Checklist tecnico:

- payloads aceitam `lesson_type = "file"`;
- `create_asset/update_asset` respeitam XOR de origem;
- signed upload de video funciona;
- geracao de URL temporaria funciona para asset privado.

## 12.8 Validacao SQL pos-migracao

Executar consultas:

```sql
-- 1) conferir constraint de lesson_type
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'product_lessons_lesson_type_check';

-- 2) conferir constraint XOR de module_assets
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'module_assets_source_check';

-- 3) detectar assets invalidos (deve retornar 0 linhas)
select id, module_id, storage_bucket, storage_path, external_url
from public.module_assets
where (storage_bucket is null or storage_path is null) and external_url is null
   or (storage_bucket is not null and storage_path is not null and external_url is not null);

-- 4) detectar lesson_type fora do contrato (deve retornar 0 linhas)
select id, lesson_type
from public.product_lessons
where lesson_type not in ('video', 'text', 'hybrid', 'file');
```

## 12.9 Rollback tecnico (se necessario)

Se a plataforma destino ainda nao usar `file`, rollback de constraint:

```sql
alter table public.product_lessons
  drop constraint if exists product_lessons_lesson_type_check;

alter table public.product_lessons
  add constraint product_lessons_lesson_type_check
  check (lesson_type in ('video', 'text', 'hybrid'));
```

Atencao:

- antes do rollback, migrar/ajustar linhas com `lesson_type = 'file'`.

---

## 13. Contratos de API para Replicacao

## 13.1 `admin-content` (aulas e materiais)

Acoes relevantes:

- `list_lessons`
- `create_lesson`
- `update_lesson`
- `delete_lesson`
- `list_assets`
- `create_asset`
- `update_asset`
- `delete_asset`

Campos de aula:

- `lesson_type`, `youtube_url`, `text_content`, `estimated_minutes`, `starts_at`, `ends_at`, `lesson_status`

Campos de asset:

- `asset_type`, `storage_bucket`, `storage_path`, `external_url`, `allow_download`, `allow_stream`, `watermark_enabled`, `asset_status`

## 13.2 `admin-storage-upload`

`kind` usados neste dominio:

- `module_asset` (upload direto)
- `module_asset_signed_url` (upload assinado para video protegido)
- `module_asset_limits` (limite maximo configurado)

## 13.3 `generate-asset-access`

Entrada:

- `assetId`

Saida:

- `url`
- `mode` (`external_url` | `signed_url`)
- `allow_download`
- `allow_stream`
- `watermark_enabled`
- `expires_in_seconds` (quando assinado)

---

## 14. Checklist de Replicacao Exata

- [ ] Criar `product_lessons` com `lesson_type` incluindo `file`
- [ ] Reproduzir `module_assets` com regra XOR de origem
- [ ] Manter campo legado `youtube_url` como fonte universal de video
- [ ] Implementar marcador `asset:<uuid>` para video protegido
- [ ] Replicar parser de URL de video (YouTube + extensoes diretas)
- [ ] Replicar fluxo de signed upload para video protegido
- [ ] Replicar fluxo de acesso via Edge Function com URL temporaria
- [ ] Replicar renderizacao de `text_content` por blocos
- [ ] Replicar comportamento de aula `file` consumindo materiais do modulo
- [ ] Garantir que `allow_download` e decidido no backend
- [ ] Garantir auditoria de acesso a assets

---

## 15. Observacoes Criticas (Importantes para Copia Fiel)

1. O nome do campo `youtube_url` e legado, mas hoje ele guarda:
   - YouTube,
   - URL direta,
   - `asset:<uuid>`.
2. Aula `file` nao possui vinculo 1:1 com asset; depende do inventario de materiais do modulo.
3. Upload de ficheiro nao-video no modo `file` cai em `asset_type = "pdf"` no comportamento atual.
4. O player pode abrir links externos quando o asset usa `external_url`; isto reduz controlo comparado ao storage privado.

5. Para o projeto destino, manter este spec sem seeds editoriais: a migracao deve entregar apenas estrutura e seguranca.

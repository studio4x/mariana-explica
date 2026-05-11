# SPEC_R2_STORAGE_MIGRATION: Integracao Cloudflare R2 para Midia Privada (Guia de Implementacao Futura)

## 1. Objetivo

Preparar um guia tecnico para migrar o armazenamento e entrega de videos privados do LMS para Cloudflare R2, sem quebrar:

- regras de acesso por `access_grants`;
- fluxo de URL temporaria assinada via backend;
- player atual do aluno;
- fluxo administrativo de upload protegido.

Este documento e um plano de implementacao futura. Nao implica execucao imediata.

---

## 2. Base Canonica Utilizada

Documentos canônicos considerados:

1. `docs/Estrutura Inicial/03-arquitetura.md`
2. `docs/Estrutura Inicial/04-banco-dados.md`
3. `docs/Estrutura Inicial/05-backend-edge-functions.md`
4. `docs/Estrutura Inicial/10-autenticacao-seguranca.md`

Premissas obrigatorias herdadas desses docs:

- arquivos privados nao podem ser publicos por padrao;
- acesso a arquivo deve passar por validacao backend;
- `access_grants` e a fonte real de autorizacao;
- Edge Functions concentram regras sensiveis;
- qualquer mudanca estrutural de banco deve ir por migration versionada.

---

## 3. Escopo e Fora de Escopo

### Escopo desta migracao

- videos de aulas e materiais privados de modulo;
- URLs temporarias assinadas de leitura e upload;
- persistencia de metadados de storage no banco;
- compatibilidade com player atual.

### Fora de escopo inicial

- trocar o player de video;
- transcodificacao/DRM (Cloudflare Stream, HLS custom, etc.);
- alterar regra de negocio de compra/liberacao;
- remover Supabase Storage para outros tipos de asset.

---

## 4. Estado Atual (Resumo Tecnico)

### Fluxos atuais relevantes

- Upload admin protegido:
  - `supabase/functions/admin-storage-upload/index.ts`
  - `src/services/admin.service.ts`
  - `src/pages/admin/builder/CourseLessonDetailPanel.tsx`
- Acesso aluno ao asset:
  - `supabase/functions/generate-asset-access/index.ts`
  - `src/services/dashboard.service.ts` (`requestAssetAccess`)
  - `src/components/common/LessonPrimaryMedia.tsx`
- Acesso PDF de modulo:
  - `supabase/functions/generate-module-pdf-access/index.ts`

### Contrato de consumo no frontend

O player consome apenas URL retornada pelo backend. Isso permite trocar o provedor de storage sem trocar o componente de player, desde que o contrato da resposta continue compativel.

---

## 5. Arquitetura Alvo (R2 + Supabase)

### Decisao principal

- Supabase continua como fonte de verdade para Auth, banco, RLS, grants, auditoria e orquestracao.
- R2 passa a armazenar e servir videos privados em escala.
- Edge Functions continuam responsaveis por autorizar e emitir links temporarios.

### Principio de compatibilidade

Manter no frontend o fluxo:

1. frontend envia `assetId` para Edge Function;
2. backend valida sessao, role, status e grant;
3. backend retorna URL temporaria;
4. player reproduz URL.

---

## 6. Modelo de Dados Proposto

## 6.1 Mudancas em `module_assets`

Adicionar coluna:

- `storage_provider text not null default 'supabase'`

Valores permitidos:

- `supabase`
- `r2`

Recomendacao:

- check constraint para permitir somente os valores acima.

## 6.2 Mudancas em `product_modules` (PDF base)

Adicionar coluna:

- `module_pdf_storage_provider text not null default 'supabase'`

Valores permitidos:

- `supabase`
- `r2`

## 6.3 Backfill

- registros existentes recebem `supabase`;
- sem alteracao funcional imediata no comportamento atual.

## 6.4 Observacao

`storage_bucket` e `storage_path` continuam sendo usados. O significado muda conforme `storage_provider`.

---

## 7. Segredos e Configuracao

Definir em secrets de Edge Functions (nao em frontend):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PRIVATE_BUCKET`
- `R2_S3_ENDPOINT` (ex.: `https://<account_id>.r2.cloudflarestorage.com`)
- `R2_SIGNED_GET_EXPIRES_SECONDS` (ex.: `300`)
- `R2_SIGNED_PUT_EXPIRES_SECONDS` (ex.: `600`)
- `R2_MAX_FILE_SIZE_BYTES`

Observacoes:

- nunca expor credenciais R2 no cliente;
- usar `.env.local` apenas para desenvolvimento local e nunca versionar segredos.

---

## 8. Mudancas de Backend (Edge Functions)

## 8.1 Novo helper compartilhado

Criar `supabase/functions/_shared/storage-provider.ts` com interface unica:

- `createSignedGetUrl(...)`
- `createSignedPutUrl(...)`
- `deleteObject(...)`
- `buildObjectPath(...)`
- validacao de MIME e tamanho.

Objetivo:

- encapsular diferenca entre Supabase Storage e R2;
- evitar logica duplicada em varias functions.

## 8.2 `admin-storage-upload`

Arquivos:

- `supabase/functions/admin-storage-upload/index.ts`

Mudancas:

- manter fluxo atual para `supabase`;
- para `r2`, gerar pre-signed `PUT` (S3 signature v4);
- manter retorno compativel e incluir metadados de transporte:
  - `provider`
  - `upload_method`
  - `upload_url`
  - `upload_headers` (quando necessario)
- persistir `storage_provider` no registro criado/atualizado.

## 8.3 `generate-asset-access`

Arquivo:

- `supabase/functions/generate-asset-access/index.ts`

Mudancas:

- ler `storage_provider` do asset;
- manter validacoes atuais de acesso e grants;
- `supabase`: manter `createSignedUrl` atual;
- `r2`: emitir pre-signed `GET` com expiracao curta;
- incluir `provider` no log de auditoria.

## 8.4 `generate-module-pdf-access` (fase opcional)

Arquivo:

- `supabase/functions/generate-module-pdf-access/index.ts`

Mudancas futuras:

- suportar `module_pdf_storage_provider = 'r2'`;
- manter watermark e licenciamento do PDF no backend;
- retornar URL assinada temporaria conforme provider.

---

## 9. Mudancas de Frontend (Minimas e Compatibilidade)

Arquivos provaveis:

- `src/services/admin.service.ts`
- `src/pages/admin/builder/CourseLessonDetailPanel.tsx`
- `src/pages/admin/AdminProductContent.tsx` (se aplicavel)

Mudancas:

- no upload admin, aceitar dois modos de transporte:
  - Supabase signed upload (atual);
  - PUT direto para URL assinada R2.
- manter `requestAssetAccess` e player sem mudanca de contrato funcional.

Observacao:

`LessonPrimaryMedia` pode permanecer inalterado se seguir recebendo URL reproduzivel por `<video src="...">`.

---

## 10. Politica de Seguranca Obrigatoria

- bucket de videos em R2 deve ser privado;
- nenhum link permanente publico para video pago;
- URLs assinadas de curta duracao;
- autorizacao sempre no backend antes de assinar URL;
- decisao de download (`allow_download`) continua backend-driven;
- logs de auditoria para acesso de asset e geracao de link;
- revogacao de grant continua bloqueando emissao de novos links.

---

## 11. Rollout em Fases (Baixo Risco)

## Fase 0 - Preparacao

- criar migrations de colunas `*_storage_provider`;
- adicionar helper de storage provider;
- adicionar feature flag backend: `STORAGE_PROVIDER_DEFAULT`.

## Fase 1 - Dual-read / Single-write (Supabase)

- backend le provider, mas ainda grava `supabase`;
- comportamento em producao permanece igual.

## Fase 2 - Upload novo em R2

- habilitar `r2` apenas para novos videos de aula;
- manter leitura dual (`supabase` e `r2`).

## Fase 3 - Migracao de acervo (opcional)

- job idempotente para copiar assets existentes;
- atualizar `storage_provider` e `storage_path`;
- validar checksum/tamanho antes de marcar migrado.

## Fase 4 - Estabilizacao

- monitorar erros 401/403/404 e taxa de playback;
- revisar custos de egress e storage;
- documentar procedimento de rollback por asset.

---

## 12. Testes e Validacao

## 12.1 Casos obrigatorios

- aluno com grant ativo reproduz video (`200`);
- aluno sem grant recebe `403`;
- asset inativo/publicacao invalida segue bloqueio atual;
- admin upload de video > 50MB em R2 concluido;
- links expiram conforme TTL;
- `allow_download=false` nao permite download forçado;
- revogacao de grant bloqueia novas emissões de URL.

## 12.2 Observabilidade

Adicionar no metadata de auditoria:

- `storage_provider`
- `bucket`
- `storage_path`
- `signed_url_ttl_seconds`
- `mode` (`signed_url` / `external_url`)

---

## 13. Deploy e Ordem Segura

Quando for executar:

1. publicar/atualizar Edge Functions;
2. aplicar migrations de banco;
3. publicar frontend;
4. smoke tests de upload e playback;
5. confirmar ambiente `READY` e versao ativa correta.

---

## 14. Checklist de Execucao Futura

- [ ] credenciais e projeto confirmados via `.env.local`;
- [ ] migration versionada criada e revisada;
- [ ] helper de storage provider implementado;
- [ ] `admin-storage-upload` com suporte a R2;
- [ ] `generate-asset-access` com suporte a R2;
- [ ] frontend admin compativel com upload R2;
- [ ] testes de autorizacao/grants aprovados;
- [ ] logs e auditoria com provider ativos;
- [ ] rollout por feature flag documentado;
- [ ] plano de rollback validado.

---

## 15. Pendencias Conhecidas

- definir se PDFs de modulo entram no escopo inicial de R2 ou fase posterior;
- definir estrategia de migracao de acervo existente (com ou sem downtime logico por asset);
- definir dashboards de custo/egress para comparativo Supabase x R2 apos go-live.

# Handoff - Editor Visual

## Objetivo

Criar um novo **Editor Visual** paralelo ao editor de IA, com namespace proprio, sem alterar o fluxo legado de `site_pages/site_page_versions` nem o worker GitHub do editor de codigo.

## O que foi entregue

- Nova base de dados para o editor visual em `visual_site_*`.
- Nova rota administrativa `/admin/editor-visual`.
- Novo workspace visual para a pagina publica de suporte.
- Wrapper publico com `VisualEditorProvider` e `SiteContentScope`.
- Edição de:
  - titulo;
  - paragrafo;
  - botao / link;
  - imagem.

## Arquivos principais

- [`supabase/migrations/0043_visual_site_editor_foundation.sql`](../supabase/migrations/0043_visual_site_editor_foundation.sql)
- [`src/features/site-editor/visual-editor/context.tsx`](../src/features/site-editor/visual-editor/context.tsx)
- [`src/features/site-editor/visual-editor/api.ts`](../src/features/site-editor/visual-editor/api.ts)
- [`src/features/site-editor/visual-editor/page-definitions.ts`](../src/features/site-editor/visual-editor/page-definitions.ts)
- [`src/pages/public/Support.tsx`](../src/pages/public/Support.tsx)
- [`src/pages/admin/AdminVisualSiteEditor.tsx`](../src/pages/admin/AdminVisualSiteEditor.tsx)
- [`src/routes/index.tsx`](../src/routes/index.tsx)
- [`src/layouts/AdminLayout.tsx`](../src/layouts/AdminLayout.tsx)
- [`src/lib/constants.ts`](../src/lib/constants.ts)

## Comportamento

- O suporte publico continua funcionando com fallback seguro.
- Se existir conteudo publicado em `visual_site_pages/visual_site_page_versions`, a pagina usa esse conteúdo.
- O admin pode selecionar campos diretamente no preview e:
  - guardar rascunho;
  - publicar;
  - restaurar uma versao anterior.

## Validação

- `cmd /c npx vitest run src/pages/public/Support.test.tsx src/pages/admin/AdminVisualSiteEditor.test.tsx`
- `cmd /c npm run build`

## Pendências

- Criar o deploy remoto quando a equipa decidir publicar a mudanca.
- Se quiserem ampliar o editor para outras paginas publicas, basta adicionar novas definições em `src/features/site-editor/visual-editor/page-definitions.ts` e semear as tabelas do novo namespace.


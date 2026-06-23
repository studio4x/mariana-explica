# Handoff - Editor Visual

## Objetivo

Entregar um **Editor Visual** em paralelo ao editor de IA irrestrito, com namespace proprio, versionamento por pagina e publicacao segura para a pagina piloto `/suporte`.

## Diferença para o Editor IA Irrestrito

- O **Editor Visual** trabalha no conteudo publicado da pagina, com preview visual, selecao de campo no DOM e versionamento por pagina.
- O **Editor IA Irrestrito** continua sendo o fluxo administrativo de tarefas de codigo, prompts, diff, PR e rollback auditavel.
- Os dois ficam em paralelo porque atendem problemas diferentes:
  - o Visual Editor resolve edicao de conteudo/pagina;
  - o IA Irrestrito continua como fluxo de automacao e engenharia.

## Por que os dois ficam em paralelo

- O MVP visual ainda cobre apenas a pagina piloto.
- O editor de IA irrestrito nao foi substituido nem rebaixado.
- A Mariana pode evoluir o Visual Editor pagina a pagina sem quebrar o fluxo administrativo existente.

## Pagina piloto migrada

- Pagina piloto: `/suporte`.
- A pagina publica passou a suportar override publicado por banco com fallback hardcoded seguro.

## Elementos editáveis em `/suporte`

- `hero.eyebrow`
- `hero.title`
- `hero.lead`
- `hero.primaryCta`
- `hero.secondaryCta`
- `hero.image`
- `supportCta.title`
- `supportCta.lead`
- `supportCta.primaryCta`
- `supportCta.secondaryCta`

## Arquitetura escolhida

- SPA React + TypeScript + Vite.
- Editor visual montado no frontend, mas a fonte real de verdade fica no Supabase.
- O fluxo de escrita e publicacao usa banco e RLS, nao o frontend.
- O namespace do editor visual ficou separado para nao conflitar com o legado do builder/IA.

## Por que o namespace ficou em `visual_site_*`

- `visual_site_pages`
- `visual_site_page_versions`
- `visual_site_page_assets`

Motivos:

- evitar conflito com `site_pages/site_page_versions`;
- manter o piloto isolado do legado;
- facilitar futura expansao pagina a pagina;
- permitir versionamento e assets sem misturar domínios.

## Modelo de dados

- O MVP atual versiona a **pagina/estrutura publicada**.
- A granularidade editável existe dentro do JSON da pagina, por campos como `hero.title` e `supportCta.primaryCta.label`.
- Ou seja: o armazenamento é por pagina/versionamento, mas a edicao no editor ocorre por entradas/campos dentro desse documento.
- O modelo pode evoluir depois para uma granularidade ainda maior se houver necessidade.

## Diferença para o Genflix

- O Genflix trabalha com uma estrutura mais granular de conteúdo editável.
- A Mariana, neste MVP, usa um modelo mais simples e seguro:
  - pagina + versao;
  - JSON por pagina;
  - campos editáveis dentro dessa estrutura.
- Isso reduz complexidade inicial e mantém o piloto previsivel.
- A granularidade maior pode ser adicionada depois, se necessario.

## Fallback hardcoded

- Se nao houver override publicado no banco, `/suporte` continua renderizando o conteúdo hardcoded original.
- Esse fallback garante continuidade do site mesmo sem dados visuais publicados.
- O comportamento foi validado em produção.

## Publicação e restauração

- `Guardar rascunho` cria uma nova versao draft.
- `Publicar` promove a versao para publicada e atualiza `published_version_id`.
- `Restaurar` cria um novo draft a partir de uma versao anterior.
- A página publicada passa a apontar para a versao promovida.

## Proteção para visitante comum

- Visitante comum vê somente o conteúdo publicado.
- Controles visuais nao aparecem para usuario comum.
- RLS bloqueia escrita fora do backend/admin.
- A tentativa de escrita direta com usuario comum nao afetou `visual_site_pages`.

## RLS e policies criadas

- `visual_site_pages` com RLS habilitado.
- `visual_site_page_versions` com RLS habilitado.
- `visual_site_page_assets` com RLS habilitado.

Policies:

- `visual_site_pages_select_published`
- `visual_site_pages_select_admin`
- `visual_site_pages_admin_manage`
- `visual_site_page_versions_select_published`
- `visual_site_page_versions_select_admin`
- `visual_site_page_versions_admin_manage`
- `visual_site_page_assets_select_admin`
- `visual_site_page_assets_admin_manage`

## Como acessar o editor

- Editor visual admin: `/admin/editor-visual`
- Página piloto como admin: `/suporte`
- O menu admin passa a expor `Editor Visual`.
- O menu admin mantém `Editor IA Irrestrito`.

## Como testar em produção

Fluxo validado:

1. abrir `/admin/editor-visual`;
2. confirmar que o admin vê o workspace;
3. abrir `/suporte` como admin;
4. confirmar controles visuais;
5. editar um campo simples;
6. salvar e publicar;
7. verificar a página como visitante comum;
8. restaurar a versão anterior;
9. confirmar fallback hardcoded quando `published_version_id` é limpo;
10. confirmar que o editor de IA irrestrito continua carregando.

## Script de smoke

- [`scripts/visual-editor-prod-check.mjs`](../scripts/visual-editor-prod-check.mjs)

Ele valida:

- login admin e login comum;
- acesso a `/admin/editor-visual`;
- controles visuais em `/suporte`;
- edição, publicação e restauração;
- fallback hardcoded;
- bloqueio de escrita para usuario comum;
- rotas do Editor IA Irrestrito;
- redirecionamento de anônimo para `/login`.

## Deploy e publicação

- `gh-pages` foi ignorado.
- O fluxo oficial usado foi Vercel.
- A migration `0043_visual_site_editor_foundation` já foi aplicada e registrada no Supabase remoto.
- SHA ativo em produção: `04235e6372b8548e2bd52b44fbd3d73b4d2bf809`.
- Domínio canônico: `https://www.mariana-explica.pt`.
- O deploy de produção está `READY`.

## Histórico de smoke

- A página `/suporte` foi restaurada para a versão original 1.
- As versões temporárias de smoke permanecem apenas como histórico/auditoria.
- O histórico não invalida a entrega, desde que o `published_version_id` final aponte para a versão original publicada.

## Maintenance mode

- O `site_maintenance_mode` foi desligado para expor o conteúdo público normal.
- O estado ficou persistido no `site_config`.
- Esse é o comportamento desejado para produção neste momento, porque a página pública precisa ficar acessível.

## Editor IA Irrestrito

- Continua funcionando.
- As rotas administrativas foram validadas:
  - `/admin/editor-ia-irrestrito/chat`
  - `/admin/editor-ia-irrestrito/tasks`
  - `/admin/editor-ia-irrestrito/configuracao`

## Limitações atuais

- O piloto cobre apenas `/suporte`.
- O histórico de versões acumula entradas reais de smoke.
- A granularidade do modelo ainda é por pagina/documento, nao por bloco isolado fora do JSON.
- Falta expandir o editor para outras páginas publicas.

## Próximos passos

1. estabilizar `/suporte`;
2. migrar `/materiais`;
3. migrar `/explicacoes`;
4. migrar `/sobre`;
5. migrar `/home` por último;
6. só depois avaliar desativar o Editor IA Irrestrito como editor principal.

## Validação executada

- `node scripts/visual-editor-prod-check.mjs`
- `cmd /c npm.cmd run build`

## Status final

- Build `1.0.0-132-editor-visual`: concluída e validada.
- Publicação em Vercel: concluída.
- Produção: ativa e acessível.

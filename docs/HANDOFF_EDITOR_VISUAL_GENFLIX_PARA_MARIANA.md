# Handoff - Editor Visual

## Objetivo

Entregar o **Editor Visual** em paralelo ao **Editor IA Irrestrito**, com namespace proprio, versionamento por pagina e publicacao segura. Nesta fase o foco deixou de ser expandir novas paginas e passou a corrigir a experiencia real de edicao por clique, com sidebar fixa na pagina publica.

## Diferenca para o Editor IA Irrestrito

- O **Editor Visual** trabalha no conteudo publicado da pagina, com preview visual, selecao de campo no DOM e versionamento por pagina.
- O **Editor IA Irrestrito** continua sendo o fluxo administrativo de tarefas de codigo, prompts, diff, PR e rollback auditavel.
- Os dois ficam em paralelo porque atendem problemas diferentes:
  - o Visual Editor resolve edicao de conteudo/pagina;
  - o IA Irrestrito continua como fluxo de automacao e engenharia.

## Por que os dois ficam em paralelo

- O MVP visual ainda cobre apenas paginas publicas selecionadas.
- O editor de IA irrestrito nao foi substituido nem rebaixado.
- A Mariana pode evoluir o Visual Editor pagina a pagina sem quebrar o fluxo administrativo existente.

## Problema encontrado

- Os elementos editaveis ja marcavam selecao, mas o clique nao abria uma experiencia de edicao util na pagina publica.
- A selecao ficava invisivel para o admin porque faltava uma sidebar fixa consumindo esse estado.
- Na pratica, o usuario clicava e parecia que nada acontecia.
- A causa raiz nao era o clique em si, e sim a ausencia de uma superficie de edicao conectada ao estado selecionado.

## Paginas piloto migradas

- `/suporte` segue como a pagina piloto original do projeto.
- `/materiais` foi adicionada nesta fase como segunda pagina visual.
- A pagina publica continua com fallback hardcoded seguro quando nao ha override publicado no banco.

## Elementos editaveis

### `/suporte`

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

### `/materiais`

- `hero.eyebrow`
- `hero.title`
- `hero.lead`
- `hero.primaryCta`
- `catalogHelpCta.label`
- `catalogHelpCta.href`
- `supportCta.title`
- `supportCta.lead`
- `supportCta.primaryCta`
- `supportCta.secondaryCta`
- `faq.eyebrow`
- `faq.title`

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
- facilitar expansao pagina a pagina;
- permitir versionamento e assets sem misturar dominios.

## Modelo de dados

- O MVP atual versiona a **pagina/estrutura publicada**.
- A granularidade editavel existe dentro do JSON da pagina, por campos como `hero.title`, `catalogHelpCta.label` e `supportCta.primaryCta.label`.
- Ou seja: o armazenamento e por pagina/versionamento, mas a edicao no editor ocorre por entradas/campos dentro desse documento.
- O modelo pode evoluir depois para uma granularidade ainda maior se houver necessidade.

## Diferenca para o Genflix

- O Genflix trabalha com uma estrutura mais granular de conteudo editavel.
- A Mariana, neste MVP, usa um modelo mais simples e seguro:
  - pagina + versao;
  - JSON por pagina;
  - campos editaveis dentro dessa estrutura.
- Isso reduz complexidade inicial e mantem o piloto previsivel.
- A granularidade maior pode ser adicionada depois, se necessario.

## Fallback hardcoded

- Se nao houver override publicado no banco, as paginas continuam renderizando o conteudo hardcoded original.
- Esse fallback garante continuidade do site mesmo sem dados visuais publicados.
- O comportamento foi validado em producao.

## Publicacao e restauracao

- `Guardar rascunho` cria uma nova versao draft.
- `Publicar` promove a versao para publicada e atualiza `published_version_id`.
- `Restaurar` cria um novo draft a partir de uma versao anterior.
- A pagina publicada passa a apontar para a versao promovida.

## Protecao para visitante comum

- Visitante comum ve somente o conteudo publicado.
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
- Pagina visual como admin: `/suporte`
- Pagina visual como admin: `/materiais`
- O menu admin expõe `Editor Visual`.
- O menu admin mantem `Editor IA Irrestrito`.

## Como testar em producao

Fluxo validado:

1. abrir `/admin/editor-visual` ou `/admin/editor-visual/materials`;
2. confirmar que o admin ve o workspace;
3. abrir `/suporte` e `/materiais` como admin;
4. clicar em um titulo, botao, link ou imagem editavel;
5. confirmar que a sidebar lateral abre;
6. editar um campo simples;
7. salvar e publicar;
8. verificar a pagina como visitante comum;
9. restaurar a versao anterior;
10. confirmar fallback hardcoded quando `published_version_id` e limpo;
11. confirmar que o editor de IA irrestrito continua carregando.

## Smoke de producao

### Harness permanente

- [`scripts/visual-editor-prod-check.mjs`](../scripts/visual-editor-prod-check.mjs)

Ele valida:

- login admin e login comum;
- acesso a `/admin/editor-visual`;
- controles visuais em `/suporte`;
- edicao, publicacao e restauracao;
- fallback hardcoded;
- bloqueio de escrita para usuario comum;
- rotas do Editor IA Irrestrito;
- redirecionamento de anonimo para `/login`.

### Smoke desta fase

- A validacao desta fase foi executada em producao com um smoke temporario equivalente, cobrindo clique, abertura da sidebar, edicao, salvamento, publicacao, restauracao e fallback em `/suporte` e `/materiais`.
- As alteracoes temporarias de smoke permaneceram apenas como historico/auditoria e as paginas foram restauradas ao estado original final.
- A parte autenticada do smoke ficou limitada pelo fixture temporario de login comum, entao o arquivo de auditoria nao e tratado como prova final de fluxos de autenticacao humana para esse usuario.

## Deploy e publicacao

- `gh-pages` foi ignorado.
- O fluxo oficial usado foi Vercel.
- A migration `0043_visual_site_editor_foundation` foi aplicada e registrada no Supabase remoto.
- A migration `0044_visual_site_editor_materials_page` foi aplicada e registrada no Supabase remoto.
- SHA de implementacao funcional do editor visual: `51fefe64b3feaf1446c932331efa8f91b1d5d2e5`.
- SHA do deploy atualmente ativo em producao: `96151d8cc54aefd2c72989e3259c5b0b007dbed7`.
- A publicacao final em producao foi reimplantada pela Vercel com o commit de documentacao final desta entrega.
- Dominio canonico: `https://www.mariana-explica.pt`
- O deploy de producao ficou `READY`.

## Historico de smoke

- A pagina `/suporte` foi restaurada para a versao original 1.
- A pagina `/materiais` foi restaurada para a versao original 1.
- As versoes temporarias de smoke permanecem apenas como historico/auditoria.
- O historico nao invalida a entrega, desde que o `published_version_id` final aponte para a versao original publicada.

## Maintenance mode

- O `site_maintenance_mode` foi desligado para expor o conteudo publico normal.
- O estado ficou persistido no `site_config`.
- Esse e o comportamento desejado para producao neste momento, porque a pagina publica precisa ficar acessivel.

## Editor IA Irrestrito

- Continua funcionando.
- As rotas administrativas foram validadas:
  - `/admin/editor-ia-irrestrito/chat`
  - `/admin/editor-ia-irrestrito/tasks`
  - `/admin/editor-ia-irrestrito/configuracao`

## Limitacoes atuais

- O piloto agora cobre `/suporte` e `/materiais`.
- O historico de versoes acumula entradas reais de smoke.
- A granularidade do modelo ainda e por pagina/documento, nao por bloco isolado fora do JSON.
- A sidebar cobre texto, textarea, link e imagem; listas e JSON ainda sao evolucoes futuras, se forem necessarias.
- No mobile, a sidebar vira drawer inferior simples.
- Falta expandir o editor para outras paginas publicas.
- O smoke autenticado comum precisa de um fixture de login mais robusto para ser repetido de ponta a ponta sem depender de login temporario fraco.

## Proximos passos

1. estabilizar `/suporte`;
2. migrar `/materiais`;
3. migrar `/explicacoes`;
4. migrar `/sobre`;
5. migrar `/home` por ultimo;
6. so depois avaliar desativar o Editor IA Irrestrito como editor principal.

## Validacao executada

- `node scripts/visual-editor-prod-check.mjs`
- smoke temporario de navegador para a sidebar em `/suporte` e `/materiais`
- `cmd /c npm.cmd run build`
- `cmd /c npm.cmd test`

## Status final

- Build `1.0.0-134-visual-editor-sidebar`: concluida e validada.
- Publicacao em Vercel: concluida e reimplantada no commit final de documentacao.
- Producao: ativa e acessivel.

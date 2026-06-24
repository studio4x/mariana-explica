# Handoff - Editor Visual

## Objetivo

Entregar o **Editor Visual** em paralelo ao **Editor IA Irrestrito**, com namespace proprio, versionamento por pagina e publicacao segura. Nesta fase o foco deixou de ser expandir novas paginas e passou a corrigir a experiencia real de edicao por clique, com sidebar fixa na pagina publica.

## Diferenca para o Editor IA Irrestrito

- O **Editor Visual** trabalha no conteudo publicado da pagina, com preview visual, selecao de campo no DOM e versionamento por pagina.
- O **Editor Visual** agora versiona conteudo e estilo juntos: `entries_json` guarda o documento da pagina e `style_json` guarda os overrides visuais do campo selecionado.
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
- O estilo tambem segue o mesmo principio: cada versao carrega o documento visual salvo em `style_json`, sem depender de CSS global fora da versao.
- O dirty state do editor considera `document` e `styles`; alterar apenas estilo agora habilita guardar rascunho e publica uma nova versao corretamente.

## Edicao visual

- A sidebar do editor agora tem tres abas:
  - `Conteudo` para editar os valores do campo;
  - `Estilo` para ajustar tipografia, cores, espacamento, imagem e botoes;
  - `Avancado` para ver resumo tecnico, fallback hardcoded e versoes recentes.
- Os controles de estilo sao propositalmente limitados a entradas seguras, sem permitir CSS arbitrario no fluxo visual.
- O editor continua livre no fluxo de IA irrestrito, mas o editor visual nao expande permissao alem do que a pagina e a policy ja permitem.
- O `style_json` nao exige migration nova neste ciclo: ele ja existe como coluna real em `public.visual_site_page_versions`, criada pela migration `0043_visual_site_editor_foundation`.

## Propriedades suportadas

### Texto / titulo

- cor do texto;
- cor de fundo;
- familia tipografica;
- tamanho da fonte;
- peso da fonte;
- altura da linha;
- espacamento entre letras;
- alinhamento;
- transformacao de texto;
- estilo tipografico normal ou italico;
- tag `H1` a `H6` para campos de titulo;
- reset do estilo para o fallback hardcoded.

### Botao / link

- cor do texto;
- cor de fundo;
- familia tipografica;
- tamanho da fonte;
- peso da fonte;
- border radius;
- border width;
- border style;
- border color;
- padding horizontal;
- padding vertical;
- sombra;
- alinhamento;
- reset do estilo para o fallback hardcoded.

### Imagem

- border radius;
- width;
- height;
- max width;
- object fit (`cover` ou `contain`);
- sombra.

### Container

- o container pratico atual e o wrapper da imagem ou do CTA;
- ele suporta border radius, width, height, max width e sombra;
- ainda nao existe editor livre de padding/background para container generico neste ciclo.

## Validacao e whitelist

- Valores invalidos de cor sao descartados.
- Valores invalidos de fonte, peso, alinhamento, transformacao, border style, object fit e heading tag sao normalizados ou removidos.
- Comprimentos aceitam apenas valores com unidade segura (`px`, `rem`, `em`, `%`) ou numeros convertidos para a unidade padrao do campo.
- Nao existe entrada de CSS arbitrario no fluxo visual.
- O estilo salvo e um documento estruturado por campo, nao uma string de CSS livre.

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
- Conteudo e estilo sao publicados juntos no mesmo salvamento de versao. Se a versao for restaurada ou revertida para fallback hardcoded, o estilo salvo junto tambem volta ao estado correspondente da versao ou desaparece junto com o conteudo publicado.
- O reset de estilo remove apenas o override do campo e retorna ao fallback hardcoded da pagina.

## Protecao para visitante comum

- Visitante comum ve somente o conteudo publicado.
- Controles visuais nao aparecem para usuario comum.
- RLS bloqueia escrita fora do backend/admin.
- A tentativa de escrita direta com usuario comum nao afetou `visual_site_pages`.
- Visitante comum nao ve controles, nao abre sidebar e nao publica estilo porque a edicao exige o estado autenticado/admin e a protecao de RLS continua no banco.

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
7. abrir a aba `Estilo` e ajustar pelo menos uma propriedade visual segura;
8. salvar e publicar;
9. verificar a pagina como visitante comum;
10. restaurar a versao anterior;
11. confirmar fallback hardcoded quando `published_version_id` e limpo;
12. confirmar que o editor de IA irrestrito continua carregando.

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
- O bug de `isDirty` que olhava apenas `document` foi corrigido e o smoke desta rodada validou alteracao somente de estilo em `/suporte` e `/materiais`, com persistencia apos publicacao e reload.
- As alteracoes temporarias de smoke permaneceram apenas como historico/auditoria e as paginas foram restauradas ao estado original final.
- A parte autenticada do smoke ficou limitada pelo fixture temporario de login comum, entao o arquivo de auditoria nao e tratado como prova final de fluxos de autenticacao humana para esse usuario.

## Deploy e publicacao

- `gh-pages` foi ignorado.
- O fluxo oficial usado foi Vercel.
- A migration `0043_visual_site_editor_foundation` foi aplicada e registrada no Supabase remoto.
- A migration `0044_visual_site_editor_materials_page` foi aplicada e registrada no Supabase remoto.
- SHA de implementacao funcional do editor visual: `f7ebe05f9b3b34a46591c48f0f23eb7684dd00ab`.
- SHA do deploy atualmente ativo em producao: `f7ebe05f9b3b34a46591c48f0f23eb7684dd00ab`.
- A publicacao final em producao foi reimplantada pela Vercel com o commit de documentacao final desta entrega.
- Dominio canonico: `https://www.mariana-explica.pt`
- O deploy de producao ficou `READY`.

## Historico de smoke

- A pagina `/suporte` foi restaurada para a versao original 1.
- A pagina `/materiais` foi restaurada para a versao original 1.
- As versoes temporarias de smoke permanecem apenas como historico/auditoria.
- O historico nao invalida a entrega, desde que o `published_version_id` final aponte para a versao original publicada.
- O smoke desta etapa precisa provar persistencia apos reload, estilo publicado no anonimo e retorno ao fallback/original para encerrar a entrega.

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
- A sidebar cobre tambem controles basicos de estilo por campo, mas ainda nao permite CSS livre.
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

- Build `1.0.0-137-visual-editor-style-dirty-state`: concluida e validada.
- Publicacao em Vercel: concluida e reimplantada no commit final de documentacao.
- Producao: ativa e acessivel.

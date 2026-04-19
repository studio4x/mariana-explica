# Proximas Etapas — Modulo de Cursos

## 1. Objetivo

Este documento organiza as proximas etapas do modulo de cursos da plataforma Mariana Explica.

Ele deve ser usado como guia operacional para executar uma etapa por vez, sempre validando antes se aquela etapa:

- ainda nao foi iniciada;
- ja foi feita parcialmente;
- ja foi concluida.

## 2. Base documental

Este plano depende principalmente de:

- `docs/02-regras-negocio.md`
- `docs/03-arquitetura.md`
- `docs/08-dashboard.md`
- `docs/09-admin.md`
- `docs/10-autenticacao-seguranca.md`
- `docs/15-plano-de-implementacao.md`
- `docs/Specs/course-module-spec.md` como referencia auxiliar

## 3. Regra de execucao por etapa

Antes de iniciar qualquer etapa, seguir sempre esta ordem:

1. Identificar os documentos que governam a etapa.
2. Verificar no codigo, banco, funcoes e rotas se a etapa ja foi feita.
3. Classificar a etapa como `pendente`, `parcial` ou `concluida`.
4. Se estiver `parcial`, registrar o que ja existe e terminar apenas o que falta.
5. Se estiver `concluida`, marcar neste documento e nao reimplementar.
6. Implementar, validar e fazer obrigatoriamente os deploys necessarios ao concluir a etapa, seguindo a ordem segura definida em `docs/14-deploy.md`.
7. Atualizar este documento ao final da etapa.
8. Perguntar explicitamente se podemos seguir para a proxima etapa.

## 4. Legenda de status

- `concluida`: etapa entregue e validada
- `parcial`: existe implementacao relevante, mas ainda faltam partes criticas
- `pendente`: etapa ainda nao entregue

## 5. Etapas

### Etapa 0 — Tela `/admin/cursos` alinhada a spec

- Status: `concluida`
- Situacao atual:
  - a tela administrativa passou a seguir a estrutura da spec para `/admin/cursos`;
  - o fluxo usa o termo visivel `cursos` na area admin ajustada;
  - foram entregues criacao, edicao basica, importacao JSON, exportacao, exclusao protegida e abertura do construtor;
  - a publicacao necessaria ja foi feita em GitHub, Supabase e Vercel.
- Validacao esperada:
  - `tsc`
  - `vite build`
  - deploy da Edge Function `admin-products`
  - deploy frontend na Vercel

### Etapa 1 — Avaliacoes oficiais do aluno

- Status: `concluida`
- Verificacao inicial antes da execucao:
  - existe tela do aluno com renderizacao de `builder_payload` e resultado local de rascunho;
  - nao existem migrations para tentativas e respostas de avaliacao;
  - nao existem Edge Functions de inicio, salvamento ou submissao oficial de tentativa;
  - o frontend ainda informa explicitamente que a nota oficial depende de backend futuro.
- O que ja existe:
  - o player do aluno renderiza `builder_payload`;
  - existe navegacao para quizzes de modulo e avaliacao final;
  - existe resultado local de rascunho no frontend.
- O que falta para concluir:
  - modelagem oficial de tentativas e respostas no banco;
  - backend para iniciar tentativa, submeter respostas e devolver resultado oficial;
  - controle seguro de `max_attempts`, score e aprovacao;
  - integracao do player do aluno com o backend oficial;
  - persistencia de historico e reabertura correta da tentativa.
- Verificacao obrigatoria antes de iniciar:
  - procurar migrations de tentativas e respostas;
  - procurar Edge Functions ou services de submissao de avaliacao;
  - conferir se a nota ainda esta sendo calculada apenas localmente.
- Criterio de conclusao:
  - o aluno responde quiz e recebe resultado oficial do backend;
  - tentativas sao persistidas;
  - frontend nao decide nota final sozinho.
- Entregue nesta etapa:
  - migration `0010_assessment_attempts.sql` com persistencia oficial de tentativas;
  - funcao SQL `can_access_product_assessment`;
  - Edge Function `student-assessment-attempts` para iniciar, salvar rascunho e submeter tentativa;
  - score oficial no backend para questoes autoavaliaveis;
  - fluxo de `pending_review` para respostas que exigem revisao manual;
  - integracao do player do aluno com tentativa oficial, autosave e resultado persistido.
- Validacoes e deploys executados:
  - `tsc`
  - `vite build`
  - `supabase db push --linked --include-all`
  - deploy da Edge Function `student-assessment-attempts`
  - deploy frontend na Vercel

### Etapa 2 — Builder completo de avaliacoes no admin

- Status: `concluida`
- O que ja existe:
  - painel de resumo de avaliacoes;
  - rota dedicada por avaliacao;
  - leitura e interpretacao do `builder_payload`;
  - configuracoes do curso para tipos de quiz.
- Verificacao inicial desta rodada:
  - nao havia mutations reais no frontend para criar, atualizar ou excluir `product_assessments` via backend dedicado;
  - a listagem de avaliacoes no builder era principalmente leitura e resumo operacional;
  - a rota profunda da avaliacao mostrava metadados e payload, mas nao permitia edicao completa;
  - a importacao de curso ainda inseria `product_assessments` diretamente pelo cliente.
- Verificacao obrigatoria antes de iniciar:
  - procurar mutations reais para criar e atualizar `product_assessments`;
  - verificar se ainda existem apenas telas de resumo;
  - revisar se o builder legado ainda concentra partes desse fluxo.
- Criterio de conclusao:
  - o admin consegue criar e editar quizzes pelo builder sem manipular payload bruto.
- Entregue nesta rodada:
  - Edge Function `admin-content` ampliada com `list_assessments`, `create_assessment`, `update_assessment` e `delete_assessment`;
  - validacao de admin, consistencia entre curso/modulo e auditoria para mutacoes de avaliacao;
  - leitura de avaliacoes no frontend migrada para a Edge Function dedicada;
  - mutations React Query para criar, editar e excluir avaliacoes;
  - painel `/builder/assessments` transformado em workspace operacional para criar avaliacao final e quizzes de modulo;
  - importacao e exportacao JSON de avaliacao no builder;
  - editor real de perguntas com tipos, alternativas, gabarito, pontuacao, tentativas e ordenacao;
  - rota profunda de avaliacao reaproveitando o mesmo editor operacional;
  - importacao de curso ajustada para criar `product_assessments` via backend, sem insert direto do cliente.
- Validacoes executadas:
  - `npm run build`
- Deploys executados nesta rodada:
  - deploy das Edge Functions `admin-content`, `generate-asset-access`, `generate-module-pdf-access` e `admin-storage-upload` no projeto Supabase `gookhgufsxeplelpdaua`;
  - verificacao remota das funcoes novas por resposta `401` sem header de autorizacao, confirmando endpoint publicado e protegido;
  - deploy frontend na Vercel com producao pronta em `https://www.mariana-explica.pt`;
  - verificacao HTTP do dominio publico com `200 OK`.
- Deploys tentados nesta rodada:
  - deploy da Edge Function `admin-content` no Supabase;
  - deploy frontend na Vercel.
- Atualizacao posterior de deploy:
  - deploy da Edge Function `admin-content` confirmado no projeto Supabase `gookhgufsxeplelpdaua` com token de acesso valido;
  - a verificacao remota da rota `functions/v1/admin-content` voltou com execucao no `supabase-edge-runtime`, confirmando funcao publicada;
  - deploy frontend confirmado na Vercel com alias ativo em `https://www.mariana-explica.pt`;
  - verificacao HTTP do dominio publico retornou `200 OK`;
  - codigo da etapa publicado em GitHub no commit `842ed3c`.

### Etapa 3 — Progressao linear e bloqueios pedagogicos reais

- Status: `concluida`
- O que ja existe:
  - campo `has_linear_progression` no curso;
  - funcoes SQL de acesso a modulo e aula;
  - comunicacao dessa regra em telas publicas, admin e detalhe do aluno.
- Verificacao inicial desta rodada:
  - as funcoes SQL de acesso ainda aplicavam grant e agenda, mas nao exigiam conclusao real da trilha anterior;
  - o player do aluno misturava navegacao e conteudo completo, o que ocultava itens bloqueados via RLS em vez de mostra-los como bloqueados;
  - a pagina de aula ainda dependia de contexto antigo com conteudo completo e materiais, sem separacao segura entre resumo e payload protegido.
- O que falta para concluir:
  - validar o fluxo completo em producao com aluno real, incluindo desbloqueio sequencial apos concluir aulas e quizzes.
- Verificacao obrigatoria antes de iniciar:
  - confirmar se `can_access_product_lesson` e `can_access_product_module` ja aplicam sequencia real ou apenas grant e agenda;
  - revisar o player do aluno para saber se a navegacao ainda permite pular ordem.
- Criterio de conclusao:
  - o aluno nao consegue furar a ordem quando a progressao linear estiver ativa.
- Entregue nesta rodada:
  - migration `0011_linear_progression_guards.sql` com reforco de progressao linear no banco para modulos, aulas e avaliacoes;
  - nova Edge Function `student-course-navigation` para devolver trilha navegavel com itens desbloqueados e bloqueados sem expor conteudo protegido;
  - player do aluno atualizado para exibir bloqueios pedagogicos em modulos, aulas e quizzes;
  - paginas de aula e avaliacao separadas entre resumo navegavel e consulta protegida do conteudo completo;
  - navegacao do player ajustada para sugerir apenas o proximo item efetivamente desbloqueado.
- Validacoes executadas:
  - `npm run build`
  - verificacao remota das migrations com `npx supabase migration list --linked`
  - verificacao do dominio publico `https://www.mariana-explica.pt` com `200 OK`
- Deploys executados:
  - deploy da Edge Function `student-course-navigation` no projeto Supabase `gookhgufsxeplelpdaua`
  - `supabase db push --linked --include-all` com aplicacao da migration `0011_linear_progression_guards.sql`
  - deploy frontend na Vercel com producao pronta em `https://www.mariana-explica.pt`

### Etapa 4 — PDF base do modulo e materiais protegidos

- Status: `concluida`
- O que ja existe:
  - campos de PDF base por modulo;
  - gestor de materiais no admin;
  - Edge Function `generate-asset-access`;
  - acesso a materiais por signed URL.
- Verificacao inicial desta rodada:
  - o PDF base do modulo existia apenas como metadata manual (`storage_path` e nome) sem upload operacional no admin;
  - os materiais do modulo tambem dependiam de bucket/path digitados manualmente, sem fluxo real de upload privado;
  - o aluno conseguia abrir `module_assets` por signed URL, mas o PDF base do modulo nao aparecia no player nem na central de downloads;
  - havia flag de `watermark_enabled` nos materiais, mas sem tratamento especifico para o PDF base do modulo.
- Verificacao obrigatoria antes de iniciar:
  - confirmar se o PDF base hoje e apenas metadata ou se ja existe download licenciado real;
  - revisar buckets e regras de storage.
- Criterio de conclusao:
  - materiais privados usam fluxo seguro e o PDF base gera acesso licenciado por aluno.
- Entregue nesta rodada:
  - Edge Function `admin-storage-upload` para upload administrativo de PDF base e materiais do modulo em bucket privado;
  - limpeza de ficheiros antigos no `admin-content` ao substituir ou remover PDF base e materiais privados;
  - Edge Function `generate-module-pdf-access` atualizada para gerar uma copia derivada do PDF base com watermark visual antes da URL assinada;
  - auditoria de acesso para PDF base do modulo e para `module_assets` servidos por signed URL;
  - builder do modulo atualizado com upload real do PDF base;
  - gestor de materiais atualizado com upload real para assets privados do modulo;
  - integracao do PDF base do modulo no detalhe do curso, no player da aula, na tela de detalhe do dashboard e na central de downloads;
  - configuracao administrativa no painel para definir manualmente o nome do site e o logotipo privado usados no watermark do PDF base.
- Validacoes executadas:
  - `npm run build`
  - deploy no Supabase das Edge Functions `admin-storage-upload` e `generate-module-pdf-access`
  - verificacao remota de `generate-module-pdf-access` com resposta `401` sem autenticacao, confirmando endpoint ativo e protegido

### Etapa 5 — Limpeza final do legado e padronizacao de linguagem

- Status: `concluida`
- O que ja existe:
  - rotas publicas, do aluno e do admin principais ja usam `cursos`;
  - o admin visivel foi ajustado para `cursos`.
- Verificacao inicial desta rodada:
  - a busca por `produto`, `produtos` e `product` confirmou que o legado visivel restante estava concentrado em textos de autenticacao, perfil e principalmente nas narrativas publicas de apresentacao do curso;
  - a busca tambem confirmou que `Product*`, `product_id`, services e nomes de schema continuam amplamente usados como nomes tecnicos internos e nao devem ser renomeados nesta etapa para evitar quebra de compatibilidade;
  - a navegacao principal do dashboard e do admin ja estava padronizada em `cursos`, entao o ajuste restante era de linguagem exposta e de documentacao da decisao.
- Criterio de conclusao:
  - a linguagem visivel ao usuario e ao admin fica consistente com `curso(s)`.
- Entregue nesta rodada:
  - textos residuais de login, registo e preferencias do aluno ajustados de `produto(s)` para `curso(s)`;
  - narrativa publica de catalogo e detalhe padronizada para `curso`, `curso digital`, `curso gratuito` e `abrir curso` nos pontos expostos ao utilizador;
  - decisao de dominio explicitada: `curso` fica como linguagem oficial de interface; `product`, `products`, `product_id` e tipos `Product*` permanecem apenas como legado tecnico interno em codigo, banco e contratos.
- Validacoes executadas:
  - busca por `produto`, `produtos`, `product` nas camadas visiveis de UI antes e depois da limpeza;
  - `npm run build`

### Etapa 6 — Varredura final por contratos de aceite

- Status: `concluida`
- Objetivo:
  - confrontar a implementacao com os contratos de aceite da spec e com os docs canonicos.
- Entregas esperadas:
  - checklist por fluxo admin, aluno, compra e seguranca;
  - registro do que esta concluido, parcial ou bloqueado;
  - lista curta de ajustes finais restantes;
  - nova rodada de validacao e deploy.
- Criterio de conclusao:
  - o modulo de cursos fica com status claro de pronto, parcial ou bloqueado por item.
- Verificacao inicial desta rodada:
  - as etapas 1, 2, 3 e 5 ja estavam fechadas, e a etapa 4 ficou pronta nesta rodada com watermark visual aplicado sobre a copia derivada do PDF base;
  - o codigo atual ja cobre rotas, builder, player, checkout Stripe, webhook, grants, suporte, notificacoes, cupons, afiliados e pedidos administrativos, entao a varredura passou a ser de aceite e consistencia final;
  - a rodada foi usada para fechar os dois gaps finais que ainda restavam: watermark visual do PDF base e revogacao automatica por webhook para refund/chargeback.
- Checklist desta rodada:
  - `admin`: `concluido`
    - criacao, edicao basica, importacao/exportacao, builder, modulos, aulas, avaliacoes, liberacoes, pedidos, suporte, cupons, afiliados e utilizadores existem com backend dedicado e auditoria nas acoes sensiveis principais.
  - `aluno`: `concluido`
    - dashboard, detalhe do curso, player, bloqueios pedagogicos, progresso, anotacoes, downloads protegidos, PDF base do modulo e tentativas oficiais de avaliacao estao operacionais.
  - `compra`: `concluido`
    - checkout Stripe, webhook de confirmacao, claim de curso gratuito, grants e operacao administrativa de pedidos estao entregues;
    - o webhook Stripe agora revoga grant e cancela referral convertido automaticamente quando recebe refund integral ou chargeback/disputa com retirada de fundos.
  - `seguranca`: `concluido`
    - auth, admin backend, RLS, signed URL, grants via backend e score oficial de avaliacao estao entregues;
    - o PDF base do modulo agora e entregue como copia derivada com watermark visual, mantendo acesso licenciado, auditavel e sem expor o binario original ao aluno.
- Ajustes e consolidacoes desta rodada:
  - correcao do texto residual no player de avaliacao para refletir que a tentativa oficial ja e decidida pelo backend;
  - correcao documental da Edge Function de upload da etapa 4 para `admin-storage-upload`, alinhando documento e codigo real;
  - configuracao operacional no admin para definir manualmente o nome do site e o logotipo do watermark;
  - endurecimento do webhook Stripe para tratar `charge.refunded`, `charge.dispute.created` e `charge.dispute.funds_withdrawn` com revogacao automatica de acesso.
- Lista curta de ajustes finais restantes:
  - sem pendencias abertas no modulo de cursos dentro do escopo desta etapa.
- Validacoes executadas:
  - leitura comparativa entre docs canonicos e implementacao atual de admin, aluno, compra e seguranca;
  - busca no codigo pelos fluxos criticos de checkout, webhook, grants, suporte, pedidos e player;
  - `npm run build`
  - deploy no Supabase das Edge Functions `payment-webhook`, `admin-storage-upload` e `generate-module-pdf-access`
  - verificacao remota de `generate-module-pdf-access` e `payment-webhook` com resposta `401` sem autenticacao, confirmando endpoints ativos e protegidos

## 6. Ordem recomendada a partir de agora

1. Etapa 1 — Avaliacoes oficiais do aluno
2. Etapa 2 — Builder completo de avaliacoes no admin
3. Etapa 3 — Progressao linear e bloqueios pedagogicos reais
4. Etapa 4 — PDF base do modulo e materiais protegidos
5. Etapa 5 — Limpeza final do legado e padronizacao de linguagem
6. Etapa 6 — Varredura final por contratos de aceite

## 7. Regra de manutencao deste documento

Ao finalizar qualquer etapa:

1. atualizar o `Status`;
2. registrar o que foi encontrado na verificacao inicial;
3. resumir o que foi entregue;
4. executar obrigatoriamente os deploys necessarios da etapa concluida antes de encerrar o trabalho;
5. informar validacoes e deploys executados;
6. perguntar se podemos seguir para a proxima etapa.

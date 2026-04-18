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
6. Implementar, validar e fazer os deploys necessarios.
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

- Status: `parcial`
- O que ja existe:
  - painel de resumo de avaliacoes;
  - rota dedicada por avaliacao;
  - leitura e interpretacao do `builder_payload`;
  - configuracoes do curso para tipos de quiz.
- O que falta para concluir:
  - criar avaliacao final e quizzes de modulo pelo builder;
  - editar perguntas, alternativas, gabarito, nota minima e tentativas;
  - ordenar perguntas;
  - importar e exportar JSON da avaliacao;
  - excluir avaliacao com seguranca;
  - refletir tudo em backend dedicado, sem depender de edicao manual de payload.
- Verificacao obrigatoria antes de iniciar:
  - procurar mutations reais para criar e atualizar `product_assessments`;
  - verificar se ainda existem apenas telas de resumo;
  - revisar se o builder legado ainda concentra partes desse fluxo.
- Criterio de conclusao:
  - o admin consegue criar e editar quizzes pelo builder sem manipular payload bruto.

### Etapa 3 — Progressao linear e bloqueios pedagogicos reais

- Status: `parcial`
- O que ja existe:
  - campo `has_linear_progression` no curso;
  - funcoes SQL de acesso a modulo e aula;
  - comunicacao dessa regra em telas publicas, admin e detalhe do aluno.
- O que falta para concluir:
  - bloquear navegacao para aulas futuras quando progressao linear estiver ativa;
  - fazer quizzes de modulo dependerem da conclusao das aulas do modulo quando aplicavel;
  - bloquear avaliacao final conforme fluxo completo;
  - sinalizar visualmente itens bloqueados no player;
  - garantir que backend e banco reforcem a mesma regra.
- Verificacao obrigatoria antes de iniciar:
  - confirmar se `can_access_product_lesson` e `can_access_product_module` ja aplicam sequencia real ou apenas grant e agenda;
  - revisar o player do aluno para saber se a navegacao ainda permite pular ordem.
- Criterio de conclusao:
  - o aluno nao consegue furar a ordem quando a progressao linear estiver ativa.

### Etapa 4 — PDF base do modulo e materiais protegidos

- Status: `parcial`
- O que ja existe:
  - campos de PDF base por modulo;
  - gestor de materiais no admin;
  - Edge Function `generate-asset-access`;
  - acesso a materiais por signed URL.
- O que falta para concluir:
  - fluxo operacional de upload do PDF base;
  - download licenciado por aluno para PDF base do modulo;
  - uso consistente de storage privado;
  - integracao clara no player e na area de downloads;
  - cobertura de watermark e logs para acesso sensivel.
- Verificacao obrigatoria antes de iniciar:
  - confirmar se o PDF base hoje e apenas metadata ou se ja existe download licenciado real;
  - revisar buckets e regras de storage.
- Criterio de conclusao:
  - materiais privados usam fluxo seguro e o PDF base gera acesso licenciado por aluno.

### Etapa 5 — Limpeza final do legado e padronizacao de linguagem

- Status: `parcial`
- O que ja existe:
  - rotas publicas, do aluno e do admin principais ja usam `cursos`;
  - o admin visivel foi ajustado para `cursos`.
- O que falta para concluir:
  - revisar telas residuais, textos, labels e mensagens ainda expostas com `produto`;
  - identificar o que deve continuar como nome tecnico interno por compatibilidade;
  - documentar explicitamente a decisao entre linguagem de dominio `curso` e nomes tecnicos legados no banco.
- Verificacao obrigatoria antes de iniciar:
  - rodar busca por `produto`, `produtos`, `product` em textos de UI;
  - separar linguagem visivel de nomes internos de schema.
- Criterio de conclusao:
  - a linguagem visivel ao usuario e ao admin fica consistente com `curso(s)`.

### Etapa 6 — Varredura final por contratos de aceite

- Status: `pendente`
- Objetivo:
  - confrontar a implementacao com os contratos de aceite da spec e com os docs canonicos.
- Entregas esperadas:
  - checklist por fluxo admin, aluno, compra e seguranca;
  - registro do que esta concluido, parcial ou bloqueado;
  - lista curta de ajustes finais restantes;
  - nova rodada de validacao e deploy.
- Verificacao obrigatoria antes de iniciar:
  - confirmar que as etapas 1 a 5 foram fechadas ou conscientemente adiadas.
- Criterio de conclusao:
  - o modulo de cursos fica com status claro de pronto, parcial ou bloqueado por item.

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
4. informar validacoes e deploys executados;
5. perguntar se podemos seguir para a proxima etapa.

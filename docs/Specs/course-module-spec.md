# Especificacao do Modulo de Curso

## 1. Objetivo

Este documento descreve a estrutura real do modulo de cursos da plataforma Genflix, com foco em:

- paginas publicas de catalogo e venda;
- builder administrativo do curso;
- visualizador do curso pelo aluno;
- fluxo de checkout, webhook e liberacao automatica;
- regras de acesso, progresso e quizzes.

O texto abaixo reflete a estrutura atualmente exposta no app, nos forms e nas rotas do codigo.

## 2. Mapa de Paginas

### Publico

```text
/                      -> Home publica
/cursos                -> Catalogo de cursos
/cursos/:slug          -> Pagina publica de venda do curso
/login                 -> Login
/criar-conta           -> Cadastro
/recuperar-senha       -> Recuperacao
/redefinir-senha       -> Reset
```

### Aluno

```text
/aluno
/aluno/dashboard
/aluno/cursos
/aluno/cursos/:courseId
/aluno/cursos/:courseId/player
/aluno/cursos/:courseId/player/aulas/:lessonId
/aluno/cursos/:courseId/player/avaliacoes/:assessmentId
```

### Admin

```text
/admin/cursos
/admin/cursos/:courseId/builder
/admin/cursos/:courseId/builder/settings
/admin/cursos/:courseId/builder/releases
/admin/cursos/:courseId/builder/assessments
/admin/cursos/:courseId/builder/assessments/final
/admin/cursos/:courseId/builder/modulos/:moduleId
/admin/cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId
/admin/cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId/materiais
/admin/cursos/:courseId/builder/modulos/:moduleId/avaliacoes/:assessmentId
/admin/cursos/:courseId/builder/modulos/:moduleId/avaliacoes/nova
```

### Vendas e API

```text
POST /api/checkout/asaas/start
POST /api/webhooks/asaas
```

## 3. Estrutura do Curso

O curso e o centro academico e comercial do sistema. Os dados atuais do modelo estao em `src/types/content.ts` e os forms em `src/features/admin/content/schemas.ts`.

### Course

Campos principais:

- `id`
- `title`
- `description`
- `status` com `draft`, `published` e `archived`
- `display_order`
- `thumbnail_url`
- `slug`
- `launch_date`
- `price_cents`
- `currency`
- `is_public`
- `creator_id`
- `creator_commission_percent`
- `workload_minutes`
- `has_linear_progression`
- `quiz_type_settings`
- `created_by`
- `created_at`
- `updated_at`

Regras:

- curso aparece no catalogo somente quando `status = published` e `is_public = true`;
- `price_cents = 0` representa curso gratuito;
- `slug` e usado nas paginas publicas de venda;
- `quiz_type_settings` define quais tipos de quiz o curso permite;
- `has_linear_progression` liga o bloqueio sequencial de aulas;
- `creator_id` e `creator_commission_percent` alimentam o fluxo de comissao.

### CourseModule

Campos principais:

- `id`
- `course_id`
- `title`
- `description`
- `position`
- `is_required`
- `starts_at`
- `ends_at`
- `release_days_after_enrollment`
- `module_pdf_storage_path`
- `module_pdf_file_name`
- `module_pdf_uploaded_at`
- `created_at`
- `updated_at`

Regras:

- modulo pode ser liberado por data absoluta, por dias apos a inscricao, ou por ambos;
- se `starts_at` e `release_days_after_enrollment` existirem juntos, as duas regras valem ao mesmo tempo;
- `module_pdf_*` guardam o PDF base do modulo;
- o PDF do modulo pode ser baixado no player do aluno e receber versao licenciada.

### Lesson

Campos principais:

- `id`
- `module_id`
- `title`
- `description`
- `position`
- `is_required`
- `lesson_type` com `video`, `text` e `hybrid`
- `youtube_url`
- `text_content`
- `estimated_minutes`
- `starts_at`
- `ends_at`
- `created_at`
- `updated_at`

Regras:

- `video` usa apenas video como conteudo principal;
- `text` usa blocos serializados em `text_content`;
- `hybrid` combina video e blocos;
- aula pode ter liberacao programada e expiracao propria;
- `text_content` e montado a partir de blocos do editor.

### Assessments

Campos principais:

- `id`
- `course_id`
- `module_id`
- `assessment_type` com `module` ou `final`
- `title`
- `description`
- `is_required`
- `passing_score`
- `max_attempts`
- `estimated_minutes`
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

Tipos de pergunta suportados no builder atual:

- `single_choice`
- `essay_ai`
- `case_study_ai`
- `case_study_single_choice`
- `drag_drop_labeling`
- `fill_in_the_blanks`
- `image_hotspot`
- `coloring`

### CourseRelease

Representa a liberacao de acesso do aluno ou de um grupo.

Campos principais:

- `course_id`
- `release_type` com `user` ou `group`
- `user_id`
- `group_id`
- `starts_at`
- `ends_at`
- `is_active`
- `source_system`
- `release_source` com `purchase`, `free_enrollment`, `admin`, `group` ou `integration`
- `release_status`
- `external_reference_id`
- `managed_by_integration`
- `last_synced_at`
- `revoked_at`
- `revoked_reason`
- `created_by`
- `created_at`

### CourseReview

As reviews publicas do curso ficam em tabelas de reviews reutilizaveis, com leitura publica apenas para itens aprovados.

## 4. Builder Administrativo

O builder atual e acessado por `/admin/cursos/:courseId/builder` e usa a arvore do curso carregada por `fetchAdminCourseTree`.

### Estrutura lateral

O painel lateral do builder trabalha com esta hierarquia:

- visao geral do curso;
- configuracoes do curso;
- liberacoes;
- gerenciamento de avaliacoes;
- modulos;
- aulas;
- avaliacoes de modulo;
- avaliacao final.

O componente de arvore e o `CourseTreeDnd`, com drag and drop para ordenar o curso e abrir os itens de edicao.

### Visao Geral

Arquivo: `src/pages/admin/builder/course-overview-panel.tsx`

O painel exibe:

- total de modulos;
- total de aulas;
- duracao estimada;
- mapa do curso;
- botoes para analisar com IA;
- botoes para editar modulo, remover modulo, abrir revisoes de IA.

Da visao geral o admin consegue:

- criar novo modulo;
- editar modulo existente;
- excluir modulo;
- abrir a configuracao do curso;
- abrir liberacoes;
- abrir avaliacoes;
- importar/exportar conteudo.

### Configuracoes do Curso

Arquivo: `src/pages/admin/builder/course-settings-panel.tsx`

Campos editaveis:

- titulo;
- descricao;
- status;
- thumbnail;
- slug;
- launch_date;
- price_cents;
- currency;
- is_public;
- creator_id;
- creator_commission_percent;
- has_linear_progression;
- quiz_type_settings.

Regras da tela:

- o curso pode ser publicado, mantido em rascunho ou arquivado;
- o curso pode ficar publico ou privado no catalogo;
- a tela mostra tipos de quiz visiveis globalmente e habilitados por curso;
- o builder respeita o que esta desativado globalmente;
- o criador vinculado ve relatorios e comissoes, mas nao edita o builder completo na v1;
- existe acao administrativa para resetar progresso do curso.

### Modulos

Arquivo: `src/pages/admin/builder/module-editor-panel.tsx`

Campos do modulo:

- titulo;
- descricao;
- obrigatoriedade;
- liberacao por data;
- expiracao;
- dias apos inscricao;
- PDF base do modulo.

Comportamentos:

- criar modulo novo;
- editar modulo existente;
- excluir modulo;
- subir ou remover PDF do modulo;
- analisar modulo com IA;
- visualizar historico de revisoes e ajustes aplicados.

### Aulas

Arquivo: `src/pages/admin/builder/lesson-editor-panel.tsx`

Campos da aula:

- titulo;
- descricao curta;
- tipo de aula;
- URL do YouTube;
- conteudo textual;
- carga horaria estimada;
- obrigatoriedade;
- liberacao programada;
- expiracao;
- blocos de conteudo.

Blocos suportados no editor:

- `rich-text`
- `table`
- `image-hotspots`

Regras da aula:

- o editor salva `text_content` como HTML serializado a partir dos blocos;
- `image-hotspots` tem editor proprio;
- a aula pode ter botoes e arquivos no rodape do player do aluno;
- a tela permite abrir a pagina de materiais e botoes da aula;
- existe visualizacao de solicitacoes de audio/moderacao quando a aula e textual ou hybrid.

### Materiais e botoes da aula

Os botoes do rodape do aluno usam:

- `button_templates`
- `lesson_footer_actions`

Regras:

- template define visual;
- acao da aula define arquivo ou URL;
- arquivo privado e servido por signed URL;
- URL externa abre em nova aba com seguranca.

### Avaliacoes

Arquivos:

- `src/pages/admin/builder/course-assessments-panel.tsx`
- `src/pages/admin/builder/assessment-builder-panel.tsx`

O fluxo atual tem:

- avaliacao final do curso;
- quizzes por modulo;
- importacao/exportacao de conteudo da avaliacao;
- criacao de novo quiz de modulo em `.../avaliacoes/nova`;
- edicao de quiz por `assessmentId`;
- edicao da avaliacao final em `assessments/final`.

O builder de avaliacao suporta:

- perguntas avulsas;
- estudos de caso;
- perguntas gamificadas;
- perguntas com IA;
- questoes de alternativa;
- importacao via JSON;
- remocao de questoes, opcoes e estudos de caso;
- configuracao de score minimo, tentativas e duracao.

### Liberacoes

Arquivo: `src/pages/admin/admin-course-releases-page.tsx`

A tela administra:

- liberacoes por aluno;
- liberacoes por grupo;
- status da liberacao;
- origem da liberacao;
- periodo de validade.

## 5. Visualizador do Aluno

O aluno consome o curso em duas etapas:

1. pagina de detalhes do curso;
2. player interno do curso.

### Dashboard e lista de cursos

Arquivos:

- `src/pages/student/student-dashboard-page.tsx`
- `src/pages/student/student-courses-page.tsx`

Essas paginas mostram:

- cursos liberados;
- progresso geral;
- estados de andamento;
- curso concluido;
- curso bloqueado;
- curso expirado.

### Pagina interna do curso

Arquivo: `src/pages/student/student-course-details-page.tsx`

Exibe:

- hero do curso;
- capa;
- titulo;
- carga horaria;
- total de modulos;
- botao principal para iniciar ou continuar;
- barra de progresso;
- descricao do curso;
- grade curricular;
- reviews publicas;
- bloco de anotacoes do aluno.

Cada modulo mostra:

- titulo;
- descricao;
- estado de desbloqueio;
- lista de aulas;
- quizzes do modulo;
- PDF do modulo para download.

Regras:

- o estado do modulo pode ser bloqueado, bloqueado por agenda, em andamento ou concluido;
- o quiz do modulo fica travado ate concluir as aulas exigidas;
- o aluno pode marcar aula como concluida;
- o aluno pode ver suas anotaes por aula;
- o aluno pode abrir a aula no player a partir da grade curricular.

### Player do curso

Arquivo: `src/pages/student/student-course-player-layout.tsx`

O layout do player tem:

- sidebar com curso, modulos, aulas e avaliacoes;
- area principal com a pagina atual;
- header com progresso e botao de sair do player;
- navegao entre aulas e avaliacoes.

Estados exibidos na sidebar:

- aula concluida;
- aula ativa;
- modulo bloqueado;
- quiz aprovado;
- quiz com tentativas esgotadas;
- prova final.

### Pagina da aula

Arquivo: `src/pages/student/student-lesson-page.tsx`

Exibe:

- titulo da aula;
- descricao;
- video do YouTube quando houver;
- conteudo textual renderizado por blocos;
- player de audio da aula;
- botoes e recursos de rodape;
- painel de notas do aluno;
- botao de concluir aula;
- navegao anterior e proximo;
- download do PDF do modulo;
- acesso a materiais privados por signed URL.

Blocos renderizados pelo aluno:

- rich text;
- tabela;
- hotspots de imagem.

### Pagina da avaliacao

Arquivo: `src/pages/student/student-assessment-execution-page.tsx`

Exibe:

- pergunta atual;
- progresso da avaliacao;
- estudo de caso quando aplicavel;
- quiz final ou quiz de modulo;
- resposta discursiva com avaliacao por IA;
- hotspot, coloring, drag and drop, lacunas e multipla escolha;
- resultado final com aprovacao ou reprovao;
- pedido de nova tentativa quando as tentativas acabarem.

## 6. Estrutura da Pagina Publica de Venda

Arquivo: `src/pages/public/public-course-details-page.tsx`

A pagina publica do curso e a pagina de venda principal. Ela exibe:

- titulo do curso;
- descricao;
- sobre o curso;
- o que voce vai aprender;
- conteudo programatico por modulo;
- mentor ou instrutor;
- preco;
- preview visual;
- CTA de compra;
- reviews publicas;
- features de estudo.

### Catalogo publico

Arquivo: `src/pages/public/public-courses-page.tsx`

Exibe:

- cards de curso;
- busca;
- filtros por categoria;
- paginacao;
- blocos institucionais e de features.

### CTA e compra

Comportamento atual da pagina de venda:

- se o curso ja tiver liberacao, o CTA pode levar direto para o curso;
- se o curso for gratuito, a liberacao e direta;
- se o curso for pago, o CTA inicia checkout;
- o checkout e iniciado com `startCourseCheckout(courseId, access_token)` usando a sessao do usuario;
- a pagina contem nome e email do comprador como parte do formulario visual, mas o fluxo ativo de abertura do checkout depende da sessao autenticada.

## 7. Fluxo de Vendas

### 7.1 Inicio do checkout

Endpoint:

```text
POST /api/checkout/asaas/start
```

Passos do fluxo:

1. frontend envia `Authorization: Bearer <access_token>`;
2. backend valida a sessao com Supabase;
3. backend carrega o curso;
4. se o curso for gratuito, cria liberacao direta;
5. se o curso for pago, cria checkout no Asaas;
6. backend registra a sessao em `commerce_checkout_sessions`;
7. backend devolve `checkoutUrl`;
8. frontend redireciona o aluno para o checkout hospedado.

### 7.2 Gateway de pagamento

O gateway atual e Asaas, tratado como adapter.

Configuracao esperada:

- ambiente `sandbox` ou `production`;
- `payment_gateway_settings` como registro singleton;
- webhook configurado;
- chaves do ambiente corretas.

Variaveis relacionadas ao fluxo:

- `ASAAS_ACCESS_TOKEN_SANDBOX`
- `ASAAS_ACCESS_TOKEN_PRODUCTION`
- `ASAAS_ACCESS_TOKEN`
- `ASAAS_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 7.3 Webhook

Endpoint:

```text
POST /api/webhooks/asaas
```

Eventos tratados:

- pagamento confirmado;
- checkout cancelado;
- checkout expirado;
- reembolso;
- chargeback.

Regras:

- o webhook deduplica eventos;
- eventos brutos sao salvos em `commerce_events`;
- pagamento confirmado cria ou reativa `course_releases`;
- cancelamento e expiracao atualizam a sessao;
- reembolso e chargeback revogam a liberacao gerenciada;
- o webhook tambem aciona a logica de comissao do criador.

### 7.4 Curso gratuito

Fluxo:

1. aluno autenticado clica em acessar;
2. backend valida curso publicado e publico;
3. backend cria `course_releases` com origem `free_enrollment`;
4. frontend navega para o curso.

### 7.5 Curso pago

Fluxo:

1. aluno autenticado clica em comprar;
2. frontend chama `POST /api/checkout/asaas/start`;
3. backend valida usuario e curso;
4. backend cria sessao de checkout;
5. Asaas devolve a sessao do checkout;
6. webhook confirma o pagamento;
7. `course_releases` e criado ou atualizado;
8. aluno passa a acessar o curso.

### 7.6 Comissao do criador

Se houver criador vinculado e percentual configurado:

- a venda paga gera comissao;
- a comissao nasce pendente;
- a comissao pode ficar elegivel para repasse apos o prazo configurado;
- cancelamento, estorno ou chargeback cancelam ou revertem a comissao.

## 8. Regras de Acesso

O acesso do aluno e sempre derivado da combinacao de regras:

- curso publicado;
- curso liberado para o aluno ou grupo;
- liberacao ativa;
- periodo valido;
- modulo dentro da janela de liberacao;
- aula dentro da janela de liberacao;
- progressao linear atendida;
- quiz liberado conforme conclusao das aulas exigidas.

Regra principal:

- a condicao mais restritiva vence.

Isso significa que:

- curso liberado nao ignora agenda de modulo;
- aula liberada nao ignora modulo bloqueado;
- URL direta deve consultar as mesmas regras do player.

## 9. Conteudo e Quizzes

### Configuracao global e por curso

O admin pode ativar ou desativar tipos de quiz globalmente e por curso.

Regra:

- tipo desativado globalmente nao aparece no builder do curso;
- tipo desativado no curso nao aparece como card de criacao;
- `case_study` depende de tipos internos estarem ativos.

### Correcoes

O backend e a fonte da pontuacao final.

O player:

- exibe feedback;
- nao decide nota sozinho;
- valida resposta antes de enviar.

## 10. Storage e Arquivos

Buckets usados ou esperados:

- `module-pdfs`
- `lesson-footer-assets`
- `lesson-content-assets`
- `materials`

Regras:

- conteudo privado usa signed URL;
- o aluno nao deve receber URL publica permanente como fonte definitiva;
- PDFs do modulo podem ser personalizados para o aluno;
- arquivos de aula e materiais seguem o mesmo padrao de assinatura.

## 11. APIs e Servicos do Modulo

### Admin Content API

Responsavel por:

- CRUD de cursos;
- CRUD de modulos;
- CRUD de aulas;
- upload e remocao de assets;
- importacao e exportacao de conteudo;
- gerenciamento de PDF base;
- gerenciamento de botoes da aula.

### Student Course API

Responsavel por:

- carregar curso liberado;
- carregar progresso;
- carregar status da jornada;
- marcar aula como concluida;
- consultar modulos e aulas liberadas.

### Reviews API

Responsavel por:

- listar reviews aprovados;
- publicar ou atualizar review do usuario;
- registrar voto util / nao util;
- carregar estatisticas agregadas.

## 12. Estrutura de Codigo Recomendada

```text
src/
  pages/
    public/
      public-courses-page.tsx
      public-course-details-page.tsx
    student/
      student-dashboard-page.tsx
      student-courses-page.tsx
      student-course-details-page.tsx
      student-course-player-layout.tsx
      student-lesson-page.tsx
      student-assessment-execution-page.tsx
    admin/
      admin-courses-page.tsx
      builder/
        course-overview-panel.tsx
        course-settings-panel.tsx
        module-editor-panel.tsx
        lesson-editor-panel.tsx
        lesson-materials-panel.tsx
        course-assessments-panel.tsx
        assessment-builder-panel.tsx
  features/
    admin/
      content/
    student/
      courses/
      assessments/
    public/
      courses/
    reviews/
api/
  checkout/
    asaas/
      start.ts
  webhooks/
    asaas.ts
supabase/
  migrations/
```

## 13. Critarios de Aceite

Admin:

- criar curso completo;
- configurar capa, slug, preco e visibilidade;
- criar modulo, aula e avaliacao;
- importar e exportar conteudo;
- configurar liberacoes;
- publicar o curso.

Aluno:

- ver curso liberado na lista;
- abrir pagina interna do curso;
- assistir aula;
- baixar PDF do modulo;
- acessar recursos da aula;
- concluir aula;
- responder quiz;
- ver bloqueios corretos.

Vendas:

- checkout gratuito cria liberacao sem pagamento;
- checkout pago cria sessao e depende do webhook;
- pagamento confirmado libera o curso;
- cancelamento, expiracao, reembolso e chargeback sao refletidos no acesso.

Seguranca:

- aluno sem liberacao nao acessa por URL direta;
- arquivos privados nao ficam publicos;
- frontend nao depende de chave privada;
- webhook usa service role no backend.


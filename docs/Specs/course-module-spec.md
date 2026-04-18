# SPEC: Modulo de Cursos, Builder LMS, Player do Aluno e Venda

## 1. Objetivo do Documento

Este documento descreve, em nivel de produto e arquitetura, a estrutura atual do modulo de cursos da GenFlix. Ele foi escrito para ser reutilizado como referencia em outra plataforma, portanto cobre nao apenas "modulos e aulas", mas a operacao completa de cursos:

- area publica de catalogo e venda;
- painel admin de cursos;
- alunos adicionados, liberacoes e controle de acesso;
- configuracoes comerciais e pedagogicas do curso;
- construtor LMS completo;
- modulos, aulas, blocos interativos, materiais e PDFs;
- quizzes e avaliacoes;
- player em tela cheia do aluno;
- compra, checkout, webhook, pagamento e liberacao automatica;
- comissao de criadores.

A regra principal da implementacao e: curso e ao mesmo tempo um produto comercial, uma trilha pedagogica e uma unidade de acesso. Por isso, o mesmo objeto `course` precisa alimentar o catalogo publico, o checkout, o painel admin, o builder e o player do aluno.

## 2. Visao Geral da Jornada

### 2.1 Jornada do admin

O admin gerencia cursos em tres camadas:

1. Lista de cursos no painel admin.
2. Configuracoes gerais do curso, alunos/liberacoes e dados comerciais.
3. Construtor do curso, com estrutura real de LMS.

Fluxo esperado:

```text
/admin/cursos
  -> criar curso ou editar curso existente
  -> abrir construtor do curso

/admin/cursos/:courseId/builder
  -> visao geral
  -> configuracoes do curso
  -> alunos adicionados/liberacoes
  -> avaliacoes
  -> modulos
  -> aulas
  -> quizzes de modulo
  -> avaliacao final
```

### 2.2 Jornada do aluno

O aluno passa por duas experiencias:

1. Area do aluno, com lista de cursos liberados.
2. Player LMS em tela cheia, com navegacao por modulos, aulas e avaliacoes.

Fluxo esperado:

```text
/aluno
  -> dashboard
  -> meus cursos
  -> detalhes do curso
  -> player em tela cheia

/aluno/cursos/:courseId/player
  -> aula
  -> quiz de modulo
  -> avaliacao final
```

### 2.3 Jornada de compra

O curso publico pode ser gratuito ou pago.

```text
/cursos
  -> catalogo publico

/cursos/:slug
  -> pagina de venda
  -> CTA de compra
  -> checkout Asaas
  -> webhook confirma pagamento
  -> libera curso ao aluno
  -> aluno acessa /aluno/cursos/:courseId
```

## 3. Mapa de Rotas

### 3.1 Rotas publicas

```text
/                         Home publica
/cursos                   Catalogo publico de cursos
/cursos/:slug             Pagina publica de venda do curso
/blog                     Blog publico
/recursos                 Pagina publica de recursos
/sobre                    Pagina institucional
/login                    Login
/criar-conta              Cadastro
/recuperar-senha          Solicitar redefinicao de senha
/redefinir-senha          Modal de nova senha apos link de recovery
```

### 3.2 Rotas do aluno

```text
/aluno
/aluno/dashboard
/aluno/cursos
/aluno/cursos/:courseId
/aluno/cursos/:courseId/player
/aluno/cursos/:courseId/player/aulas/:lessonId
/aluno/cursos/:courseId/player/avaliacoes/:assessmentId
/aluno/mensagens
```

### 3.3 Rotas administrativas de curso

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

### 3.4 Rotas administrativas relacionadas

```text
/admin/usuarios
/admin/pagamentos
/admin/tipos-de-quiz
/admin/mensagens
/admin/minha-conta
```

### 3.5 APIs comerciais

```text
POST /api/checkout/asaas/start
POST /api/webhooks/asaas
```

## 4. Modelo Central do Curso

### 4.1 Course

O curso concentra dados academicos, comerciais, publicos e operacionais.

Campos principais:

- `id`: identificador interno UUID.
- `title`: nome do curso.
- `description`: descricao rica, usada no admin e na pagina publica.
- `status`: `draft`, `published` ou `archived`.
- `display_order`: ordem manual de exibicao.
- `thumbnail_url`: imagem de capa.
- `slug`: URL publica amigavel.
- `launch_date`: data de lancamento, usada tambem em relatorios por semestre.
- `price_cents`: preco em centavos.
- `currency`: moeda, atualmente `BRL`.
- `is_public`: controla exibicao no catalogo publico.
- `creator_id`: usuario criador vinculado ao curso.
- `creator_commission_percent`: percentual de comissao do criador.
- `workload_minutes`: carga horaria calculada/estimada.
- `has_linear_progression`: ativa progressao sequencial.
- `quiz_type_settings`: tipos de quiz habilitados no curso.
- `created_by`: admin criador do curso.
- `created_at` e `updated_at`: auditoria basica.

Regras:

- Curso publicado e publico aparece no catalogo.
- Curso em rascunho nao deve ser comprado pelo publico.
- Curso arquivado fica inativo para operacao normal.
- `price_cents = 0` significa curso gratuito.
- Curso pago precisa passar pelo checkout.
- Curso com `creator_id` e comissao maior que zero gera comissao apos venda confirmada.
- `has_linear_progression` controla bloqueio sequencial no player.
- `quiz_type_settings` limita quais quizzes aparecem no builder.

### 4.2 CourseModule

Modulo e a primeira camada pedagogica dentro do curso.

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

- Modulos sao ordenados por `position`.
- Modulo obrigatorio entra no calculo de conclusao.
- Modulo pode ter liberacao imediata, por data absoluta, por expiracao ou por dias apos inscricao.
- Se houver data absoluta e dias apos inscricao, as duas regras sao cumulativas.
- Modulo fora da janela bloqueia todas as aulas e quizzes do modulo.
- PDF base do modulo pode ser anexado pelo admin.
- Download do PDF do modulo no aluno gera copia licenciada com identificacao individual quando houver PDF base.

### 4.3 Lesson

Aula e a unidade de consumo principal do aluno.

Campos principais:

- `id`
- `module_id`
- `title`
- `description`
- `position`
- `is_required`
- `lesson_type`: `video`, `text` ou `hybrid`
- `youtube_url`
- `text_content`
- `estimated_minutes`
- `starts_at`
- `ends_at`
- `created_at`
- `updated_at`

Regras:

- `video`: aula centrada em YouTube.
- `text`: aula centrada em blocos de conteudo.
- `hybrid`: combina video e blocos.
- Aula obrigatoria entra na progressao.
- Aula pode ser liberada/expirada por data.
- Aula fora da janela fica bloqueada mesmo quando modulo esta liberado.
- O conteudo textual e salvo em `text_content`, com blocos serializados.

### 4.4 Assessment

Avaliacao representa quiz de modulo ou prova final.

Campos principais:

- `id`
- `course_id`
- `module_id`
- `assessment_type`: `module` ou `final`
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

Regras:

- Avaliacao de modulo pertence a um modulo.
- Avaliacao final pertence ao curso.
- Avaliacao obrigatoria pode bloquear conclusao.
- Tentativas sao controladas por `max_attempts`.
- Quando tentativas acabam, aluno pode solicitar nova tentativa se o fluxo estiver ativo.

### 4.5 CourseRelease

Liberacao representa o direito de acesso do aluno ao curso.

Campos principais:

- `course_id`
- `release_type`: `user` ou `group`
- `user_id`
- `group_id`
- `starts_at`
- `ends_at`
- `is_active`
- `source_system`
- `release_source`: `purchase`, `free_enrollment`, `admin`, `group` ou `integration`
- `release_status`
- `external_reference_id`
- `managed_by_integration`
- `last_synced_at`
- `revoked_at`
- `revoked_reason`
- `created_by`
- `created_at`

Regras:

- Curso so aparece para o aluno quando existe liberacao ativa valida.
- Liberacao pode ser manual, por grupo, gratuita, compra ou integracao.
- Liberacao por compra e gerenciada por gateway.
- Reembolso, chargeback ou cancelamento podem revogar liberacao gerenciada.

## 5. Painel Admin de Cursos

### 5.1 Tela `/admin/cursos`

Essa tela e o ponto inicial do admin para gerenciar o catalogo academico.

Responsabilidades:

- listar cursos existentes;
- mostrar metricas de total, publicados e rascunhos;
- criar novo curso;
- editar dados basicos do curso;
- abrir construtor LMS;
- importar curso via JSON;
- exportar curso completo;
- organizar ordem de exibicao com drag and drop;
- excluir curso.

### 5.2 Card/lista de curso

Cada curso deve exibir:

- capa;
- titulo;
- status;
- carga horaria;
- preco;
- visibilidade publica;
- ordem;
- acoes administrativas.

Acoes esperadas:

- `Editar`: abre modal de dados basicos do curso.
- `Abrir construtor`: navega para `/admin/cursos/:courseId/builder`.
- `Exportar`: baixa JSON completo do curso.
- `Excluir`: remove o curso apos confirmacao.

### 5.3 Criacao de curso

Ao criar um curso pelo admin:

1. Admin informa titulo, capa, status e descricao.
2. Admin configura vendas e acesso basico.
3. Sistema cria o curso.
4. Admin e levado ao construtor para criar modulos, aulas e quizzes.

Campos do modal de criacao:

- titulo;
- imagem de capa;
- status;
- slug publico;
- data de lancamento;
- valor de venda;
- moeda;
- visibilidade no catalogo;
- descricao detalhada.

### 5.4 Edicao de curso na lista

O botao de editar na lista altera metadados globais, mas nao substitui o construtor.

Usos tipicos:

- trocar nome;
- trocar capa;
- publicar/despublicar;
- ajustar preco;
- ajustar slug;
- ajustar descricao.

Para editar conteudo real de LMS, o admin deve abrir o construtor.

## 6. Alunos Adicionados e Liberacoes

### 6.1 Objetivo da tela

A tela de alunos adicionados/liberacoes controla quem pode acessar o curso. Ela e essencial porque a compra tambem termina criando uma liberacao.

Rota:

```text
/admin/cursos/:courseId/builder/releases
```

### 6.2 O que a tela deve mostrar

A tela deve listar liberacoes vinculadas ao curso, com:

- aluno ou grupo;
- e-mail do aluno;
- tipo da liberacao;
- origem da liberacao;
- status;
- data de inicio;
- data de expiracao;
- se esta ativa;
- referencia externa quando houver;
- data de sincronizacao;
- acoes.

### 6.3 Tipos de liberacao

Liberacao por usuario:

- concede acesso a um aluno especifico.
- usada para compra, cortesia, suporte e casos administrativos.

Liberacao por grupo:

- concede acesso a todos os membros de um grupo.
- usada para turmas, empresas ou pacotes.

### 6.4 Origens de liberacao

Origens suportadas:

- `admin`: acesso manual criado pelo admin.
- `purchase`: acesso criado por pagamento confirmado.
- `free_enrollment`: acesso criado em curso gratuito.
- `group`: acesso herdado de grupo.
- `integration`: acesso criado por integracao legada ou externa.

### 6.5 Regras de acesso

Uma liberacao valida precisa atender:

- `is_active = true`;
- status ativo;
- data atual maior ou igual a `starts_at`, quando existir;
- data atual menor ou igual a `ends_at`, quando existir;
- curso publicado;
- regras de modulo/aula tambem liberadas.

### 6.6 Revogacao

Uma liberacao pode ser revogada quando:

- admin remove manualmente;
- pagamento e estornado;
- chargeback ocorre;
- checkout e invalidado;
- periodo de acesso expira.

Quando revogada:

- `is_active` deve ir para `false`;
- `release_status` deve indicar revogacao;
- `revoked_at` deve ser preenchido;
- `revoked_reason` deve explicar motivo.

## 7. Configuracoes do Curso

### 7.1 Rota

```text
/admin/cursos/:courseId/builder/settings
```

### 7.2 Seccoes da tela

A tela de configuracao do curso concentra quatro dimensoes:

1. Identidade publica do curso.
2. Dados comerciais e checkout.
3. Regras pedagogicas.
4. Padroes de IA e operacoes administrativas.

### 7.3 Identidade publica

Campos:

- capa do curso;
- nome;
- descricao rica;
- status;
- slug;
- visibilidade no catalogo.

Comportamento:

- capa pode ser enviada por upload.
- descricao usa editor rico.
- status controla publicacao.
- `is_public` controla se aparece no catalogo.
- `slug` define a URL `/cursos/:slug`.

### 7.4 Vendas e acesso

Campos:

- valor de venda;
- moeda;
- data de lancamento;
- criador vinculado;
- percentual de comissao do criador.

Regras:

- Valor zero habilita fluxo gratuito.
- Valor maior que zero habilita checkout pago.
- Moeda atual e `BRL`.
- Data de lancamento serve para relatorios por semestre.
- Criador vinculado acessa relatorios do curso.
- Percentual de comissao gera registro financeiro de repasse.

### 7.5 Progressao linear

Campo:

- `has_linear_progression`

Quando ativo:

- aluno deve seguir aulas em ordem;
- aulas futuras ficam bloqueadas;
- modulo seguinte depende do modulo anterior;
- quiz de modulo pode depender da conclusao das aulas do modulo;
- avaliacao final pode depender do fluxo inteiro.

Quando desativado:

- aluno pode navegar mais livremente, respeitando apenas acesso, agenda e regras especificas.

### 7.6 Tipos de quiz disponiveis

Configuracao em duas camadas:

- global em `/admin/tipos-de-quiz`;
- por curso em `/admin/cursos/:courseId/builder/settings`.

Regra:

- Se um tipo estiver desativado globalmente, ele nem aparece nas configuracoes do curso.
- Se estiver ativo globalmente, o admin pode ativar/desativar por curso.
- Se estiver desativado no curso, o card de criacao nao aparece no builder.

Tipos suportados:

- multipla escolha;
- discursiva com IA;
- estudo de caso;
- arrastar e soltar;
- preencher lacunas;
- hotspot de imagem;
- colorir por imagem normal;
- colorir por SVG com regioes.

### 7.7 Padroes de IA

A tela permite configurar criterios para revisao com IA:

- estrutura ideal do curso;
- elementos obrigatorios por modulo;
- regras de bibliografia;
- regras de tabela e formatacao;
- regras adicionais.

Esses criterios orientam as revisoes automaticas feitas no builder.

### 7.8 Renovar progresso

A configuracao possui acao destrutiva para renovar progresso de todos os alunos.

Ela apaga:

- progresso de aulas;
- progresso do curso;
- tentativas de avaliacoes;
- pedidos de nova tentativa;
- concessoes extras de tentativa.

Uso esperado:

- nova turma;
- relancamento do curso;
- atualizacao grande de conteudo.

## 8. Construtor LMS do Curso

### 8.1 Rota principal

```text
/admin/cursos/:courseId/builder
```

### 8.2 Layout do builder

O builder e organizado como um ambiente de autoria com:

- barra superior com voltar, menu e visualizar;
- sidebar com arvore do curso;
- area principal de edicao;
- indicador de build discreto;
- navegacao contextual por rota.

### 8.3 Arvore lateral

A arvore do curso mostra:

- visao geral do curso;
- modulos;
- aulas dentro de cada modulo;
- quizzes de modulo;
- avaliacao final;
- acoes administrativas do curso.

Comportamentos:

- clicar em modulo abre editor do modulo;
- clicar em aula abre editor da aula;
- clicar em quiz abre builder da avaliacao;
- botao "Novo Modulo" cria modulo;
- drag and drop ordena itens quando suportado;
- item ativo fica destacado.

### 8.4 Visao geral do curso

Mostra:

- resumo do curso;
- quantidade de modulos;
- quantidade de aulas;
- carga horaria;
- mapa curricular;
- atalhos para configuracao;
- atalhos para liberacoes;
- atalhos para avaliacoes;
- importacao/exportacao;
- revisao por IA.

Uso:

- entender estrutura geral;
- abrir rapidamente editores;
- iniciar criacao de novos modulos;
- revisar consistencia do curso.

## 9. Editor de Modulo

### 9.1 Campos

O editor de modulo deve permitir:

- editar titulo;
- editar descricao;
- marcar como obrigatorio;
- definir liberacao programada;
- definir expiracao;
- definir "liberar apos X dias da inscricao";
- subir PDF base;
- remover PDF base;
- visualizar nome do PDF anexado.

### 9.2 Liberacao programada

Modelos de liberacao:

- liberar imediatamente;
- liberar em data/hora especifica;
- expirar em data/hora especifica;
- liberar apos X dias da inscricao no curso.

Regra cumulativa:

- Se existir data de liberacao e dias apos inscricao, o modulo so libera quando as duas regras forem atendidas.

Exemplos:

- `starts_at = 10/05` e `release_days_after_enrollment = 7`: aluno inscrito em 01/05 libera em 10/05; aluno inscrito em 08/05 libera em 15/05.
- `ends_at` vencido bloqueia modulo mesmo que o aluno tenha liberacao do curso.

### 9.3 PDF base do modulo

O admin pode subir um PDF base por modulo.

No aluno:

- se houver PDF base, o download gera copia licenciada;
- se nao houver PDF base, o sistema pode usar fallback de exportacao de conteudo;
- marca d'agua inclui dados do aluno, e-mail e identificador interno.

## 10. Editor de Aula

### 10.1 Campos principais

Campos:

- titulo;
- descricao curta;
- tipo de aula;
- URL do YouTube;
- conteudo textual;
- carga horaria estimada;
- aula obrigatoria;
- liberacao programada;
- expiracao.

### 10.2 Tipos de aula

Video:

- usa `youtube_url`;
- pode ou nao ter descricao;
- foco principal e media embed.

Texto:

- usa blocos de conteudo em `text_content`;
- nao depende de video.

Hibrida:

- combina video e blocos;
- ideal para aula com explicacao audiovisual e material de apoio.

### 10.3 Blocos de conteudo

Blocos suportados:

- bloco de texto;
- bloco de tabela;
- bloco de hotspots de imagem.

Bloco de texto:

- editor rico;
- salva HTML;
- usado para conteudo principal da aula.

Bloco de tabela:

- usado para comparativos, cronogramas e estruturas tabulares;
- preserva ordem dentro do conteudo.

Bloco de hotspots de imagem:

- imagem base enviada por upload;
- pontos clicaveis por hotspot;
- cada hotspot tem titulo e texto rico;
- no aluno, abre card/modal dentro da imagem;
- um hotspot aberto por vez;
- sem pontuacao, sem tentativa e sem nota.

### 10.4 Materiais e botoes da aula

Rota:

```text
/admin/cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId/materiais
```

Objetivo:

- configurar botoes do rodape da aula no player do aluno.

Estrutura:

- template de botao;
- tipo da acao;
- arquivo ou URL;
- label customizado opcional.

Tipos:

- arquivo enviado;
- link externo.

Regras:

- o aluno ve apenas o botao, icone e nome;
- URL nao fica exposta visualmente no card;
- clique em URL abre nova aba;
- arquivo usa signed URL;
- template controla aparencia, icone e label padrao.

## 11. Bloco Interativo de Hotspots de Aula

Este bloco nao e quiz. Ele e conteudo interativo dentro da aula.

Caracteristicas:

- imagem base;
- hotspots por ponto;
- icone padrao;
- modal/card conectado ao hotspot;
- titulo;
- texto rico basico;
- sem nota;
- sem tentativa;
- sem progresso proprio.

No admin:

- upload da imagem;
- clique para criar ponto;
- arraste/reposicione;
- edite titulo e texto.

No aluno:

- imagem aparece dentro da aula;
- hotspots ficam visiveis;
- clicar abre janela perto do ponto;
- janela indica visualmente conexao com o hotspot;
- clicar fora ou no X fecha.

## 12. Avaliacoes e Quizzes

### 12.1 Tipos de avaliacao

Modulo:

- pertence a um modulo;
- normalmente fica depois das aulas do modulo;
- pode ser obrigatoria;
- pode bloquear progresso.

Final:

- pertence ao curso;
- aparece ao final do player;
- valida conclusao geral.

### 12.2 Builder de avaliacao

Recursos:

- criar perguntas;
- ordenar perguntas;
- criar estudos de caso;
- configurar alternativas;
- configurar gabarito;
- importar/exportar JSON;
- definir pontuacao;
- definir tentativas;
- definir nota minima.

### 12.3 Tipos de pergunta

Multipla escolha:

- pergunta;
- alternativas;
- alternativa correta;
- feedback e pontuacao.

Discursiva com IA:

- resposta aberta;
- rubrica;
- avaliacao automatica por IA.

Estudo de caso:

- contexto rico;
- perguntas vinculadas;
- atualmente usado fora dos tipos gamificados v1 quando houver restricao.

Arrastar e soltar:

- imagem base;
- areas/hotspots;
- banco de respostas;
- aluno arrasta token para slot.

Preencher lacunas:

- texto com lacunas;
- banco de respostas;
- aluno associa respostas.

Hotspot de imagem:

- imagem base;
- hotspots retangulares;
- modo clique unico;
- modo encontrar todos;
- feedback por hotspot correto/incorreto;
- feedback ao clicar fora.

Colorir com imagem normal:

- imagem base comum;
- pontos pequenos numerados;
- aluno seleciona cor e marca pontos;
- cor do ponto vem do banco de resposta.

Colorir com SVG:

- SVG com regioes identificadas por `id` ou `data-region-id`;
- aluno pinta a regiao real;
- cor aplicada no elemento vetorial;
- recomendado para preenchimento preciso.

### 12.4 Execucao e submissao

O frontend renderiza interacao, mas o backend decide nota.

Fluxo:

1. aluno abre avaliacao;
2. frontend carrega execucao;
3. aluno responde;
4. frontend envia tentativa;
5. backend valida payload;
6. backend calcula score;
7. backend grava tentativa;
8. frontend mostra resultado.

## 13. Player LMS do Aluno

### 13.1 Rota base

```text
/aluno/cursos/:courseId/player
```

### 13.2 Conceito visual

O player e uma experiencia de LMS em tela cheia.

Caracteristicas:

- ocupa a altura total da tela;
- sidebar fixa a esquerda;
- conteudo principal a direita;
- header interno no topo;
- scroll interno no conteudo;
- botao para sair do player;
- progresso visivel.

### 13.3 Sidebar do player

A sidebar mostra:

- link de voltar para detalhe do curso;
- progresso geral;
- modulos;
- aulas;
- quizzes de modulo;
- avaliacao final.

Cada aula mostra:

- icone de conclusao;
- titulo;
- tipo de conteudo;
- carga em minutos;
- estado ativo;
- estado bloqueado.

Cada quiz mostra:

- tipo: quiz de modulo ou prova final;
- bloqueado/disponivel/aprovado/reprovado;
- tentativas esgotadas;
- item ativo.

### 13.4 Header do player

O header mostra:

- botao de abrir/fechar sidebar;
- nome do curso;
- progresso percentual;
- sair do player.

### 13.5 Area principal

A area principal renderiza:

- aula;
- avaliacao;
- mensagens de erro;
- estados de carregamento.

Ela deve ser independente da sidebar e permitir leitura focada.

### 13.6 Navegacao

O aluno pode navegar por:

- proxima aula;
- aula anterior;
- quiz de modulo;
- avaliacao final;
- sair para detalhe do curso.

Regras:

- link bloqueado nao deve navegar;
- URL direta deve validar acesso;
- admin pode visualizar como preview quando autorizado;
- aluno so acessa o que esta liberado.

## 14. Pagina da Aula no Player

### 14.1 Conteudo exibido

A aula exibe:

- titulo;
- descricao;
- video quando houver;
- conteudo textual;
- blocos de tabela;
- hotspots interativos;
- audio gerado por IA quando existir;
- notas do aluno;
- materiais e botoes;
- botao de concluir;
- navegacao anterior/proximo.

### 14.2 Conclusao da aula

O aluno pode marcar aula como concluida.

Quando concluida:

- progresso da aula e salvo;
- progresso do modulo recalcula;
- proxima aula pode ser liberada;
- quiz pode ser liberado se todos os requisitos forem atendidos.

### 14.3 Notas do aluno

O aluno pode registrar anotacoes por aula.

Uso:

- estudo individual;
- revisao posterior;
- registro privado.

### 14.4 Materiais de rodape

Os botoes aparecem no rodape da aula, junto a navegacao.

Exemplos:

- Baixar PDF;
- Material complementar;
- Planilha;
- Abrir link;
- Acessar guia.

## 15. Pagina de Detalhe do Curso para o Aluno

Rota:

```text
/aluno/cursos/:courseId
```

Mostra:

- hero do curso;
- capa;
- titulo;
- carga horaria;
- progresso;
- botao iniciar/continuar;
- descricao;
- grade curricular;
- modulos;
- aulas;
- quizzes;
- PDF do modulo;
- reviews;
- anotacoes.

Estados:

- disponivel;
- em andamento;
- concluido;
- bloqueado;
- expirado.

## 16. Catalogo Publico e Pagina de Venda

### 16.1 Catalogo

Rota:

```text
/cursos
```

Mostra:

- cards de cursos publicos;
- filtros;
- busca;
- categorias;
- paginacao;
- imagem, titulo e resumo;
- CTA.

Regra de exibicao:

- `status = published`;
- `is_public = true`;
- curso precisa ter dados publicos suficientes.

### 16.2 Pagina publica de venda

Rota:

```text
/cursos/:slug
```

Mostra:

- titulo;
- categoria;
- descricao;
- sobre o curso;
- o que o aluno vai aprender;
- conteudo programatico;
- modulos;
- aulas resumidas;
- criador/mentor quando aplicavel;
- preco;
- CTA de compra;
- reviews publicas.

### 16.3 CTA de compra

Comportamento:

- se usuario nao estiver logado, direciona para login/cadastro;
- se curso ja estiver liberado, leva ao curso;
- se curso for gratuito, cria liberacao;
- se curso for pago, inicia checkout.

## 17. Checkout e Pagamento com Asaas

### 17.1 Endpoint de inicio

```text
POST /api/checkout/asaas/start
```

Requisitos:

- usuario autenticado;
- `Authorization: Bearer <access_token>`;
- `courseId` no body;
- curso publicado;
- curso publico;
- gateway ativo.

Payload:

```json
{
  "courseId": "uuid-do-curso"
}
```

Resposta para curso pago:

```json
{
  "checkoutUrl": "https://asaas.com/checkoutSession/show?id=...",
  "checkoutId": "..."
}
```

Resposta para curso gratuito:

```json
{
  "checkoutUrl": "https://genflix.../aluno/cursos/:courseId",
  "mode": "free"
}
```

### 17.2 Curso gratuito

Fluxo:

1. aluno clica em acessar;
2. backend valida usuario e curso;
3. backend cria `course_releases`;
4. origem fica como `purchase` ou fluxo gratuito, conforme regra atual;
5. frontend manda aluno para curso.

### 17.3 Curso pago

Fluxo:

1. aluno clica em comprar;
2. frontend chama API;
3. backend valida token;
4. backend carrega perfil;
5. backend carrega curso;
6. backend consulta `payment_gateway_settings`;
7. backend cria checkout no Asaas;
8. backend cria registro em `commerce_checkout_sessions`;
9. frontend redireciona para checkout hospedado;
10. Asaas processa pagamento;
11. Asaas chama webhook;
12. webhook libera curso.

### 17.4 Configuracao do gateway

Tabela:

- `payment_gateway_settings`

Campos conceituais:

- gateway ativo;
- codigo do gateway, atualmente `asaas`;
- ambiente `sandbox` ou `production`;
- configuracao atual;
- timestamps.

Variaveis de ambiente:

- `ASAAS_ACCESS_TOKEN_SANDBOX`;
- `ASAAS_ACCESS_TOKEN_PRODUCTION`;
- `ASAAS_ACCESS_TOKEN`;
- `ASAAS_WEBHOOK_SECRET`;
- `SUPABASE_SERVICE_ROLE_KEY`.

### 17.5 Webhook

Endpoint:

```text
POST /api/webhooks/asaas
```

Eventos tratados:

- `CHECKOUT_PAID`;
- `CHECKOUT_CANCELED`;
- `CHECKOUT_EXPIRED`;
- eventos de refund;
- eventos de chargeback;
- `PAYMENT_DELETED`.

Regras:

- valida segredo do webhook quando configurado;
- registra evento em `commerce_events`;
- evita duplicidade por `external_event_id`;
- localiza checkout por `external_checkout_id` ou `external_reference`;
- atualiza status da sessao;
- libera ou revoga acesso;
- cria ou cancela comissao do criador.

### 17.6 Tabelas comerciais

`commerce_checkout_sessions`:

- sessao de checkout criada;
- curso;
- usuario comprador;
- nome e e-mail do comprador;
- gateway;
- ambiente;
- id externo;
- URL do checkout;
- status;
- payload enviado;
- resposta recebida.

`commerce_events`:

- eventos recebidos do gateway;
- id externo do evento;
- tipo do evento;
- curso;
- usuario;
- sessao;
- pagamento externo;
- status de processamento;
- payload bruto.

## 18. Comissao de Criadores

### 18.1 Relacao curso-criador

Um curso pode ter um criador vinculado por `creator_id`.

O curso tambem define:

- `creator_commission_percent`.

### 18.2 Geracao da comissao

Quando o webhook confirma pagamento:

1. acesso do aluno e liberado;
2. checkout e marcado como pago;
3. RPC de comissao e chamada;
4. comissao e criada como pendente.

### 18.3 Elegibilidade de repasse

Regra de negocio:

- repasse deve ocorrer em ate 30 dias apos a venda;
- criador recebe via PIX;
- dados de PIX pertencem ao perfil financeiro do criador;
- comissao deve ser visivel em relatorios.

### 18.4 Estorno

Se compra for estornada, cancelada ou sofrer chargeback:

- acesso gerenciado pelo gateway pode ser revogado;
- comissao pendente deve ser cancelada;
- comissao ja paga deve gerar necessidade de estorno/ajuste;
- evento deve ficar auditavel.

## 19. Relatorios do Criador

O criador acessa area propria, sem acesso ao builder completo.

Permissoes:

- ver apenas cursos vinculados;
- ver vendas agregadas;
- ver receita bruta;
- ver cancelamentos;
- ver comissoes;
- editar o proprio perfil.

Recorte de relatorio:

- periodos de seis meses a partir da data de lancamento;
- vendas por periodo;
- cancelamentos por periodo;
- receita bruta;
- comissao estimada/pendente/elegivel.

## 20. Regras de Acesso e Bloqueio

O acesso final a uma aula depende de todas as camadas:

1. usuario autenticado;
2. curso publicado;
3. curso liberado por usuario ou grupo;
4. liberacao ativa e dentro da validade;
5. modulo liberado;
6. aula liberada;
7. progressao linear satisfeita;
8. quiz liberado quando aplicavel.

Regra central:

- a regra mais restritiva vence.

Exemplos:

- curso liberado, modulo bloqueado por data: aluno nao acessa aula.
- modulo liberado, aula bloqueada por data: aluno nao acessa aula.
- aula liberada, modulo expirado: aluno nao acessa aula.
- aluno com URL direta, mas sem liberacao: recebe erro/bloqueio.

## 21. Storage e Arquivos

Buckets/conceitos usados:

- imagens de capa;
- PDF base de modulo;
- arquivos de rodape da aula;
- assets de blocos interativos;
- materiais privados.

Regras:

- arquivo privado deve usar signed URL;
- PDF de modulo pode ser licenciado por aluno;
- URL permanente privada nao deve ser exposta;
- ao trocar asset, idealmente limpar arquivo antigo;
- editor salva `storage_path`, nao signed URL permanente.

## 22. Importacao e Exportacao de Conteudo

### 22.1 Importacao

A plataforma aceita importacao de curso via JSON.

Uso:

- criar curso completo com IA;
- migrar conteudo;
- acelerar criacao de modulos, aulas e quizzes.

### 22.2 Exportacao

Exportacao baixa JSON completo do curso.

Deve conter:

- curso;
- modulos;
- aulas;
- conteudos;
- quizzes;
- perguntas;
- configuracoes pedagogicas.

## 23. Estrutura de Codigo

Paginas principais:

```text
src/pages/admin/admin-courses-page.tsx
src/pages/admin/builder/course-overview-panel.tsx
src/pages/admin/builder/course-settings-panel.tsx
src/pages/admin/builder/module-editor-panel.tsx
src/pages/admin/builder/lesson-editor-panel.tsx
src/pages/admin/builder/lesson-materials-panel.tsx
src/pages/admin/builder/course-assessments-panel.tsx
src/pages/admin/builder/assessment-builder-panel.tsx

src/pages/student/student-dashboard-page.tsx
src/pages/student/student-courses-page.tsx
src/pages/student/student-course-details-page.tsx
src/pages/student/student-course-player-layout.tsx
src/pages/student/student-lesson-page.tsx
src/pages/student/student-assessment-execution-page.tsx

src/pages/public/public-courses-page.tsx
src/pages/public/public-course-details-page.tsx

api/checkout/asaas/start.ts
api/webhooks/asaas.ts
```

Features principais:

```text
src/features/admin/content
src/features/admin/assessments
src/features/admin/quiz-types
src/features/student/courses
src/features/student/assessments
src/features/public/courses
src/features/reviews
src/features/creator/reports
```

## 24. Contratos de Aceite

### 24.1 Admin

Um curso esta operacional quando o admin consegue:

- criar curso;
- editar capa, titulo e descricao;
- configurar status;
- configurar preco;
- configurar slug;
- vincular criador;
- definir comissao;
- configurar tipos de quiz;
- criar modulos;
- criar aulas;
- criar quizzes;
- configurar liberacoes;
- publicar curso.

### 24.2 Aluno

O aluno deve conseguir:

- visualizar cursos liberados;
- abrir detalhe do curso;
- entrar no player;
- navegar por modulos;
- assistir aulas;
- ler conteudo;
- interagir com hotspots de aula;
- baixar PDFs e materiais;
- marcar aulas como concluidas;
- responder quizzes;
- ver resultado;
- continuar de onde parou.

### 24.3 Compra

O fluxo comercial esta correto quando:

- curso gratuito libera acesso sem checkout pago;
- curso pago cria checkout Asaas;
- webhook confirmado libera acesso;
- cancelamento/expiracao nao libera;
- estorno/chargeback revoga acesso gerenciado;
- comissao de criador e criada quando aplicavel;
- comissao e cancelada quando venda e estornada.

### 24.4 Seguranca

O sistema precisa garantir:

- aluno sem liberacao nao acessa curso por URL direta;
- aluno sem progresso necessario nao pula sequencia quando progressao linear esta ativa;
- arquivos privados usam signed URL;
- service role fica apenas no backend;
- webhook nao depende de chave publica;
- frontend nao calcula nota final sozinho.

## 25. Guia de Reuso em Outra Plataforma

Para reutilizar essa estrutura em outro produto, implemente na seguinte ordem:

1. Autenticacao e roles.
2. Modelo `courses`, `course_modules`, `lessons`, `assessments`.
3. Modelo de liberacoes `course_releases`.
4. Painel admin de cursos.
5. Builder com sidebar e rotas aninhadas.
6. Editor de modulos.
7. Editor de aulas com blocos.
8. Builder de quizzes.
9. Player do aluno em tela cheia.
10. Catalogo publico e pagina de venda.
11. Checkout e webhook.
12. Comissao de criadores.
13. Relatorios.
14. Reviews e notificacoes.

Nao comece pelo checkout se o modelo de liberacao ainda nao estiver pronto. O pagamento so deve dar acesso criando ou atualizando `course_releases`.

## 26. Regra de Manutencao deste Documento

Sempre que a estrutura de cursos, builder, player, liberacoes, checkout, pagamento, comissoes ou vendas de curso for alterada, este arquivo deve ser atualizado no mesmo commit.

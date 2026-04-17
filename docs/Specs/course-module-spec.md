# Especificação do Módulo de Curso

## 1. Objetivo

Este documento descreve a estrutura completa do módulo de cursos da plataforma, cobrindo construção administrativa, visão do aluno, controle de acesso, avaliações, materiais, conteúdo interativo e vendas.

A intenção é permitir que esta arquitetura seja reutilizada em outro projeto sem depender do contexto visual ou comercial específico da GenFlix.

## 2. Escopo Funcional

O módulo de curso é responsável por:

- Cadastro e publicação de cursos.
- Organização de módulos e aulas.
- Construção de conteúdo em blocos.
- Gestão de avaliações por módulo e avaliação final.
- Controle de liberação por aluno, grupo, compra e agenda.
- Player do aluno com progresso, bloqueios e navegação.
- Catálogo público e página pública de venda do curso.
- Checkout e matrícula automática.
- Relatórios e rastreabilidade mínima de vendas.
- Exportação/importação de conteúdo quando aplicável.

O módulo não deve concentrar lógica de identidade visual, autenticação global, gateway de pagamento específico ou regras editoriais do produto. Essas partes devem ser acopladas por configuração, serviços e adapters.

## 3. Papéis e Permissões

### Admin

Pode gerenciar todo o catálogo acadêmico e comercial:

- Criar, editar, publicar, arquivar e ordenar cursos.
- Criar e editar módulos, aulas, avaliações e materiais.
- Definir preço, slug, imagem pública, data de lançamento e visibilidade pública.
- Definir tipos de quiz disponíveis por curso.
- Liberar cursos manualmente para alunos e grupos.
- Configurar gateway de pagamento.
- Visualizar usuários, roles, formulários e relatórios administrativos.

### Criador

Pode acessar apenas áreas ligadas aos cursos vinculados a ele:

- Visualizar relatórios de vendas dos próprios cursos.
- Atualizar dados do próprio perfil.

Na v1, o criador não edita o builder completo do curso.

### Aluno

Pode:

- Navegar no site público.
- Comprar ou se matricular em cursos gratuitos.
- Acessar cursos liberados.
- Consumir aulas, materiais e avaliações.
- Acompanhar progresso.

## 4. Modelo de Domínio

### Course

Representa o produto educacional e comercial.

Campos principais:

- `id`: UUID.
- `title`: título interno e público.
- `description`: descrição base.
- `status`: `draft`, `published` ou `archived`.
- `display_order`: ordenação administrativa.
- `thumbnail_url`: imagem de capa.
- `slug`: URL pública amigável.
- `launch_date`: data de lançamento usada em relatórios e páginas públicas.
- `price_cents`: preço em centavos.
- `currency`: moeda, padrão `BRL`.
- `is_public`: controla aparição no catálogo público.
- `workload_minutes`: carga horária total.
- `has_linear_progression`: ativa bloqueio sequencial.
- `quiz_type_settings`: tipos de quiz permitidos no curso.
- `created_by`: usuário criador/admin responsável pela criação.
- `created_at` e `updated_at`.

Regras:

- Curso só aparece no catálogo se `status = published` e `is_public = true`.
- Curso gratuito usa `price_cents = 0`.
- Curso pago exige checkout antes da liberação.
- `slug` deve ser único quando usado em rota pública.
- Catálogo e detalhes públicos devem consultar o banco como visitante/anon, mesmo quando houver usuário logado, para não misturar regras públicas com RLS de cursos liberados do aluno.

### CourseModule

Agrupa aulas e avaliações de módulo.

Campos principais:

- `id`: UUID.
- `course_id`: curso pai.
- `title`: título do módulo.
- `description`: descrição opcional.
- `position`: posição dentro do curso.
- `is_required`: se conta como obrigatório.
- `starts_at`: início absoluto de liberação.
- `ends_at`: expiração absoluta.
- `release_days_after_enrollment`: liberação relativa após inscrição/liberação do aluno.
- `module_pdf_storage_path`: PDF-base do módulo.
- `module_pdf_file_name`: nome original do PDF.
- `module_pdf_uploaded_at`: data de upload.
- `created_at` e `updated_at`.

Regras:

- Módulo fora da janela de liberação bloqueia todas as aulas do módulo.
- Se houver `release_days_after_enrollment`, a liberação depende da data de matrícula/liberação do curso.
- Se data absoluta e dias após inscrição estiverem preenchidos, as regras são cumulativas.
- O PDF do módulo é opcional; se existir, pode ser personalizado com marca d'água do aluno.

### Lesson

Representa uma unidade de consumo do aluno.

Campos principais:

- `id`: UUID.
- `module_id`: módulo pai.
- `title`: título da aula.
- `description`: descrição curta.
- `position`: posição dentro do módulo.
- `is_required`: se conta para conclusão.
- `lesson_type`: `video`, `text` ou `hybrid`.
- `youtube_url`: vídeo externo quando aplicável.
- `text_content`: HTML serializado com blocos estruturados.
- `estimated_minutes`: carga horária estimada.
- `starts_at`: início absoluto de liberação.
- `ends_at`: expiração absoluta.
- `created_at` e `updated_at`.

Regras:

- Aula só é acessível se o curso, módulo e aula estiverem liberados.
- Em curso com progressão linear, aulas futuras dependem da conclusão das anteriores.
- Conteúdo textual e blocos interativos são persistidos em `text_content`.

### Assessment

Representa quiz ou avaliação.

Campos principais:

- `id`: UUID.
- `course_id`: curso pai.
- `module_id`: opcional para quiz de módulo.
- `type`: `module` ou `final`.
- `title`, `description`, `position`.
- `passing_score`, `max_attempts`, `grading_mode`.

Tipos de questão suportados:

- `single_choice`.
- `essay_ai`.
- `case_study_ai`.
- `case_study_single_choice`.
- `drag_drop_labeling`.
- `fill_in_the_blanks`.
- `image_hotspot`.
- `coloring`.

Regras:

- Tipos gamificados podem ser limitados globalmente e por curso.
- Em v1, alguns tipos gamificados ficam fora de estudos de caso.
- Avaliação vinculada a módulo segue a liberação do módulo.

### CourseRelease

Representa a autorização de acesso do aluno ao curso.

Campos principais:

- `course_id`.
- `user_id` ou `group_id`.
- `release_type`: `user` ou `group`.
- `starts_at` e `ends_at`.
- `is_active`.
- `release_source`: `purchase`, `free_enrollment`, `admin`, `group` ou `integration`.
- `release_status`: status operacional da liberação.
- `source_system`: origem externa ou interna.
- `external_reference_id`: referência do checkout ou integração.
- `managed_by_integration`.
- `revoked_at`.

Regras:

- Acesso do aluno depende de uma liberação ativa.
- Compra aprovada cria liberação individual.
- Liberação administrativa pode existir sem compra.
- Cancelamento antes de pagamento não libera acesso.
- Reversão de compra paga deve ser tratada explicitamente por regra de negócio do gateway.

## 5. Construção no Admin

### Entrada Principal

O admin acessa uma lista de cursos com busca, filtros, status e ações rápidas.

Fluxo esperado:

1. Criar curso.
2. Configurar dados acadêmicos e comerciais.
3. Criar módulos.
4. Criar aulas dentro dos módulos.
5. Adicionar conteúdo, materiais e avaliações.
6. Testar no visualizador.
7. Publicar.

### Builder do Curso

O builder deve ter navegação lateral com árvore:

- Visão geral do curso.
- Módulos.
- Aulas.
- Quizzes de módulo.
- Quiz final.

Cada item abre um painel de edição contextual.

### Configurações do Curso

Campos mínimos:

- Título.
- Descrição.
- Status.
- Imagem de capa.
- Slug público.
- Data de lançamento.
- Preço.
- Moeda.
- Visibilidade pública.
- Carga horária.
- Progressão linear.
- Tipos de quiz disponíveis.

Regras:

- Tipos de quiz desativados globalmente não aparecem no curso.
- Um tipo desativado no curso não deve aparecer como card de criação no builder.
- Alterações comerciais devem refletir na página pública de curso.
- Em plataformas independentes, o editor de curso não deve exigir campos de mapeamento externo, como `external_course_mappings`; integrações devem ficar isoladas em adapters opcionais.

### Módulos

Campos mínimos:

- Título.
- Descrição.
- Obrigatoriedade.
- Ordem.
- Liberação imediata ou data de início.
- Expiração opcional.
- Liberação após X dias da inscrição.
- PDF-base do módulo.

Comportamentos:

- Reordenação por posição.
- Upload, troca e remoção de PDF.
- Visualização do nome do arquivo enviado.
- Mensagens claras para regras cumulativas de agenda.

### Aulas

Campos mínimos:

- Título.
- Descrição curta.
- Tipo de aula.
- URL de vídeo.
- Conteúdo textual/blocos.
- Carga horária estimada.
- Obrigatoriedade.
- Liberação programada.
- Expiração opcional.

Tipos de aula:

- `video`: usa vídeo como conteúdo principal.
- `text`: usa blocos textuais e interativos.
- `hybrid`: combina vídeo e blocos.

### Blocos de Conteúdo

Os blocos são serializados dentro de `lessons.text_content` para preservar a ordem entre textos, tabelas e interações.

Tipos:

- `rich-text`: HTML rico básico.
- `table`: tabela estruturada.
- `image-hotspots`: imagem com pontos clicáveis que abrem modal.

Formato recomendado para blocos especiais:

```html
<div data-lms-block="image-hotspots" data-lms-payload="..."></div>
```

Observação de migração:

- A implementação atual pode conter um nome histórico de atributo, como `data-hcm-block`.
- Em novo projeto, recomenda-se trocar para um prefixo neutro, como `data-lms-block`, mantendo parser compatível durante migração.

### Bloco Image Hotspots de Aula

Finalidade:

- Complementar conteúdo de aula.
- Não possui nota, tentativa ou progresso próprio.

Conteúdo:

- Imagem base em bucket privado.
- Lista de hotspots pontuais.
- Cada hotspot possui `id`, `x`, `y`, `title` e `body_html`.

Editor:

- Upload de imagem.
- Clique na imagem para criar ponto.
- Arraste para reposicionar.
- Lista lateral de hotspots.
- Edição de título e corpo HTML.

Player:

- Renderiza imagem.
- Mostra marcadores.
- Ao clicar, abre card/modal próximo ao hotspot.
- Um hotspot aberto por vez.

### Materiais e Botões da Aula

Cada aula pode ter ações de rodapé.

Tipos:

- Arquivo enviado.
- URL externa.

Entidades:

- `button_templates`: define padrão visual, nome, ícone, variante, tema e status.
- `lesson_footer_actions`: vincula aula a template e destino real.

Regras:

- Template controla visual e rótulo padrão.
- Item da aula controla comportamento.
- Arquivos devem ser servidos por signed URL.
- URLs externas devem abrir em nova aba com segurança.

### PDF do Módulo

O admin pode subir um PDF-base por módulo.

No aluno:

- Se houver PDF-base, gerar cópia licenciada/personalizada.
- Se não houver PDF-base, usar fallback de exportação do conteúdo.

Marca d'água recomendada:

- Nome do aluno.
- E-mail.
- ID interno curto.
- Código de emissão/licença.

## 6. Avaliações e Quizzes

### Configuração Global

O admin pode ativar/desativar tipos de quiz globalmente.

Regra:

- Tipo desativado globalmente não aparece nas configurações do curso nem no builder.

### Configuração por Curso

Cada curso pode ativar/desativar os tipos permitidos globalmente.

Regra:

- Builder só mostra cards habilitados globalmente e no curso.

### Tipos Principais

`single_choice`:

- Questão objetiva simples.
- Correção automática.

`drag_drop_labeling`:

- Imagem com áreas e banco de respostas.
- Aluno arrasta rótulos para slots.

`fill_in_the_blanks`:

- Texto com lacunas.
- Aluno preenche campos.

`image_hotspot`:

- Imagem com hotspots retangulares.
- Modalidade `single_attempt` ou `find_all`.
- Pode ter feedback por hotspot e clique fora.

`coloring`:

- Modo legado por pontos/retângulos.
- Modo recomendado por SVG com regiões.
- Correção por `region_id` ou ponto e cor selecionada.

### Correção

Modos:

- `partial_by_item`: pontuação proporcional.
- `all_or_nothing`: só pontua com todos os itens corretos.

Regras:

- Payload do aluno deve ser validado no backend.
- O backend é fonte da pontuação.
- O player pode mostrar feedback, mas não define nota final sozinho.

## 7. Visão do Aluno

### Catálogo Público

Lista cursos publicados e públicos.

Exibe:

- Capa.
- Título.
- Categoria ou área.
- Resumo.
- Preço.
- CTA de inscrição ou compra.

Regra:

- Usuário logado pode navegar no site público sem redirecionamento automático para painel.

### Página Pública do Curso

Exibe:

- Hero do curso.
- Descrição.
- O que o aluno vai aprender.
- Conteúdo programático.
- Instrutor/criador quando aplicável.
- Preço.
- Botão de compra ou acesso.

Comportamentos:

- Se aluno já tem liberação, CTA leva ao curso.
- Se curso é gratuito, CTA pode liberar acesso diretamente.
- Se curso é pago, CTA inicia checkout.

### Dashboard do Aluno

Exibe cursos liberados para o aluno.

Estados:

- Não iniciado.
- Em andamento.
- Concluído.
- Bloqueado por agenda.
- Expirado.

### Página Interna do Curso

Exibe:

- Progresso geral.
- Módulos.
- Aulas.
- Quizzes.
- Estados de bloqueio.

Regras:

- Módulo bloqueado bloqueia suas aulas.
- Aula bloqueada por agenda permanece bloqueada mesmo se o módulo estiver livre.
- Progressão linear bloqueia próximas aulas até concluir anteriores.

### Player da Aula

Elementos:

- Sidebar com curso, módulos, aulas e quizzes.
- Área principal de conteúdo.
- Vídeo quando existir.
- Blocos de conteúdo.
- Botões de rodapé da aula.
- Botão de conclusão.
- Navegação anterior/próxima.

Comportamentos:

- Concluir aula grava `lesson_progress`.
- Player respeita bloqueios vindos das RPCs de acesso.
- Conteúdos privados usam signed URL.
- Quizzes são acessados dentro do fluxo do curso.

## 8. Regras de Acesso

O acesso efetivo do aluno depende da combinação:

- Curso publicado.
- Curso liberado para o aluno ou grupo.
- Release ativo e dentro da validade.
- Módulo dentro da janela de liberação.
- Liberação relativa do módulo atendida.
- Aula dentro da janela de liberação.
- Progressão linear atendida.

Regra operacional:

- A condição mais restritiva vence.
- Um curso liberado não ignora agenda de módulo/aula.
- Uma aula liberada não ignora módulo bloqueado.
- Acesso direto por URL deve consultar as mesmas regras do player.

RPCs recomendadas:

- `get_student_course_status`.
- `get_student_course_modules_progress`.
- `get_student_unlocked_lessons_progress`.
- `get_student_course_assessments`.

## 9. Vendas, Checkout e Matrícula Automática

### Configuração Comercial do Curso

Campos mínimos no curso:

- `price_cents`.
- `currency`.
- `is_public`.
- `slug`.
- `launch_date`.

Regras:

- `price_cents = 0` representa curso gratuito.
- Curso gratuito pode gerar liberação direta.
- Curso pago exige checkout aprovado.

### Gateway de Pagamento

O gateway atual é Asaas, mas a arquitetura deve tratar o gateway como adapter.

Configuração administrativa:

- Gateway ativo.
- Ambiente `sandbox` ou `production`.
- URL de webhook.
- Checklist de variáveis necessárias.

Variáveis recomendadas:

- `ASAAS_ACCESS_TOKEN_SANDBOX`.
- `ASAAS_ACCESS_TOKEN_PRODUCTION`.
- `ASAAS_ACCESS_TOKEN`.
- `ASAAS_WEBHOOK_SECRET`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `VITE_SUPABASE_URL`.
- `VITE_SUPABASE_ANON_KEY`.

### Tabelas de Comércio

`payment_gateway_settings`:

- Define gateway ativo, ambiente e metadados.
- Deve sempre ter o registro singleton `id = 1`.

`commerce_checkout_sessions`:

- Guarda a sessão de checkout.
- Vincula curso, usuário, comprador e referência externa.
- Status: `created`, `active`, `paid`, `canceled`, `expired`, `failed`.
- Deve aceitar migração idempotente para bancos que já tenham uma versão parcial da tabela, garantindo colunas como `external_checkout_id`, `external_payment_id`, `gateway_environment`, `checkout_url` e `released_at`.

`commerce_events`:

- Guarda eventos recebidos do gateway.
- Permite idempotência.
- Status: `received`, `processed`, `ignored`, `failed`.
- Deve aceitar migração idempotente para bancos parciais, garantindo `external_event_id`, `external_checkout_id`, `external_payment_id`, `gateway_environment`, `status` e `received_at`.

### Fluxo de Curso Gratuito

1. Aluno autenticado clica em acessar/inscrever.
2. API valida curso publicado e público.
3. Sistema cria `course_releases` com origem `free_enrollment` ou `purchase` gratuita.
4. API retorna URL interna do curso.

### Fluxo de Curso Pago

1. Aluno autenticado clica em comprar.
2. Frontend chama `POST /api/checkout/asaas/start`.
3. API valida token do usuário.
4. API carrega perfil e curso.
5. API cria sessão local em `commerce_checkout_sessions`.
6. API cria checkout no Asaas.
7. API salva `checkout_url`.
8. Frontend redireciona aluno para checkout hospedado.
9. Asaas chama webhook.
10. Webhook persiste evento idempotente.
11. Em pagamento confirmado, webhook cria `course_releases`.
12. Aluno acessa o curso.

### Webhook

Endpoint:

```text
POST /api/webhooks/asaas
```

Regras:

- Validar segredo quando configurado.
- Ignorar eventos duplicados.
- Persistir payload bruto.
- Processar apenas eventos reconhecidos.
- Não confiar em dados enviados pelo frontend para liberar acesso.

Eventos mínimos:

- Pagamento confirmado: libera curso.
- Checkout cancelado: marca sessão como cancelada se ainda não paga.
- Checkout expirado: marca sessão como expirada se ainda não paga.

Extensões recomendadas:

- Reembolso confirmado revoga liberação gerenciada pelo gateway.
- Chargeback bloqueia acesso e sinaliza revisão administrativa.
- Compra de curso já liberado redireciona para o curso sem novo checkout.

## 10. Storage e Arquivos

Buckets recomendados:

- `materials`: materiais legados ou gerais.
- `module-pdfs`: PDFs-base de módulo.
- `lesson-footer-assets`: arquivos dos botões de aula.
- `lesson-content-assets`: imagens de blocos interativos.

Regras:

- Buckets privados para conteúdo de curso.
- Admin pode fazer upload e gerenciar.
- Aluno acessa via signed URL.
- URLs assinadas não devem ser persistidas como fonte definitiva.

## 11. APIs e Serviços

### Admin Content API

Responsável por:

- CRUD de cursos.
- CRUD de módulos.
- CRUD de aulas.
- Upload e remoção de assets.
- Geração de signed URLs.
- Importação/exportação.

### Student Course API

Responsável por:

- Listar cursos liberados.
- Carregar curso com progresso.
- Carregar status de jornada.
- Marcar aula como concluída.

### Checkout API

Responsável por:

- Iniciar checkout.
- Liberar cursos gratuitos.
- Criar sessão de checkout paga.
- Retornar URL hospedada.

### Webhook API

Responsável por:

- Receber eventos do gateway.
- Deduplicar eventos.
- Atualizar sessão.
- Criar ou alterar liberação.

## 12. Segurança

Regras mínimas:

- Operações administrativas exigem role `admin`.
- Criador só acessa dados dos cursos vinculados.
- Aluno só acessa cursos liberados.
- Checkout exige usuário autenticado.
- Webhook usa service role no backend.
- Chaves privadas nunca vão para frontend.
- Arquivos privados usam signed URL.
- RLS deve permitir leitura pública apenas de cursos publicados e públicos.

## 13. Estados e UX

Estados de curso:

- Rascunho.
- Publicado.
- Arquivado.

Estados de acesso:

- Liberado.
- Bloqueado por compra.
- Bloqueado por agenda.
- Bloqueado por sequência.
- Expirado.

Estados de checkout:

- Criado.
- Ativo.
- Pago.
- Cancelado.
- Expirado.
- Falhou.

UX recomendada:

- Diferenciar bloqueio por agenda de bloqueio sequencial.
- Mostrar curso comprado imediatamente após confirmação.
- Em pagamento pendente, informar que acesso depende da confirmação.
- Em aulas com materiais, mostrar botões simples no rodapé.

## 14. Estrutura de Código Recomendada

```text
src/
  types/
    content.ts
  features/
    admin/
      content/
        api.ts
        schemas.ts
        content-blocks.ts
        content-blocks-renderer.tsx
    student/
      courses/
        api.ts
      assessments/
  pages/
    admin/
      admin-courses-page.tsx
      builder/
      admin-payment-settings-page.tsx
    public/
      public-courses-page.tsx
      public-course-details-page.tsx
    student/
      student-dashboard-page.tsx
      student-course-details-page.tsx
      student-course-player-layout.tsx
      student-lesson-page.tsx
api/
  checkout/
    asaas/
      start.ts
  webhooks/
    asaas.ts
supabase/
  migrations/
```

## 15. Migrations Necessárias

Para reutilizar o módulo, separar migrations por domínio:

- Base acadêmica: cursos, módulos, aulas e materiais.
- Liberação de curso: releases por usuário/grupo.
- Progresso: progresso de aula, curso e bloqueio sequencial.
- Avaliações: assessments, questions, attempts e submissions.
- PDF e botões de aula: PDF de módulo, templates e ações de rodapé.
- Agenda: datas absolutas e liberação relativa.
- Tipos de quiz: configuração global e por curso.
- Blocos interativos: bucket de assets de aula.
- Comércio: campos comerciais do curso, gateway, checkout sessions e eventos.

## 16. Critérios de Aceite

Admin:

- Criar curso completo com módulo, aula, conteúdo e avaliação.
- Publicar curso e visualizar no catálogo.
- Configurar preço, slug e visibilidade.
- Configurar gateway e visualizar webhook.
- Vincular materiais e botões de aula.
- Configurar agendas de módulo/aula.

Aluno:

- Comprar curso pago e receber acesso após webhook.
- Entrar em curso gratuito sem pagamento.
- Consumir aula no player.
- Marcar aula como concluída.
- Ver bloqueios corretos.
- Resolver quizzes.
- Baixar materiais permitidos.

Comércio:

- Checkout criado com usuário autenticado.
- Webhook processa evento uma vez.
- Pagamento confirmado cria liberação.
- Cancelamento/expiração não libera curso.
- Eventos ficam auditáveis.

Segurança:

- Aluno sem liberação não acessa player por URL direta.
- Arquivos privados não ficam públicos.
- Chaves do gateway não aparecem no frontend.
- Admin e aluno respeitam roles.

## 17. Checklist para Reutilizar em Outro Projeto

1. Copiar tipos de domínio de curso, módulo, aula, avaliações e releases.
2. Aplicar migrations em ordem por domínio.
3. Criar buckets privados de conteúdo.
4. Configurar RLS para admin, aluno, criador e leitura pública de catálogo.
5. Implementar builder administrativo.
6. Implementar player do aluno consultando RPCs de acesso.
7. Implementar catálogo público.
8. Implementar adapter de pagamento.
9. Implementar webhook idempotente.
10. Validar fluxo gratuito e pago.
11. Adaptar identidade visual.
12. Renomear atributos legados de bloco para prefixo neutro do novo produto.

## 18. Decisões Arquiteturais

- Curso é o centro acadêmico e comercial.
- O acesso é sempre derivado de releases, não apenas de compra.
- Pagamento cria release; release libera curso.
- Agenda e progressão são camadas adicionais sobre a liberação.
- Conteúdo de aula usa blocos serializados para preservar ordem e flexibilidade.
- Quizzes são parte do domínio acadêmico, mas respeitam configurações globais e por curso.
- Gateway de pagamento deve ser substituível por adapter.
- Player do aluno nunca deve confiar apenas em estado local para liberar conteúdo.

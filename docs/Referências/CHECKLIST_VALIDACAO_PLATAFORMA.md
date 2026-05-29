# Checklist de Validacao da Plataforma (T106)

Este checklist foi criado para apoiar a validacao funcional da plataforma por setor, modulo e funcionalidade.

## Como usar

- Marque `[OK]` quando o item for validado.
- Marque `[NOK]` quando houver falha e registre evidencias (print, erro, rota, horario).
- Marque `[NA]` quando o item nao se aplicar ao escopo atual do teste.

---

## Setor Publico

### Modulo Home e Navegacao Publica
- [OK] Home (`/`) carrega sem erro de console.
- [OK] Header, menu e rodape exibem corretamente em desktop e mobile.
- [OK] Links principais do menu publico redirecionam para as rotas corretas.
- [OK] SEO basico da pagina inicial (title/description) aparece no HTML final.

### Modulo Catalogo e Conversao
- [OK] Pagina de cursos (`/cursos`) lista cursos sem falha.
- [OK] Detalhe do curso (`/cursos/:slug`) abre com dados validos.
- [OK] Fluxo de checkout (`/checkout/pagamento/:slug`) abre corretamente.
- [OK] Confirmacao de checkout (`/checkout/confirmacao`) exibe status esperado.

### Modulo Conteudo Publico
- [OK] Blog (`/blog`) carrega lista de posts.
- [OK] Post individual (`/blog/:slug`) renderiza conteudo sem quebrar layout.
- [OK] Pagina de recursos (`/recursos`) carrega cards e blocos esperados.
- [OK] Pagina comunidade (`/comunidade`) carrega sem erros.

### Modulo Contato e Suporte Publico
- [OK] Pagina contato (`/contato`) abre e permite envio de formulario.
- [OK] Pagina suporte (`/suporte`) carrega FAQ e canais previstos.
- [OK] Pagina ajuda (`/ajuda`) carrega layout padrao da plataforma.
- [OK] Pagina indique (`/indique-a-genflix`) permite compartilhamento/envio conforme fluxo.
- [OK] Pagina ensine (`/ensine-na-genflix`) carrega formulario esperado.

### Modulo Autenticacao Publica
- [OK] Login (`/login`) autentica usuario valido.
- [OK] Criacao de conta (`/criar-conta`) conclui cadastro valido.
- [OK] Recuperacao de senha (`/recuperar-senha`) envia fluxo corretamente.
- [OK] Redefinicao (`/redefinir-senha`) atualiza senha com token valido.
- [OK] Callback (`/auth/callback`) finaliza sessao sem erro.

### Modulo Paginas Legais
- [OK] Privacidade (`/privacidade`) carrega corretamente.
- [OK] Cookies (`/cookies`) carrega corretamente.
- [OK] Termos (`/termos-de-uso`) carrega corretamente.
- [OK] Politica de reembolso (`/politica-de-reembolso`) carrega corretamente.

---

## Setor Aluno

### Modulo Dashboard e Area do Aluno
- [OK] Dashboard (`/aluno/dashboard`) carrega com dados do usuario logado.
- [OK] Lista de cursos (`/aluno/cursos`) exibe cursos liberados.
- [OK] Detalhe do curso (`/aluno/cursos/:courseId`) carrega progresso/status.
- [OK] Minha conta (`/aluno/minha-conta`) salva alteracoes basicas.
- [OK] Pagamentos (`/aluno/pagamentos`) mostra historico conforme perfil.

### Modulo Player de Curso
- [OK] Player (`/aluno/cursos/:courseId/player`) abre sem erro.
- [OK] Aula (`.../aulas/:lessonId`) carrega video/conteudo corretamente.
- [OK] Avaliacao (`.../avaliacoes/:assessmentId`) inicia e finaliza.
- [OK] Navegacao entre modulos/aulas respeita regras configuradas.

### Modulo Comunicacao e Suporte do Aluno
- [OK] Mensagens (`/aluno/mensagens`) abre e lista conversas.
- [OK] Tickets (`/aluno/suporte`) permite criar e acompanhar chamado.
- [OK] Detalhe do ticket (`/aluno/suporte/:ticketId`) exibe timeline.

---

## Setor Criador

### Modulo Perfil e Relatorios do Criador
- [OK] Relatorios (`/criador/relatorios`) carregam sem erro.
- [OK] Perfil (`/criador/perfil`) salva alteracoes esperadas.
- [OK] Notificacoes (`/criador/notificacoes`) lista eventos corretamente.

### Modulo Comunicacao e Suporte do Criador
- [OK] Mensagens (`/criador/mensagens`) abre e permite interacao.
- [OK] Suporte (`/criador/suporte`) cria e acompanha tickets.

---

## Setor Admin

### Modulo Visao Geral e Operacao
- [OK] Dashboard (`/admin`) carrega metricas principais.
- [OK] Relatorios (`/admin/relatorios`) carrega indicadores.
- [OK] Pendencias (`/admin/pendencias`) exibe itens operacionais.
- [OK] Storage R2 (`/admin/storage-r2`) carrega uso, custo estimado e navegacao de arquivos.

### Modulo Catalogo e Cursos
- [OK] Catalogo (`/admin/cursos`) lista cursos e categorias.
- [OK] Modulos do curso (`/admin/cursos/:courseId/modulos`) CRUD funcional.
- [OK] Aulas do modulo (`/admin/modulos/:moduleId/aulas`) CRUD funcional.
- [OK] Materiais da aula (`/admin/aulas/:lessonId/materiais`) CRUD funcional.
- [OK] Liberacoes (`/admin/cursos/:courseId/liberacoes`) CRUD funcional.

### Modulo Course Builder
- [OK] Builder principal (`/admin/cursos/:courseId/builder`) abre sem erro.
- [OK] Editor de modulo (`.../modulos/:moduleId`) salva alteracoes.
- [OK] Editor de aula (`.../aulas/:lessonId`) salva conteudo e midias.
- [OK] Materiais no builder (`.../aulas/:lessonId/materiais`) funciona corretamente.
- [OK] Avaliacoes (`.../avaliacoes/:assessmentId`) salva e publica regras.
- [OK] Public page (`.../public-page`) reflete configuracoes no front publico.
- [OK] Settings (`.../settings`) persiste configuracoes do curso.
- [OK] Releases (`.../releases`) aplica regras de acesso esperadas.
- [OK] Assessments final (`.../assessments` e `.../assessments/final`) funciona sem erro.

### Modulo Conteudo e Marketing
- [OK] Blog (`/admin/blog`) CRUD completo.
- [OK] Banners (`/admin/banners`) CRUD e historico/revisao funcionando.
- [OK] Botoes de aula (`/admin/botoes-aula`) CRUD funcional.
- [OK] Recursos (`/admin/recursos`) CRUD e player publico corretos.
- [OK] Tipos de quiz (`/admin/tipos-quiz`) CRUD funcional.
- [OK] Editor visual (`/admin/site-editor`) edicao por secao/container habilitada.

### Modulo Comunidade e Atendimento
- [ ] Usuarios (`/admin/usuarios`) listagem e acoes principais.
- [ ] Grupos (`/admin/grupos`) CRUD funcional.
- [ ] Notificacoes (`/admin/notificacoes`) envio/listagem funcional.
- [ ] Mensagens (`/admin/mensagens`) abre e opera sem erro.
- [ ] Tickets (`/admin/suporte`) fluxo completo de atendimento.
- [ ] FAQ (`/admin/faq`) CRUD funcional.
- [ ] Reviews (`/admin/reviews`) modera/lista corretamente.
- [ ] Formularios (`/admin/formularios`) entradas e filtros funcionando.

### Modulo Financeiro
- [ ] Pagamentos (`/admin/pagamentos`) parametros e logs consistentes.
- [ ] Repasses (`/admin/repasses`) lista e acoes operacionais funcionando.

### Modulo Configuracao da Plataforma
- [ ] Minha conta (`/admin/minha-conta`) atualiza dados corretamente.
- [ ] Configuracoes do site (`/admin/configuracoes-site`) persiste alteracoes.

---

## Setor Infraestrutura e Integracoes

### Modulo Auth e Permissoes
- [ ] Rotas protegidas respeitam perfis (`admin`, `aluno`, `criador`).
- [ ] Sessao expirada redireciona corretamente para login.
- [ ] Rota nao autorizada usa tela de bloqueio adequada.

### Modulo Storage e Midia
- [ ] Upload de arquivos protegidos no R2 conclui sem erro.
- [ ] Exclusao de arquivos no R2 remove item e atualiza listagem.
- [ ] Acesso protegido a assets da aula funciona para usuario permitido.

### Modulo Edge Functions e APIs
- [ ] Funcoes administrativas respondem com auth valida.
- [ ] CORS das funcoes principais nao bloqueia frontend em producao.
- [ ] Tratamento de erro retorna mensagem clara para o usuario.

### Modulo Deploy e Observabilidade
- [ ] Build version no rodape corresponde ao ultimo deploy.
- [ ] Dominio `genflix-omega.vercel.app` aponta para deploy READY esperado.
- [ ] Logs de console em fluxos criticos sem erros bloqueantes recorrentes.

---

## Registro de Validacao

- Ciclo:
- Ambiente:
- Responsavel:
- Data:
- Resultado geral:
- Riscos/Pendencias:

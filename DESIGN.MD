# DESIGN - Paginas publicas da Mariana Explica

Documento criado para orientar uma repaginacao visual das paginas publicas do site na plataforma Stitch.

Data de referencia: 23/04/2026.

## 1. Objetivo do redesign

Repaginar a area publica da plataforma Mariana Explica mantendo a logica funcional existente:

- apresentar a marca Mariana Explica com mais personalidade visual;
- vender cursos, sebentas, packs e materiais gratuitos com clareza;
- conduzir o usuario ao catalogo, pagina do curso e checkout;
- manter login, criacao de conta e area do aluno acessiveis;
- manter suporte publico como ponto de orientacao;
- preservar rotas e CTAs importantes para nao quebrar fluxo comercial.

O redesign pode mudar layout, hierarquia visual, ritmo, composicao, cards, imagens, cores secundarias e microinteracoes. Nao deve mudar a regra de negocio: compra, login, checkout, ativacao gratuita, grants de acesso e chamados continuam sendo tratados pela aplicacao atual.

## 2. Stack e contexto tecnico

Frontend atual:

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui base
- Lucide React para icones
- Fontes via Google Fonts: `Arvo` e `Inter`

Layout publico atual:

- `PublicLayout` envolve todas as paginas publicas.
- Estrutura fixa: `Navbar` no topo, `main` com conteudo da rota, `Footer` no final.
- Header e rodape aparecem em todas as paginas publicas, inclusive login/criar conta por outra composicao de layout.
- Dashboard e admin possuem layouts separados e nao fazem parte deste redesign.

Arquivos principais:

- `src/layouts/PublicLayout.tsx`
- `src/components/common/Navbar.tsx`
- `src/components/common/Footer.tsx`
- `src/pages/public/Home.tsx`
- `src/pages/public/Products.tsx`
- `src/pages/public/Product.tsx`
- `src/pages/public/Checkout.tsx`
- `src/pages/public/Support.tsx`
- `src/components/product/ProductCard.tsx`
- `src/components/reviews/CourseReviews.tsx`
- `src/styles/globals.css`
- `tailwind.config.js`

## 3. Rotas publicas existentes

Rotas principais:

- `/` - Home publica
- `/cursos` - Catalogo de cursos/produtos
- `/cursos/:slug` - Pagina publica de cada curso
- `/checkout?slug=...` - Checkout interno antes de Stripe ou ativacao gratuita
- `/suporte` - Suporte publico e FAQ
- `/login` - Login
- `/register` - Criar conta
- `/criar-conta` - Alias de criar conta
- `/recuperar-senha` - Recuperacao
- `/redefinir-senha` - Redefinicao

Aliases legados:

- `/produtos` redireciona para `/cursos`
- `/produto/:slug` redireciona para `/cursos/:slug`

Rotas privadas citadas nas paginas publicas:

- `/aluno/dashboard`
- `/aluno/chamados`
- `/admin`

## 4. Identidade visual atual

Marca:

- Nome: Mariana Explica
- Proposta: cursos e materiais digitais claros para exames nacionais, com compra simples e area do aluno organizada.
- Tom: educacional, claro, acolhedor, objetivo e confiavel.

Fonte de titulo:

- `Arvo`
- Usada via classe Tailwind `font-display`.
- Headings globais tambem herdam `Arvo`.

Fonte de interface:

- `Inter`
- Usada para corpo, botoes, inputs, labels e textos auxiliares.

Cores configuradas no tema:

- Primaria: `#242742` aproximado, via HSL `236 28% 21%`
- Fundo base: azul muito claro, via HSL `196 58% 96%`
- Secundaria: azul claro, via HSL `198 46% 90%`
- Muted: azul/cinza claro, via HSL `197 36% 92%`
- Accent: azul claro, via HSL `194 60% 92%`
- Texto principal: slate escuro, via HSL `230 32% 14%`
- Borda: azul/cinza claro, via HSL `201 28% 84%`
- Sucesso: verde, via HSL `152 48% 39%`
- Warning: amarelo/laranja, via HSL `39 91% 51%`

Estilo visual atual:

- fundos claros com gradientes suaves;
- muito uso de branco, slate, azul claro e azul-marinho;
- cards arredondados, frequentemente `rounded-[1.75rem]` ou `rounded-[2rem]`;
- CTAs em azul-marinho/primary;
- botoes em formato pill (`rounded-full`);
- icones lineares Lucide;
- sombras leves em cards e shadows mais fortes em destaques;
- composicoes com muito espaco e containers centralizados.

Observacao para redesign:

O visual atual e funcional, mas ainda parece bastante "template SaaS educacional". A repaginacao pode trazer mais personalidade editorial, mais presenca da marca Mariana Explica e melhor uso de assets reais dos cursos/capas.

## 5. Design system atual

Container:

- Tailwind `container` centralizado.
- Padding lateral padrao: `2rem`.
- Largura maxima no breakpoint `2xl`: `1400px`.

Raios:

- Tema global: `--radius: 1rem`.
- Botoes base usam `rounded-md`, mas a UI publica frequentemente sobrescreve para `rounded-full`.
- Cards publicos usam raios grandes (`1.5rem`, `1.75rem`, `2rem`).

Botoes:

- Componente base: `Button`.
- Variantes: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`.
- Tamanhos: `default`, `sm`, `lg`, `icon`.
- Na area publica, os CTAs principais costumam usar:
  - `size="lg"`
  - `className="rounded-full"`
  - icone `ArrowRight` no fim.

Estados:

- Loading: `LoadingState`
- Erro: `ErrorState`
- Vazio: `EmptyState`
- Esses componentes devem continuar existindo ou ter equivalentes visuais.

Iconografia:

- Biblioteca: `lucide-react`
- Icones usados com frequencia:
  - `GraduationCap`
  - `Sparkles`
  - `ArrowRight`
  - `ShieldCheck`
  - `CheckCircle2`
  - `BookOpenCheck`
  - `Search`
  - `LifeBuoy`
  - `Lock`
  - `Star`

## 6. Navbar publica atual

Arquivo: `src/components/common/Navbar.tsx`

Comportamento:

- Sticky no topo (`sticky top-0 z-50`).
- Fundo branco transluscido com blur.
- Borda inferior clara.
- Menu desktop em `lg`.
- Menu mobile com botao hamburger.

Logo atual:

- Icone `GraduationCap` dentro de quadrado arredondado azul-marinho.
- Texto `Mariana Explica` em `Arvo`.

Links principais:

- Cursos -> `/cursos`
- Suporte -> `/suporte`
- Admin -> `/admin`, apenas se usuario autenticado for admin.

Estado deslogado:

- Selo textual: "Exames nacionais e materiais digitais"
- Botao ghost: "Entrar"
- Botao primario: "Ver cursos"

Estado logado:

- Se admin: botao "Operacao" com icone `ShieldCheck` para `/admin`
- Se aluno: botao "Area do Aluno" com icone `LayoutDashboard` para `/aluno/dashboard`
- Botao secundario: "Sair"

Mobile:

- Abre painel abaixo da navbar.
- Mostra nome da marca, links em cards e botoes de acao.

Pontos para Stitch considerar:

- Header pode ganhar mais identidade de marca, talvez com logotipo real em vez de icone generico.
- Menu deve continuar simples: Cursos, Suporte, Entrar/Area do Aluno.
- Evitar menu pesado; a conversao principal e explorar cursos.

## 7. Footer publico atual

Arquivo: `src/components/common/Footer.tsx`

Estrutura:

- Fundo com gradiente claro `#f5fbfd` para `#eef7fb`.
- Grid em desktop com duas colunas:
  - coluna de marca/descritivo;
  - links agrupados.
- Rodape inferior com copyright e build atual.

Conteudo:

- Nome da marca: Mariana Explica.
- Descricao global: "Cursos e materiais claros para exames nacionais, compra simples e area do aluno organizada."
- Texto institucional curto sobre explicar melhor, vender com clareza e acesso simples.

Links:

- Home
- Cursos
- Suporte
- Criar conta
- Entrar
- Area do aluno, se nao for admin
- Admin

Build:

- Exibido discretamente como `Build {BUILD_VERSION}`.
- Deve continuar discreto.

Pontos para Stitch considerar:

- Footer pode ficar mais editorial e menos generico.
- Pode incluir microcopy de confianca, privacidade, acesso digital, suporte e contato.
- Deve manter links essenciais e build discreto.

## 8. Home publica atual

Arquivo: `src/pages/public/Home.tsx`

Objetivo atual:

- Apresentar a proposta da plataforma.
- Explicar tipos de oferta.
- Mostrar cursos em destaque.
- Explicar como funciona.
- Reforcar confianca.
- Levar para catalogo ou criar conta.

Estrutura atual:

1. Hero
2. Bloco "Oferta principal"
3. Cursos em destaque
4. Como funciona
5. Bloco de confianca e CTA final

### 8.1 Hero atual

Layout:

- Secao full-width com borda inferior.
- Fundo com gradientes radiais e linear claro.
- Grid em desktop:
  - esquerda: copy e CTAs;
  - direita: card visual azul-marinho.

Copy principal:

- Eyebrow/pill: "Materiais para exames nacionais, compra simples e acesso organizado"
- H1: "Aprende com mais clareza, escolhe o material certo e continua a estudar no mesmo lugar."
- Paragrafo: menciona sebentas, packs, materiais gratuitos e apoio organizado.

CTAs:

- "Explorar cursos" -> `/cursos`
- "Criar conta" -> `/register`

Cards de beneficios no hero:

- "Clareza para estudar melhor"
- "Compra curta e previsivel"
- "Acesso organizado na conta"

Card visual lateral:

- Fundo azul-marinho em gradiente.
- Texto "Estrutura orientada ao aluno".
- Mini-cards internos:
  - Mobile primeiro
  - Acesso centralizado

Ponto de melhoria:

- O hero atual nao usa imagem real da Mariana, nem capas reais, nem mockup forte da plataforma.
- Pode ficar mais memoravel com uma composicao visual mais propria: foto, recorte, cards de cursos reais, mockup mobile ou materiais/ebooks.

### 8.2 Oferta principal

Estrutura:

- Card introdutor com titulo e paragrafo.
- Grid de 4 tipos de oferta:
  - Packs completos
  - Sebentas individuais
  - Materiais gratuitos
  - Explicacoes online

Visual:

- Cards brancos, borda leve, icone primary, titulo em Arvo.

Ponto de melhoria:

- Pode virar uma secao mais visual, com navegacao por categorias, cards menos repetitivos e exemplos reais.

### 8.3 Cursos em destaque

Dados:

- Usa `useFeaturedProducts`.
- Se houver produtos em destaque, renderiza `ProductCard`.
- Se nao houver, mostra cards fallback para packs, sebentas, gratuitos e area do aluno.

Copy:

- Eyebrow: "Cursos em destaque"
- H2: "Comeca pelo curso que melhor responde ao teu objetivo."
- Texto: cursos publicados com copy clara e caminho curto entre descoberta, compra e acesso.

CTA secundario:

- "Ver catalogo completo" -> `/cursos`

Ponto de melhoria:

- O grid e funcional, mas os cards sao longos e densos.
- Stitch pode propor uma vitrine mais seletiva, com foco em capas, disciplina, preco e CTA.

### 8.4 Como funciona

Passos:

- 1. Escolhe o curso certo
- 2. Ativa ou compra sem ruido visual
- 3. Continua no dashboard

Visual:

- Fundo branco/translucido com bordas.
- Tres cards.

Ponto de melhoria:

- Pode ganhar linha de progresso, timeline, mockups ou ilustracao de jornada.

### 8.5 Bloco de confianca e CTA final

Coluna esquerda:

- "Porque transmite confianca"
- Lista com checks:
  - fluxo para exames nacionais;
  - compra e acesso associados a conta;
  - experiencia mobile primeiro.

Coluna direita:

- Fundo azul-marinho em gradiente.
- Headline sobre menos duvida na compra e mais clareza depois do acesso.
- Cards:
  - Compra simples
  - Area do aluno organizada
  - Experiencia confiavel
- CTAs:
  - "Explorar cursos"
  - "Criar conta"

Ponto de melhoria:

- Pode usar depoimentos, numeros, reviews ou provas reais quando houver.

## 9. Catalogo de cursos atual

Arquivo: `src/pages/public/Products.tsx`

Rota: `/cursos`

Objetivo:

- Listar cursos/produtos publicados.
- Permitir busca textual.
- Permitir filtros rapidos.
- Levar para a pagina publica de cada curso.

### 9.1 Hero/catalogo

Visual:

- Pagina com fundo branco.
- Container com espaco vertical.
- Hero em card arredondado com gradiente claro.

Copy:

- Eyebrow: "Catalogo pensado para escolher sem confusao"
- H1: "Encontra o curso certo para o teu momento de estudo."
- Texto: explicar que nao e lista fria, mas ajuda a escolher entre curso, pack, gratuito ou apoio.

Filtros rapidos:

- Todos
- Packs
- Sebentas
- Gratuitos
- Explicacoes

### 9.2 Busca

Campo:

- Placeholder: "Pesquisar por tema, curso ou descricao..."
- Icone `Search`
- Busca em titulo, descricao, tipo e familia inferida.

Botoes laterais:

- "Voltar a home"
- "Criar conta"

### 9.3 Grid de produtos

Componente: `ProductCard`

Layout:

- Grid responsivo:
  - mobile: 1 coluna
  - md: 2 colunas
  - xl: 3 colunas

Estados:

- Loading: "A carregar catalogo..."
- Erro: "Falha ao carregar o catalogo"
- Vazio: "Nenhum curso encontrado"

Contador:

- Exibe quantidade encontrada e filtro ativo.

Pontos para Stitch considerar:

- Catalogo poderia ter filtros mais elegantes e cards mais escaneaveis.
- O filtro atual e textual/simples; nao ha sidebar complexa.
- Manter a acao "Ver detalhes".
- Evitar esconder preco, tipo e beneficio principal.

## 10. Card de produto atual

Arquivo: `src/components/product/ProductCard.tsx`

Uso:

- Home, catalogo e outros grids.

Estrutura:

1. Imagem/capa em `aspect-[16/9]`
2. Badges sobre a imagem:
   - tipo: Pago, Gratuito, Hibrido, Servico externo
   - "Destaque", se `is_featured`
3. Familia do produto:
   - Pack completo
   - Sebenta de Filosofia
   - Sebenta de Portugues
   - Material de apoio
   - Kit de organizacao
   - Apoio personalizado
   - Material gratuito
   - Curso digital
4. Titulo
5. Resumo narrativo
6. Bloco "Beneficio principal"
7. Bloco "Formato e entrega"
8. Bloco "Como acedes"
9. Preco
10. CTA

Fallback sem capa:

- Fundo em gradiente azul-marinho/azul-claro.
- Texto sobreposto no canto inferior.

CTA:

- Normalmente "Ver detalhes"
- Link para `/cursos/:slug`

Ponto de melhoria:

- Card atual comunica bastante informacao, mas pode ficar pesado visualmente.
- Redesign pode criar uma versao mais editorial, compacta e premium para catalogo.
- Para home, uma versao mais destacada do primeiro curso pode converter melhor.

## 11. Pagina publica do curso atual

Arquivo: `src/pages/public/Product.tsx`

Rota: `/cursos/:slug`

Objetivo:

- Converter visita em compra/ativacao.
- Explicar curso/material.
- Mostrar conteudo, preco, capa, instrutor, features e reviews.

Dados:

- Usa `usePublishedProductBySlug(slug)`.
- Conteudo vem de produto publicado.
- Texto da pagina pode vir de `product.public_page_content`.
- Quando nao ha conteudo customizado, usa `buildCoursePublicPageView`.

### 11.1 Layout geral

Fundo:

- Branco.

Container:

- Botao/link "Voltar aos cursos".
- Grid desktop:
  - coluna principal flexivel;
  - aside sticky com card de compra de 370px.

### 11.2 Conteudo principal

Hero textual:

- Badge/eyebrow: `page.eyebrow`
- Badge "Destaque", se aplicavel
- H1: `page.headline`
- Intro: `page.intro`

Secao "Sobre o curso":

- Titulo: `page.aboutTitle`
- Paragrafos: `page.aboutParagraphs`

Secao "O que vais aprender":

- Titulo: `page.learnTitle`
- Grid de cards com icone `BookOpenCheck`
- Itens: `page.learnItems`

Secao "Conteudo do curso":

- Titulo: `page.curriculumTitle`
- Lista em cards/dividers.
- Cada item tem:
  - label, exemplo "Modulo 1"
  - titulo
  - quantidade/descricao de aulas
  - descricao
  - icone `ChevronDown` apenas visual, nao expande hoje.

Reviews:

- Componente `CourseReviews`.
- Mostra reviews aprovadas, estatisticas e formulario quando usuario pode avaliar.

### 11.3 Card lateral de compra

Posicionamento:

- `lg:sticky lg:top-24`

Estrutura:

1. Capa do curso em `aspect-video`
2. Se nao houver capa, fallback com gradiente e icone `Sparkles`
3. Bloco do instrutor:
   - iniciais em circulo escuro
   - nome
   - papel
4. Preco:
   - label "Investimento"
   - preco formatado
   - nota de preco
5. CTA principal:
   - link para `/checkout?slug=...`
   - label dinamico:
     - "Comprar este material"
     - "Ativar acesso gratuito"
     - "Avancar para o checkout"
     - etc.
6. Lista de features com check verde
7. Box "O que esta incluido"
8. Carga horaria/tempo estimado ou "Acesso organizado na area do aluno"

Pontos para Stitch considerar:

- Card lateral e importante para conversao; deve continuar visivel no desktop.
- No mobile, o CTA precisa ficar muito claro, talvez sticky inferior.
- A capa do curso e um ativo central. Nao ha icone de play sobre capa atualmente.
- Pode melhorar a hierarquia entre valor, CTA e beneficios.

## 12. Conteudo dinamico da pagina do curso

Arquivo: `src/lib/course-public-page.ts`

Campos usados:

- `eyebrow`
- `headline`
- `intro`
- `aboutTitle`
- `aboutParagraphs`
- `learnTitle`
- `learnItems`
- `curriculumTitle`
- `curriculumItems`
- `instructorName`
- `instructorRole`
- `instructorInitials`
- `priceNote`
- `ctaLabel`
- `sidebarFeatures`
- `previewTitle`
- `previewText`

Fallbacks sao gerados por narrativa do produto.

Perfis narrativos inferidos:

- Pack completo
- Sebenta de Filosofia
- Sebenta de Portugues
- Material de apoio
- Kit de organizacao
- Apoio personalizado
- Material gratuito
- Curso digital generico

Importante:

- O redesign deve assumir que diferentes cursos podem ter conteudos dinamicos.
- Evitar layouts que dependam de textos com tamanho fixo.
- Cards e secoes precisam lidar com descricoes curtas e longas.

## 13. Checkout publico atual

Arquivo: `src/pages/public/Checkout.tsx`

Rota: `/checkout?slug=...`

Objetivo:

- Confirmar curso/produto antes do pagamento ou ativacao gratuita.
- Se usuario nao estiver logado, pedir login.
- Se curso e gratuito, confirmar acesso.
- Se pago, criar sessao Stripe e redirecionar.

Layout:

- Container com `PageHeader`.
- Grid desktop:
  - coluna esquerda: resumo e explicacao;
  - coluna direita: card de pagamento.

### 13.1 Header

Titulo:

- "Checkout"

Descricao:

- "Confirma o curso, valida os dados principais e segue para concluir a compra."

Voltar:

- Link para pagina do curso.

### 13.2 Resumo do curso

Card grande:

- Fundo azul-marinho em gradiente.
- Eyebrow: "Resumo do curso"
- Titulo: nome do produto
- Descricao: short description ou description
- Mini-cards:
  - Fluxo claro
  - Dados organizados
  - Conta protegida

Card "O que acontece depois":

- Lista:
  - concluis a compra sem sair do fluxo;
  - acesso fica associado a conta;
  - se gratuito, ativacao e rapida.

### 13.3 Card de pagamento

Conteudo:

- Label "Pagamento"
- Preco
- Texto muda se produto e gratuito ou pago.
- Aviso se usuario precisa entrar.
- Mensagem de erro se checkout falhar.
- CTA:
  - "Confirmar acesso" para gratuito
  - "Continuar para pagamento" para pago
  - "Entrar para continuar" se deslogado
- Botao secundario: "Voltar ao curso"

Regras importantes:

- Login deve preservar a URL do checkout via `redirect`.
- Produto gratuito usa `claimFreeProduct`.
- Produto pago usa `createCheckoutSession`.
- Stripe abre via `window.location.assign(result.checkout_url)`.

Pontos para Stitch considerar:

- Checkout deve ser limpo, confiavel e sem excesso visual.
- Precisa dar seguranca antes de sair para Stripe.
- Em mobile, CTA precisa estar acima da dobra ou facilmente acessivel.

## 14. Suporte publico atual

Arquivo: `src/pages/public/Support.tsx`

Rota: `/suporte`

Objetivo:

- Oferecer FAQ publico.
- Explicar SLA.
- Direcionar usuario autenticado a abrir chamado.

### 14.1 Hero

Visual:

- Fundo branco.
- Icone `LifeBuoy` em circulo azul claro.
- H1 central: "Como podemos ajudar?"
- Texto: "Encontre respostas rapidas ou abra um chamado..."
- Campo de busca central em pill.

### 14.2 SLA

Grid:

- Coluna principal: SLA por categoria.
- Sidebar/card vermelho: casos urgentes.

Categorias:

- Pagamentos
- Tecnico
- Conta
- Geral

Cada categoria mostra:

- label
- descricao
- prazo de primeira resposta em horas uteis

Card urgente:

- Fala sobre fraude, pagamento duplicado, bloqueio de acesso ou risco imediato.
- CTA "Abrir chamado" para `/aluno/chamados?openTicketModal=1&ticketStep=form`.

### 14.3 FAQ

Desktop:

- Sidebar sticky de categorias.
- Lista de perguntas em `<details>`.

Mobile:

- Select de categorias.

Perguntas atuais:

- Paguei e ainda nao tenho acesso ao curso. O que faco?
- O material nao abre no dashboard.
- Esqueci a senha.
- Como acompanho meus chamados?

### 14.4 CTA final

Card escuro:

- "Ainda precisa de ajuda?"
- Texto sobre chamado autenticado.
- CTAs:
  - "Abrir um chamado"
  - "Entrar na conta"

Pontos para Stitch considerar:

- Suporte pode ficar mais humano e menos operacional, mas precisa manter SLA e FAQ claros.
- CTA de chamado deve continuar indo para `/aluno/chamados?openTicketModal=1&ticketStep=form`.

## 15. Login e criar conta no contexto publico

Embora nao estejam em `src/pages/public`, fazem parte da jornada publica.

Rotas:

- `/login`
- `/register`
- `/criar-conta`

Regras relevantes:

- Header e footer devem aparecer nessas paginas.
- Checkout envia usuario deslogado ao login com redirect para retornar ao checkout.
- Redesign publico deve considerar coerencia visual tambem para login/criar conta.

## 16. Responsividade atual

Padroes:

- Mobile-first com Tailwind.
- Grids mudam em `md`, `lg`, `xl`.
- Navbar desktop aparece em `lg`; acoes desktop em `md`.
- Menu mobile aparece em `md:hidden`.
- Cards de catalogo:
  - 1 coluna mobile;
  - 2 colunas em `md`;
  - 3 colunas em `xl`.
- Pagina de curso:
  - layout linear no mobile;
  - aside sticky no desktop.
- Checkout:
  - layout linear no mobile;
  - duas colunas em `xl`.

Pontos para Stitch considerar:

- Priorizar experiencia mobile.
- CTA de compra deve ser evidente em mobile.
- Evitar cards muito longos no mobile.
- Header mobile deve manter entrada, cursos e area do aluno claros.

## 17. Estados que o redesign precisa prever

Home:

- Produtos em destaque carregando.
- Erro ao carregar cursos.
- Nenhum produto em destaque.

Catalogo:

- Loading.
- Erro.
- Busca sem resultados.
- Produtos com e sem capa.
- Produtos pagos, gratuitos e servicos.

Pagina do curso:

- Loading.
- Erro.
- Curso nao encontrado.
- Curso com capa.
- Curso sem capa.
- Curso gratuito.
- Curso pago.
- Curso destaque.
- Curso com reviews.
- Curso sem reviews.
- Textos curtos e longos.

Checkout:

- Sem slug.
- Loading.
- Erro ao preparar.
- Produto nao encontrado.
- Usuario deslogado.
- Usuario logado.
- Produto gratuito.
- Produto pago.
- Erro ao iniciar pagamento.
- Estado "A processar..."

Suporte:

- Busca sem resultado.
- Categorias filtradas.
- Usuario deslogado abrindo chamado deve passar por login.

## 18. CTAs e links que devem ser preservados

CTAs de descoberta:

- "Explorar cursos" -> `/cursos`
- "Ver cursos" -> `/cursos`
- "Ver catalogo completo" -> `/cursos`
- "Criar conta" -> `/register`
- "Entrar" -> `/login`

CTAs de produto:

- "Ver detalhes" -> `/cursos/:slug`
- "Comprar este material" -> `/checkout?slug=:slug`
- "Ativar acesso gratuito" -> `/checkout?slug=:slug`
- "Avancar para o checkout" -> `/checkout?slug=:slug`

CTAs de suporte:

- "Abrir chamado" -> `/aluno/chamados?openTicketModal=1&ticketStep=form`
- "Entrar na conta" -> `/login`

Conta:

- "Area do Aluno" -> `/aluno/dashboard`
- "Admin" -> `/admin`, apenas quando aplicavel.

## 19. Linguagem e tom de voz

Tom atual:

- Portugues europeu com algumas variacoes sem acentos no codigo.
- Educacional e acolhedor.
- Direto, sem promessas exageradas.
- Foco em clareza, estudo, exames nacionais, materiais digitais e acesso organizado.

Frases/ideias recorrentes:

- clareza para estudar;
- compra simples;
- acesso organizado;
- area do aluno;
- menos dispersao;
- retomar o estudo;
- materiais para exames nacionais;
- sebentas, packs, gratuitos e apoio.

Direcao recomendada:

- Manter simplicidade e confianca.
- Tornar a copy menos generica onde possivel.
- Aproximar a voz da Mariana: professora/explicadora clara, humana e objetiva.
- Evitar tom agressivo de venda.
- Evitar jargoes tecnicos como "grants", "backend", "Stripe" na area publica.

## 20. O que nao deve ser quebrado

Nao remover:

- Header publico.
- Footer publico.
- Link para catalogo.
- Link para suporte.
- Link para login.
- Link para area do aluno quando logado.
- CTA de checkout em cada curso.
- Busca e filtros do catalogo, salvo substituicao equivalente.
- Estados de loading, erro e vazio.
- Fluxo de login com redirect no checkout.
- Rodape com build discreto.

Nao transformar em landing page estatica:

- Catalogo e pagina de curso dependem de dados do banco.
- Cards e conteudo de curso sao dinamicos.
- O design precisa funcionar com qualquer curso publicado.

## 21. Oportunidades de repaginacao

Home:

- Usar uma primeira dobra mais marcante, com foto, mockup real ou composicao de capas.
- Reduzir aspecto "SaaS generico".
- Mostrar cursos/capas reais mais cedo.
- Criar uma narrativa visual de "estudo mais claro para exames nacionais".

Catalogo:

- Melhorar escaneabilidade dos cards.
- Dar mais destaque para preco, disciplina e tipo.
- Criar filtros visualmente mais elegantes.
- Reduzir repeticao de blocos internos nos cards.

Pagina do curso:

- Fortalecer CTA de compra no mobile.
- Dar mais peso para capa do curso e beneficios.
- Melhorar visual do curriculo, talvez com accordion real ou timeline.
- Destacar reviews/prova social de forma mais persuasiva.
- Tornar o card sticky mais premium e menos administrativo.

Checkout:

- Aumentar sensacao de seguranca e simplicidade.
- Melhorar hierarquia do resumo.
- Tornar estados de login/pagamento mais claros.

Suporte:

- Deixar FAQ mais leve.
- Melhorar visual dos SLAs.
- Trazer o CTA de chamado de forma mais clara e menos alarmista.

## 22. Resumo para Stitch

Criar uma nova proposta visual para as paginas publicas da Mariana Explica:

- Home comercial educacional;
- Catalogo de cursos;
- Pagina de curso individual;
- Checkout interno;
- Suporte/FAQ;
- Header e footer publicos;
- Coerencia com login/criar conta.

A marca deve parecer:

- clara;
- educacional;
- moderna;
- confiavel;
- proxima;
- preparada para vender materiais digitais sem parecer agressiva.

Preservar a estrutura funcional, rotas, CTAs e estados dinamicos. O redesign pode propor novos layouts e uma identidade visual mais forte, desde que respeite a jornada: descobrir curso -> entender oferta -> comprar/ativar -> acessar area do aluno.

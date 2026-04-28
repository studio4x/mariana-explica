# UI/UX — Mariana Explica

## 1. Contexto

Este documento define a direção visual, estrutural e comportamental da interface da plataforma Mariana Explica.

A proposta visual da plataforma deve combinar:

- a lógica comercial e estrutural da referência AcademiaX
- a identidade visual própria da Mariana Explica
- a robustez visual e consistência operacional do padrão HomeCare Match

A interface precisa funcionar bem em três contextos principais:

- área pública/comercial
- área autenticada do aluno
- painel administrativo

Cada área terá linguagem visual e densidade de informação diferentes, mas todas devem compartilhar o mesmo design system base.

---

## 2. Objetivo

Garantir uma interface:

- clara
- confiável
- profissional
- comercial
- responsiva
- orientada à conversão e uso real

A UI não deve parecer improvisada, genérica ou excessivamente técnica.

A UX deve ajudar o usuário a:

- entender rapidamente o que pode fazer
- encontrar os produtos
- comprar com pouca fricção
- acessar o conteúdo com facilidade
- manter contexto dentro da plataforma

---

## 3. Direção visual geral

A plataforma deve seguir uma linguagem:

- educacional
- clean
- moderna
- acolhedora
- objetiva
- comercial sem excesso de ruído

A aparência deve transmitir:

- confiança
- clareza
- organização
- segurança
- proximidade com o aluno

---

## 4. Referência estrutural principal

A referência estrutural do frontend público é a AcademiaX, principalmente em:

- homepage comercial
- blocos objetivos de produto
- fluxo claro para compra
- foco em materiais educacionais
- linguagem jovem, direta e escaneável

A estrutura da AcademiaX deve servir como referência de organização, ritmo de seções e hierarquia de informação.

A identidade visual final, porém, deve ser própria da Mariana Explica e não uma cópia literal da referência.

---

## 5. Identidade visual da Mariana Explica

Com base no documento de identidade visual, a plataforma deve considerar:

- cor principal: `#242742`
- cor de fundo base: `#dff2f8`
- tipografia de marca: `Arvo`

Sugestão de aplicação:

- `Arvo` para títulos principais, destaques e headings
- fonte complementar de interface para corpo, labels, inputs e tabelas:
  - `Inter`

Essa combinação equilibra:

- personalidade da marca
- legibilidade da interface
- escalabilidade do design system

---

## 6. Princípios de UX

A experiência deve seguir os seguintes princípios:

### 6.1 Clareza imediata
O usuário precisa entender rapidamente:
- onde está
- o que está vendo
- o que pode fazer
- qual é o próximo passo

### 6.2 Baixa fricção
A jornada até a compra e até o acesso ao conteúdo deve exigir o mínimo de esforço.

### 6.3 Hierarquia forte
Toda tela deve ter:
- título claro
- subtítulo curto quando necessário
- ação principal evidente
- conteúdo secundário organizado abaixo

### 6.4 Orientação à tarefa
A área do aluno deve ser focada em:
- acessar material
- continuar estudando
- baixar quando permitido
- acompanhar suporte/notificações

### 6.5 Estados explícitos
Toda interface deve prever:
- loading
- vazio
- erro
- sucesso
- bloqueio

---

## 7. Estrutura da área pública

A área pública é comercial e institucional.

Deve ser mais leve, mais espaçada e mais persuasiva que o dashboard e o admin.

### 7.1 Home

Estrutura recomendada:

1. navbar estável
2. hero principal
3. bloco de produtos em destaque
4. bloco de benefícios
5. bloco "como funciona"
6. bloco de prova/credibilidade
7. CTA final
8. footer

### 7.2 Página de catálogo/produtos

Deve exibir:
- cards de produtos
- filtros leves se necessário
- destaque para preço
- destaque para tipo do produto
- CTA primário por item

### 7.3 Página de produto

Deve ter foco em conversão.

Estrutura recomendada:
- título
- descrição curta
- preço
- lista do que o aluno recebe
- formato do conteúdo
- botão de compra
- FAQ curto opcional

### 7.4 Checkout

O checkout deve ser visualmente limpo, com:

- poucos campos por etapa
- resumo do pedido
- cupom
- CTA primário destacado
- confiança visual e redução de distração

---

## 8. Estrutura do dashboard do aluno

O dashboard deve ser mais funcional que comercial.

Ele precisa ser:

- claro
- amigável
- orientado a progresso e acesso
- menos denso que o admin

### 8.1 Estrutura base

- navbar global ou header simples
- sidebar em desktop
- navegação simplificada em mobile
- conteúdo central com largura confortável
- cards como unidade principal de composição

### 8.2 Páginas esperadas

- início
- meus produtos
- produto/aulas
- downloads
- notificações
- suporte
- perfil

### 8.3 Linguagem visual

- superfícies claras
- bordas leves
- cards bem espaçados
- badges de status
- banners de orientação
- CTAs azuis
- feedbacks claros

---

## 9. Estrutura do admin

O admin deve ter linguagem mais operacional.

Características:
- mais denso
- mais tabelas
- menos marketing
- mais filtros e ações rápidas
- mais leitura analítica

### 9.1 Estrutura base

- sidebar fixa ou sticky
- conteúdo principal fluido
- cards-resumo no topo quando necessário
- blocos de filtro acima das listagens
- tabelas como estrutura dominante

### 9.2 Módulos administrativos

- produtos
- usuários
- pedidos
- afiliados
- cupons
- notificações
- suporte
- configurações

---

## 10. Design system base

A plataforma deve usar um design system centralizado em tokens.

### 10.1 Tokens principais

- `background`
- `foreground`
- `card`
- `primary`
- `secondary`
- `accent`
- `success`
- `warning`
- `destructive`
- `border`
- `muted`
- `radius`
- `shadow`

### 10.2 Direção das cores

- `primary`: azul escuro derivado da identidade
- `background`: base clara, com apoio do azul claro suave
- `card`: branco ou quase branco
- `success`: verde controlado
- `warning`: âmbar
- `destructive`: vermelho apenas em ações críticas

### 10.3 Direção tipográfica

- títulos: Arvo
- textos, formulários e navegação: Inter

### 10.4 Radius e sombras

- radius médio
- sombras discretas
- separação visual por borda + contraste leve
- evitar visual pesado ou com glow exagerado

---

## 11. Componentes visuais prioritários

A plataforma deve ser construída com base em:

- cards
- botões
- inputs
- selects
- badges
- alerts
- dialogs
- drawers
- accordions
- tabelas responsivas
- listagens
- toasts
- empty states
- skeletons de loading

---

## 12. Padrão de cards

Cards serão a unidade principal da UI.

### Regras
- borda leve
- fundo branco
- sombra discreta
- espaçamento interno confortável
- título claro
- subtítulo curto quando necessário

### Usos
- produto
- resumo
- alerta
- ação rápida
- status
- bloco de conteúdo

---

## 13. Padrão de botões

### Primário
- ação principal da tela
- cor forte
- alto contraste

### Outline
- ação secundária
- sem competir com o principal

### Ghost
- ações leves
- navegação contextual
- ações em listas

### Destructive
- remoção, revogação, bloqueio

Regras:
- evitar múltiplos botões primários competindo
- ação crítica sempre com confirmação

---

## 14. Padrão de formulários

Formulários devem ser:

- bem espaçados
- com labels claros
- organizados por blocos quando crescerem
- com erro visível e objetivo
- com loading de submit
- com prevenção de múltiplos envios

Campos devem ter:
- label
- ajuda contextual opcional
- mensagem de erro
- estado disabled/loading quando necessário

---

## 15. Padrão de tabelas e listas

### No dashboard
- uso moderado
- leitura simples
- foco em operações pontuais

### No admin
- uso forte
- filtros
- busca
- paginação
- badges de status
- ações rápidas por linha

Regras:
- sempre prever empty state
- manter scroll horizontal em mobile se necessário
- evitar densidade extrema sem agrupamento

---

## 16. Padrão de feedback e estados

Toda tela deve prever:

### Loading
- skeletons ou loaders discretos

### Vazio
- mensagem clara
- CTA orientando próximo passo

### Erro
- mensagem objetiva
- possibilidade de retry quando aplicável

### Sucesso
- toast
- mensagem inline
- redirecionamento coerente quando necessário

### Bloqueio
- alert específico
- explicação clara
- ação sugerida

---

## 17. Padrão de navegação

### Navegação pública
- curta
- objetiva
- foco comercial

### Navegação do dashboard
- centrada em tarefas do aluno
- menu lateral no desktop
- acesso rápido no mobile

### Navegação admin
- sidebar densa
- agrupamento por módulos
- item ativo sempre claro

---

## 18. Mobile-first

Toda tela deve funcionar muito bem no celular.

### Regras
- empilhar blocos
- evitar excesso de colunas
- manter botões fáceis de tocar
- preservar leitura
- usar drawers e accordions quando necessário
- tabelas com scroll horizontal controlado

### Áreas críticas para mobile
- homepage
- catálogo
- checkout
- área do aluno
- visualização de material

---

## 19. Comportamento visual por área

### Área pública
- mais comercial
- mais leve
- mais narrativa
- maior respiro entre blocos

### Dashboard
- mais utilitário
- mais orientado a status e ação
- densidade média

### Admin
- mais operacional
- mais concentrado
- tabelas, filtros e gestão

---

## 20. Direção visual específica da Mariana Explica

A plataforma deve parecer:

- educativa
- organizada
- atual
- acessível
- confiável

Não deve parecer:
- marketplace genérico
- SaaS corporativo frio demais
- site infantilizado
- landing page exageradamente agressiva

A identidade visual deve preservar:
- sofisticação leve
- clareza
- foco em conteúdo
- proximidade com estudantes

---

## 21. Critérios de aceite

A UI/UX será considerada adequada quando:

- a home tiver apelo comercial claro
- o catálogo for fácil de escanear
- a página de produto converta com clareza
- o checkout tiver baixa fricção
- o dashboard for simples de usar
- o admin for operacional e organizado
- a experiência mobile for realmente boa
- a identidade visual for consistente com a marca

---

## 22. Riscos e observações

### Riscos
- copiar demais a referência e perder identidade própria
- excesso de informação nas páginas públicas
- dashboard complexo demais para o aluno
- admin visualmente confuso
- inconsistência entre área pública, dashboard e admin

### Observações
- a AcademiaX deve ser usada como referência estrutural, não como cópia visual
- a identidade da Mariana precisa prevalecer
- o design system deve nascer desde o início para evitar retrabalho
- componentes precisam servir tanto para evolução visual quanto para escala do produto
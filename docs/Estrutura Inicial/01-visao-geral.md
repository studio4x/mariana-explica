# Visão Geral da Plataforma — Mariana Explica

## 1. Contexto

A plataforma "Mariana Explica" é um ambiente digital proprietário voltado para a comercialização e entrega de conteúdos educacionais focados na preparação para exames nacionais (10º ao 12º ano).

O projeto nasce com o objetivo de substituir soluções genéricas de LMS (como LearnDash) por uma estrutura própria, mais flexível, escalável e orientada à conversão, retenção e controle total do negócio.

A plataforma unifica:

- presença institucional (site)
- venda de produtos digitais
- entrega de conteúdo educacional
- relacionamento com alunos
- automação de comunicação

Tudo dentro de um único sistema.

---

## 2. Objetivo

Criar uma plataforma completa que permita:

- vender produtos digitais (PDFs e vídeos)
- entregar conteúdo de forma organizada e segura
- criar uma experiência de estudo simples e eficiente
- reter alunos com comunicação e recorrência
- escalar vendas através de afiliados e campanhas
- operar o negócio de forma centralizada via painel administrativo

---

## 3. Escopo

### 3.1 Área pública (site)

- Homepage com foco em conversão
- Páginas de produto
- Página de checkout
- Páginas institucionais (se necessário)
- Captura de leads (produtos gratuitos)

---

### 3.2 Área do aluno (dashboard)

- Acesso aos produtos adquiridos
- Visualização de conteúdos (PDF e vídeo)
- Downloads controlados
- Organização por módulos
- Notificações
- Suporte (tickets ou contato)

---

### 3.3 Sistema de produtos

- Produtos pagos
- Produtos gratuitos (lead magnet)
- Produtos híbridos (parte gratuita + parte paga)
- Liberação de conteúdo por produto

---

### 3.4 Sistema de vendas

- Checkout integrado
- Criação automática de conta
- Associação da compra ao usuário
- Liberação imediata de acesso

---

### 3.5 Sistema de afiliados

- Código único por usuário
- Rastreamento de vendas
- Cálculo de comissão
- Gestão via painel admin

---

### 3.6 Sistema de cupons

- Desconto percentual ou fixo
- Validade configurável
- Limite de uso

---

### 3.7 Comunicação e notificações

- E-mails transacionais (compra, acesso)
- Notificações internas
- Disparos em massa
- Comunicação direta com alunos

---

### 3.8 Painel administrativo

- Gestão de produtos
- Gestão de usuários
- Gestão de pedidos
- Gestão de afiliados
- Gestão de cupons
- Monitoramento da plataforma

---

### 3.9 PWA (Aplicativo Web)

- Instalação no celular
- Experiência similar a app
- Acesso rápido à área do aluno

---

## 4. Fora de escopo (fase atual)

- Aplicativo nativo (App Store / Play Store)
- Gestão de campanhas de tráfego pago
- Criação automatizada de conteúdo educacional
- Gamificação avançada
- IA integrada (fase futura)

---

## 5. Público-alvo

### Primário

- Estudantes do ensino secundário (10º ao 12º ano)
- Foco em preparação para exames nacionais

### Secundário

- Alunos buscando reforço escolar
- Usuários interessados em materiais complementares de estudo

---

## 6. Proposta de valor

A plataforma se posiciona como uma solução prática, direta e acessível para estudantes que precisam:

- estudar com eficiência
- acessar conteúdo organizado
- ter clareza sobre o que estudar
- melhorar desempenho em exames

Diferenciais principais:

- acesso imediato após compra
- conteúdo direto ao ponto
- combinação de PDF + vídeo
- experiência simples e sem fricção
- ambiente centralizado (sem depender de múltiplas ferramentas)

---

## 7. Principais módulos do sistema

- Site institucional e comercial
- Catálogo de produtos
- Checkout
- Área do aluno (LMS simplificado)
- Sistema de afiliados
- Sistema de cupons
- Sistema de notificações
- Painel administrativo

---

## 8. Diferenciais técnicos

- Plataforma proprietária (não dependente de WordPress ou plugins)
- Arquitetura moderna (SPA + backend serverless)
- Segurança com múltiplas camadas (Auth + RLS + backend)
- Escalabilidade nativa (Supabase + Vercel)
- PWA para experiência mobile

---

## 9. Direção de produto

A plataforma não deve se comportar como um LMS tradicional complexo.

Ela deve ser:

- simples para o aluno
- rápida para consumir conteúdo
- orientada à conversão
- focada em execução (estudar, comprar, acessar)

---

## 10. Princípios do projeto

- clareza > complexidade
- velocidade de uso > excesso de funcionalidades
- controle de negócio > dependência de terceiros
- segurança desde o início
- arquitetura preparada para escalar

---

## 11. Métricas de sucesso

- taxa de conversão (visitante → comprador)
- taxa de ativação (compra → acesso)
- retenção de alunos
- volume de vendas
- uso da área do aluno
- crescimento via afiliados

---

## 12. Premissas técnicas

- frontend em React + Vite
- backend em Supabase
- banco PostgreSQL com migrations
- Edge Functions para lógica sensível
- deploy via Vercel
- PWA ativo

---

## 13. Riscos iniciais

- pirataria de conteúdo (PDFs)
- compartilhamento de contas
- falhas em integração de pagamento
- baixa retenção sem automações
- complexidade excessiva no admin

---

## 14. Direcionamento estratégico

A plataforma deve evoluir em ciclos:

1. MVP funcional (venda + entrega)
2. otimização de conversão
3. expansão via afiliados
4. automações e retenção
5. escala e otimização operacional
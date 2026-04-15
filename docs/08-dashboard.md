# Dashboard do Aluno — Mariana Explica

## 1. Contexto

Este documento define a estrutura, comportamento e organização da área autenticada do aluno (dashboard).

O dashboard é o ambiente onde o usuário:

- acessa produtos comprados ou gratuitos
- consome conteúdo (PDF e vídeo)
- interage com suporte
- recebe notificações
- gerencia sua conta

Essa área deve ser simples, funcional e orientada ao uso real, não à venda.

---

## 2. Objetivo

Garantir que o aluno consiga:

- acessar rapidamente seus materiais
- entender o que comprou
- consumir conteúdo sem fricção
- retomar estudos facilmente
- encontrar suporte quando necessário

---

## 3. Princípios do dashboard

- simplicidade acima de tudo
- foco em ação (acessar, estudar, baixar)
- navegação clara
- baixa carga cognitiva
- feedback visual constante
- consistência entre páginas

---

## 4. Estrutura geral

O dashboard será composto por:

- header superior
- sidebar (desktop)
- navegação simplificada (mobile)
- área de conteúdo central

---

## 5. Layout base

### 5.1 Header

Contém:

- logo (link para dashboard)
- nome do usuário
- menu de perfil
- acesso a notificações

---

### 5.2 Sidebar (desktop)

Itens:

- Início
- Meus Produtos
- Downloads
- Notificações
- Suporte
- Perfil

---

### 5.3 Navegação mobile

- menu colapsável (drawer)
- acesso rápido às principais áreas
- botões maiores e tocáveis

---

## 6. Páginas do dashboard

## 6.1 Página: Início (/dashboard)

### Objetivo
Visão geral do usuário.

### Conteúdo

- saudação personalizada
- lista de produtos recentes
- progresso (se aplicável)
- atalhos rápidos
- notificações recentes

### Componentes

- cards de produto
- banner de orientação
- bloco de notificações

---

## 6.2 Página: Meus Produtos (/dashboard/produtos)

### Objetivo
Listar todos os produtos do usuário.

### Conteúdo

- lista de produtos adquiridos
- lista de produtos gratuitos ativados

### Comportamento

- ordenação por recente
- filtro opcional

### Componentes

- cards de produto
- badges de status (novo, atualizado)

---

## 6.3 Página: Produto (/dashboard/produto/:id)

### Objetivo
Exibir conteúdo de um produto específico.

### Estrutura

- título do produto
- descrição curta
- lista de módulos
- conteúdo do módulo selecionado

---

### 6.3.1 Lista de módulos

- nome do módulo
- tipo (PDF, vídeo, etc)
- status (bloqueado/liberado)
- indicador de preview

---

### 6.3.2 Área de conteúdo

Dependendo do tipo:

#### PDF
- visualização inline (quando permitido)
- botão de download (se permitido)

#### Vídeo
- player embutido
- controle básico

#### Link externo
- botão de acesso

---

### Regras importantes

- conteúdo bloqueado deve ser visível, mas não acessível
- exibir mensagem clara quando bloqueado
- exibir CTA para compra quando aplicável

---

## 6.4 Página: Downloads (/dashboard/downloads)

### Objetivo
Centralizar arquivos disponíveis para download.

### Conteúdo

- lista de arquivos disponíveis
- nome
- produto relacionado
- botão de download

### Regras

- só exibir arquivos com download permitido
- evitar duplicação de arquivos

---

## 6.5 Página: Notificações (/dashboard/notificacoes)

### Objetivo
Exibir comunicação com o usuário.

### Conteúdo

- lista de notificações
- status (lida/não lida)
- tipo (transacional, informativa, marketing)

### Interações

- marcar como lida
- abrir detalhes

---

## 6.6 Página: Suporte (/dashboard/suporte)

### Objetivo
Permitir comunicação com suporte.

### Conteúdo

- lista de tickets
- botão “novo ticket”

---

### 6.6.1 Novo ticket

Campos:

- assunto
- mensagem

---

### 6.6.2 Visualização de ticket

- histórico de mensagens
- input para resposta
- status do ticket

---

## 6.7 Página: Perfil (/dashboard/perfil)

### Objetivo
Gerenciar dados do usuário.

### Conteúdo

- nome
- email
- senha
- preferências
- notificações

---

## 7. Componentes principais

- ProductCard
- ModuleList
- ModuleItem
- ContentViewer
- NotificationItem
- TicketList
- TicketMessage
- DownloadItem

---

## 8. Estados de interface

Cada página deve tratar:

### Loading
- skeleton ou spinner

### Vazio
- mensagem clara
- CTA sugerido

### Erro
- mensagem objetiva
- opção de retry

### Sucesso
- feedback visual (toast)

### Bloqueado
- explicação + ação sugerida

---

## 9. Regras de acesso

- todas as rotas exigem autenticação
- acesso ao produto depende de `access_grants`
- conteúdo só deve ser exibido se autorizado

---

## 10. Integração com backend

### Leitura

- React Query → Supabase

### Ações

- Edge Functions:
  - download
  - suporte
  - ativação de produto gratuito

---

## 11. Experiência mobile

- layout em coluna única
- módulos em accordion
- navegação simplificada
- botões grandes
- conteúdo legível

---

## 12. Performance

- lazy loading de páginas
- cache de produtos
- evitar re-fetch desnecessário
- dividir conteúdo por módulo

---

## 13. Segurança

- não confiar no frontend para liberar conteúdo
- validação sempre no backend
- URLs de arquivos temporárias

---

## 14. Critérios de aceite

- usuário acessa produtos corretamente
- conteúdo bloqueado respeitado
- downloads seguros
- suporte funcional
- notificações exibidas corretamente
- experiência mobile fluida

---

## 15. Riscos

- excesso de complexidade
- dificuldade de navegação
- conteúdo difícil de encontrar
- falha na distinção entre conteúdo liberado e bloqueado

---

## 16. Observações finais

- dashboard não é página de vendas
- foco é consumo e retenção
- simplicidade é prioridade
- experiência deve ser rápida e previsível
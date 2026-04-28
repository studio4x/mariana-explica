# Painel Administrativo — Mariana Explica

## 1. Contexto

Este documento define a estrutura e funcionamento do painel administrativo da plataforma Mariana Explica.

O admin é o centro de controle do sistema, responsável por:

- gestão de produtos
- gestão de usuários
- controle de pedidos
- gestão de afiliados
- controle de cupons
- comunicação com usuários
- suporte operacional

É uma área crítica e deve ser:

- segura
- eficiente
- organizada
- orientada à operação

---

## 2. Objetivo

Permitir que administradores:

- operem a plataforma sem depender de código
- tenham visibilidade completa do sistema
- consigam tomar decisões rapidamente
- consigam corrigir problemas operacionais
- gerenciem usuários e permissões

---

## 3. Princípios do admin

- foco operacional (não comercial)
- densidade de informação controlada
- ações rápidas e claras
- feedback imediato
- segurança em primeiro lugar
- rastreabilidade (auditoria)

---

## 4. Estrutura geral

O admin será composto por:

- sidebar fixa (desktop)
- header com ações globais
- conteúdo principal com tabelas e formulários
- filtros e busca em todas as listagens

---

## 5. Navegação principal

/admin

Seções:

- Dashboard
- Produtos
- Usuários
- Pedidos
- Afiliados
- Cupons
- Notificações
- Suporte
- Configurações

---

## 6. Página: Dashboard Admin (/admin)

### Objetivo
Visão geral do sistema.

### Conteúdo

- total de usuários
- total de vendas
- receita
- pedidos recentes
- alertas operacionais

---

## 7. Gestão de Usuários (/admin/usuarios)

### ⚠️ CRÍTICO — módulo mais sensível

### Objetivo
Permitir controle total sobre os usuários da plataforma.

---

### 7.1 Listagem de usuários

Tabela com:

- nome
- email
- role (tipo de usuário)
- status
- data de criação
- último login
- ações

---

### 7.2 Tipos de usuário (roles)

- `student`
- `affiliate`
- `admin`

---

### 7.3 Ações disponíveis

#### Criar usuário

- criar manualmente
- definir:
  - nome
  - email
  - senha inicial
  - role

---

#### Editar usuário

- alterar:
  - nome
  - email
  - role
  - status

---

#### Remover usuário

- remover conta (soft delete recomendado)
- exigir confirmação

---

#### Alterar role

- promover para admin
- rebaixar para usuário comum
- definir afiliado

---

#### Bloquear usuário

- impedir login
- impedir acesso ao conteúdo

---

#### Desbloquear usuário

---

### 7.4 Regras de segurança

- apenas admin pode acessar este módulo
- alterações de role devem ser registradas em audit_logs
- remoção de usuário deve ser reversível (soft delete)
- não permitir que admin remova a si próprio
- operações críticas devem exigir confirmação

---

### 7.5 Filtros

- por role
- por status
- por data
- busca por nome/email

---

## 8. Gestão de Produtos (/admin/produtos)

### Objetivo
Criar e gerenciar produtos.

### Ações

- criar produto
- editar produto
- publicar
- arquivar

---

### Estrutura

- tabela de produtos
- formulário de criação/edição

---

## 9. Gestão de Pedidos (/admin/pedidos)

### Objetivo
Monitorar vendas.

### Conteúdo

- lista de pedidos
- status
- valor
- usuário
- produto

---

### Ações

- visualizar detalhes
- reprocessar pedido
- verificar pagamento

---

## 10. Gestão de Afiliados (/admin/afiliados)

### Objetivo
Gerenciar afiliados e comissões.

### Conteúdo

- lista de afiliados
- código
- comissão
- status

---

### Ações

- ativar/desativar afiliado
- alterar comissão
- visualizar conversões

---

## 11. Gestão de Cupons (/admin/cupons)

### Objetivo
Gerenciar descontos.

### Conteúdo

- código
- tipo
- valor
- validade
- uso

---

### Ações

- criar cupom
- editar
- ativar/desativar

---

## 12. Gestão de Notificações (/admin/notificacoes)

### Objetivo
Comunicar com usuários.

### Ações

- enviar notificação individual
- enviar em massa
- segmentar usuários

---

## 13. Gestão de Suporte (/admin/suporte)

### Objetivo
Responder tickets.

### Conteúdo

- lista de tickets
- status
- usuário

---

### Ações

- responder
- mudar status
- atribuir prioridade

---

## 14. Configurações (/admin/configuracoes)

### Objetivo
Configurar sistema.

### Conteúdo

- parâmetros globais
- toggles
- configurações públicas/privadas

---

## 15. Componentes principais

- DataTable
- FilterBar
- SearchInput
- StatusBadge
- ActionMenu
- ModalConfirm
- FormBuilder

---

## 16. Padrão de tabelas

- paginação
- filtros
- ordenação
- ações por linha
- badges de status

---

## 17. Segurança

- todas as rotas protegidas
- validação no backend obrigatória
- roles verificadas via backend
- nenhuma ação crítica no frontend

---

## 18. Auditoria

Registrar:

- criação de usuário
- alteração de role
- remoção de usuário
- alterações em produtos
- revogação de acesso

---

## 19. Estados de interface

- loading
- vazio
- erro
- sucesso
- confirmação obrigatória em ações críticas

---

## 20. Critérios de aceite

- admin consegue gerenciar usuários completamente
- roles funcionam corretamente
- ações são seguras
- dados são consistentes
- interface permite operação eficiente

---

## 21. Riscos

- permissões mal aplicadas
- exclusão irreversível de dados
- falta de auditoria
- ações críticas sem confirmação

---

## 22. Observações finais

- gestão de usuários é o ponto mais sensível do sistema
- roles devem ser controladas exclusivamente no backend
- admin deve ter poder total, mas com controle e auditoria
- sistema deve permitir operação sem necessidade de intervenção técnica
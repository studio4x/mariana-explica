# Autenticação e Segurança — Mariana Explica

## 1. Contexto

Este documento define a estratégia de autenticação, autorização e segurança da plataforma Mariana Explica.

A segurança da plataforma deve ser tratada em múltiplas camadas e nunca depender apenas do frontend.

Este documento cobre:

- autenticação de usuários
- autorização por role e status
- proteção de rotas
- RLS no banco
- segurança de arquivos
- segurança de Edge Functions
- segurança operacional do admin
- auditoria e rastreabilidade

---

## 2. Objetivo

Garantir que a plataforma:

- proteja dados dos usuários
- proteja conteúdos pagos e gratuitos restritos
- impeça acesso indevido a áreas privadas
- proteja operações administrativas
- mantenha rastreabilidade em ações críticas
- reduza o risco de fraude, vazamento e abuso

---

## 3. Princípios obrigatórios

### 3.1 Segurança em camadas

Toda regra sensível deve existir em três níveis:

1. frontend bloqueia ou oculta a ação
2. backend valida novamente
3. banco impõe a regra final com RLS, constraints e integridade

### 3.2 O frontend nunca é a fonte de verdade

O frontend pode melhorar UX, mas nunca pode ser a única barreira de segurança.

### 3.3 Toda operação crítica deve ser revalidada

Isso inclui:

- acesso a conteúdo
- download de arquivos
- pagamentos
- cupons
- afiliados
- ações admin
- suporte administrativo
- disparos em massa

### 3.4 Segredos nunca ficam no cliente

- chaves privadas
- service role
- webhooks secrets
- credenciais externas

Tudo deve permanecer no backend.

---

## 4. Autenticação

### 4.1 Solução principal

A autenticação da plataforma será feita com:

- Supabase Auth

### 4.2 Métodos previstos

Na fase inicial:

- login por e-mail e senha
- cadastro por e-mail e senha
- recuperação de senha
- atualização de senha

Opcional futuro:

- magic link
- login social

### 4.3 Sessão

A sessão será gerenciada no frontend, mas validada no backend quando necessário.

A autenticação deve prever:

- persistência de sessão
- renovação segura de token
- tratamento para token expirado
- redirecionamento coerente quando a sessão expirar

### 4.4 Bootstrap de profile

Todo usuário autenticado deve possuir um registro correspondente em `profiles`.

Esse bootstrap deve ocorrer automaticamente via trigger ou rotina controlada no backend.

---

## 5. Autorização

### 5.1 Modelo de autorização

A autorização será baseada em:

- `role`
- `is_admin`
- `status`
- contexto de acesso

### 5.2 Roles do sistema

- `student`
- `affiliate`
- `admin`

### 5.3 Status operacionais do usuário

- `active`
- `inactive`
- `blocked`
- `pending_review`

### 5.4 Regras por role

#### student
- acessa área do aluno
- acessa apenas os próprios dados
- acessa apenas produtos com grant ativo ou gratuitos elegíveis

#### affiliate
- possui capacidades de aluno
- pode ter acesso a painel ou área de afiliado futura
- não possui poderes administrativos por padrão

#### admin
- acessa painel administrativo
- gerencia usuários, produtos, pedidos, cupons, afiliados e notificações
- pode conceder ou revogar acessos
- pode verificar e alterar roles de outros usuários

### 5.5 Regras por status

#### active
- acesso normal, conforme role

#### inactive
- acesso pode ser restrito conforme decisão operacional
- recomendado: impedir ações sensíveis e exibir orientação

#### blocked
- login pode até existir tecnicamente, mas o acesso à plataforma privada deve ser bloqueado
- deve ser redirecionado para tela de acesso restrito ou suporte

#### pending_review
- acesso parcial ou bloqueado, conforme fluxo operacional
- conteúdo privado e ações críticas devem ser bloqueados

---

## 6. Proteção de rotas no frontend

### 6.1 Tipos de rota

- pública
- autenticada
- administrativa

### 6.2 Regras

#### pública
- pode ser acessada sem login

#### autenticada
- exige sessão válida
- exige usuário com status compatível

#### administrativa
- exige sessão válida
- exige role admin ou `is_admin = true`

### 6.3 Observação crítica

Proteção de rota no frontend é apenas uma camada de UX.

Toda proteção real precisa existir também no backend e banco.

---

## 7. Segurança no banco de dados

## 7.1 RLS obrigatório

Toda tabela com dado privado deve usar:

- `ENABLE ROW LEVEL SECURITY`

### Tabelas críticas com RLS obrigatório

- `profiles`
- `orders`
- `order_items`
- `access_grants`
- `notifications`
- `email_deliveries`
- `support_tickets`
- `support_ticket_messages`
- `affiliate_referrals`
- `audit_logs`
- `site_config` conforme natureza do dado

## 7.2 Regras gerais de policy

### Usuário comum
- lê apenas seus próprios dados
- escreve apenas dados permitidos do próprio contexto
- não acessa registros de outros usuários

### Admin
- leitura ampliada conforme necessidade operacional
- escrita em módulos administrativos
- não deve depender apenas do frontend para ser reconhecido como admin

## 7.3 Proteção por tabela

### profiles
- usuário lê o próprio profile
- admin lê todos
- usuário comum não altera role, is_admin ou status

### orders
- usuário lê apenas os próprios pedidos
- admin lê todos
- atualização crítica de status ocorre via backend

### access_grants
- usuário lê apenas os próprios grants
- usuário não cria grants manualmente
- criação e revogação via backend

### notifications
- usuário lê apenas as próprias notificações
- criação manual em massa via admin/backend

### support_tickets
- usuário acessa apenas os próprios tickets
- admin acessa todos

### audit_logs
- apenas admin
- idealmente sem escrita direta pelo frontend

---

## 8. Segurança de Edge Functions

### 8.1 Regra geral

Toda Edge Function sensível deve:

- validar método HTTP
- validar token quando necessário
- confirmar role/permissão
- validar input
- registrar logs
- retornar erros estruturados

### 8.2 Funções públicas controladas

Exemplos:
- `create-checkout`
- `apply-coupon-preview`

Mesmo públicas, devem validar payload rigorosamente.

### 8.3 Funções autenticadas

Exemplos:
- `generate-asset-access`
- `claim-free-product`
- `create-support-ticket`
- `reply-support-ticket`

Devem validar sessão e contexto do usuário.

### 8.4 Funções admin

Exemplos:
- `admin-create-product`
- `admin-update-product`
- `admin-publish-product`
- `admin-revoke-access`
- `admin-send-notification`
- funções de gestão de usuários

Devem validar:

- token válido
- role admin real no banco
- permissão antes de qualquer SQL privilegiado

### 8.5 Funções internas e cron

Exemplos:
- `cron-process-notifications`
- `cron-reconcile-orders`

Devem ser protegidas por segredo interno, autenticação técnica ou estratégia equivalente.

---

## 9. Segurança da gestão de usuários no admin

### 9.1 Ações sensíveis

O admin poderá:

- adicionar usuários
- editar usuários
- remover usuários
- bloquear usuários
- desbloquear usuários
- verificar role do usuário
- alterar role do usuário

### 9.2 Regras obrigatórias

- toda alteração de role deve ser auditada
- toda remoção deve preferir soft delete ou bloqueio lógico
- admin não pode remover a si próprio
- admin não pode retirar da própria conta a última permissão admin ativa sem verificação adicional
- mudanças de role e status devem ser feitas via backend, nunca diretamente pelo cliente

### 9.3 Campos protegidos

Os seguintes campos não podem ser alterados livremente pelo usuário comum:

- `role`
- `is_admin`
- `status`
- grants ativos
- flags administrativas

---

## 10. Proteção de conteúdo e arquivos

### 10.1 Regra principal

Arquivos nunca devem ser públicos por padrão.

### 10.2 Acesso a PDFs e materiais

O acesso deve ocorrer assim:

1. usuário solicita acesso ao asset
2. backend valida autenticação
3. backend valida grant ou regra pública
4. backend gera URL assinada temporária
5. usuário recebe acesso controlado

### 10.3 Regras de download

- arquivo pago só pode ser baixado por quem tem direito
- arquivo gratuito com visualização restrita não deve ter download liberado
- o frontend não decide isso sozinho
- a decisão final é do backend

### 10.4 Estrutura de storage

- paths sanitizados
- organização por domínio
- referência lógica guardada no banco
- remoção segura de versões substituídas, quando aplicável

### 10.5 Anti-padrões proibidos

- bucket público para materiais pagos
- link permanente aberto
- path real exposto como fonte de verdade
- autorização baseada apenas em parâmetro da URL

---

## 11. Segurança em pagamentos

### 11.1 Regra principal

A liberação de acesso nunca pode depender de retorno do frontend.

### 11.2 Liberação correta

- checkout criado no backend
- pagamento confirmado via webhook ou reconciliação backend
- grant criado somente após confirmação válida

### 11.3 Webhooks

Devem prever:

- validação de assinatura
- idempotência
- log de falha
- log de sucesso
- prevenção de duplicidade

### 11.4 Reembolso

- deve revogar acesso conforme política definida
- deve registrar auditoria
- não pode depender de ação manual no frontend

---

## 12. Segurança em afiliados e cupons

### 12.1 Afiliados

- tracking pode começar no frontend, mas validação é backend
- comissão só nasce após pagamento confirmado
- cálculo de comissão nunca fica no cliente
- afiliado bloqueado não deve gerar comissão válida

### 12.2 Cupons

- validação definitiva apenas no backend
- limites de uso controlados com segurança transacional
- cupom expirado ou inválido deve ser bloqueado no backend
- `current_uses` deve ser consistente e auditável quando necessário

---

## 13. Segurança de sessão

### 13.1 Requisitos

A sessão deve prever:

- persistência segura
- refresh de token
- tratamento de expiração
- redirecionamento para login quando inválida
- bloqueio de acesso se a permissão mudar

### 13.2 Mudança de perfil ou status

Se o usuário perder permissão ou for bloqueado:

- deve perder acesso às áreas restritas
- o frontend deve atualizar estado
- o backend e o banco devem bloquear a continuidade da operação

### 13.3 Logout

- deve limpar estado local
- deve invalidar contexto de navegação protegida
- deve impedir reaproveitamento de UI privada sem nova validação

---

## 14. Segurança de formulários e input

Toda entrada recebida deve ser tratada com:

- validação de schema
- sanitização
- checagem de tipo
- rejeição de payload inconsistente

### Casos críticos
- criação de usuário
- atualização de role
- criação de produto
- aplicação de cupom
- abertura de ticket
- resposta administrativa
- payload de webhook
- geração de acesso a arquivo

---

## 15. Logs e auditoria

## 15.1 Logs operacionais

Toda operação crítica deve registrar:

- início
- contexto do usuário ou sistema
- resultado
- erro, quando houver
- identificador da execução

## 15.2 Auditoria obrigatória

Devem gerar auditoria:

- criação de usuário por admin
- edição de usuário por admin
- remoção ou bloqueio de usuário
- alteração de role
- alteração de status
- revogação de acesso
- ações críticas em pedidos
- publicação/arquivamento de produto
- notificações em massa

## 15.3 Tabela de auditoria

Usar `audit_logs` para:

- ator
- ação
- entidade
- id da entidade
- metadata
- timestamp

---

## 16. Integridade e proteção estrutural no banco

Além de RLS, a segurança depende de:

- foreign keys
- unique constraints
- check constraints
- índices adequados
- timestamps
- status explícitos
- triggers de consistência
- grants controlados por tabela dedicada

### Regras essenciais
- `access_grants` é a fonte real do acesso
- `orders` é histórico comercial, não autorização final
- `profiles` não pode permitir autoelevação de privilégio
- constraints devem impedir valores inválidos em preço, desconto e comissão

---

## 17. Operações sensíveis que exigem backend

As seguintes operações são obrigatoriamente backend:

- criação de checkout
- confirmação de pagamento
- concessão de grant
- revogação de grant
- geração de link seguro
- alteração de role
- criação/remoção/bloqueio de usuário por admin
- envio de notificações em massa
- reconciliação de pedidos
- validação de webhook
- cálculo de comissão
- aplicação final de cupom

---

## 18. Anti-padrões proibidos

- segredo no frontend
- ausência de RLS
- endpoint admin sem validação
- lógica crítica só no cliente
- arquivo privado com URL pública permanente
- usuário comum alterando role ou status
- grants criados diretamente pelo frontend
- webhook sem validação
- cron sem log
- ação crítica sem auditoria

---

## 19. Critérios de aceite

A segurança será considerada adequada quando:

- áreas privadas exigirem autenticação real
- admin exigir role válida no backend
- dados privados estiverem protegidos por RLS
- conteúdo pago não for público
- arquivos forem servidos com acesso temporário e controlado
- grants só forem concedidos pelo backend
- alterações de role e usuário forem auditadas
- webhooks forem validados e idempotentes
- mudanças de status bloquearem corretamente o acesso

---

## 20. Riscos

### Riscos técnicos
- policy RLS incompleta
- função admin sem validação robusta
- grant duplicado
- role inconsistente entre frontend e banco
- bucket mal configurado
- remoção de usuário sem estratégia de reversão
- sessão antiga mantendo acesso indevido

### Riscos operacionais
- admin alterando usuário sem auditoria
- bloqueio incorreto de usuário
- exclusão indevida
- acesso persistindo após reembolso
- comissão sendo processada em duplicidade

---

## 21. Observações finais

- segurança deve nascer junto da arquitetura, não ser adicionada depois
- o banco é parte ativa da segurança
- Edge Functions são obrigatórias para todo fluxo sensível
- gestão de usuários e roles é um ponto crítico do admin
- proteção de arquivos é tão importante quanto proteção de dados
- toda decisão de acesso deve ser comprovável por regras de banco e backend
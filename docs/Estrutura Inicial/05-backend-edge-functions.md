# Backend e Edge Functions — Mariana Explica

## 1. Contexto

Este documento define a camada de backend serverless da plataforma Mariana Explica, com foco em:

- operações sensíveis
- regras críticas de negócio
- integrações externas
- automações
- segurança operacional
- rastreabilidade

A arquitetura do projeto segue o padrão:

Frontend React + Supabase + Edge Functions + PostgreSQL + Storage

O backend sensível deve ficar concentrado em Edge Functions, nunca no frontend.

---

## 2. Objetivo

Garantir que toda operação crítica da plataforma seja executada de forma:

- segura
- rastreável
- idempotente quando necessário
- desacoplada do frontend
- preparada para evolução futura

---

## 3. Princípios de backend

### 3.1 Regra principal

Toda lógica crítica deve estar no backend.

Inclui:

- checkout
- pagamento
- acesso a conteúdo
- afiliados
- cupons
- notificações
- suporte
- ações administrativas

---

### 3.2 O frontend não deve

- validar permissões críticas
- calcular valores finais
- liberar acesso
- acessar APIs privadas
- expor segredos

---

### 3.3 Papel das Edge Functions

- validar regras de negócio
- validar autenticação/autorização
- proteger integrações
- gerar acessos seguros
- registrar logs
- executar automações

---

## 4. Escopo do backend

- checkout
- pagamentos
- acesso (grants)
- arquivos seguros
- cupons
- afiliados
- notificações
- suporte
- admin
- cron jobs

---

## 5. Estrutura de pastas

supabase/
  functions/
    _shared/
      auth.ts
      admin.ts
      errors.ts
      response.ts
      logger.ts
      storage.ts
      payments.ts
      coupons.ts
      affiliates.ts
      grants.ts
      notifications.ts
      validation.ts
      audit.ts

    create-checkout/
    payment-webhook/
    confirm-order-access/
    generate-asset-access/
    claim-free-product/
    apply-coupon-preview/
    create-affiliate-profile/
    register-affiliate-referral/
    admin-create-product/
    admin-update-product/
    admin-publish-product/
    admin-revoke-access/
    admin-send-notification/
    create-support-ticket/
    reply-support-ticket/
    cron-process-notifications/
    cron-reconcile-orders/

---

## 6. Padrão de execução de função

Toda função deve seguir:

1. receber request
2. gerar request_id
3. validar método
4. validar autenticação
5. validar permissão
6. validar payload
7. executar regra
8. registrar logs
9. retornar resposta

---

## 7. Funções principais

### 7.1 create-checkout

- valida produto
- valida cupom
- valida afiliado
- calcula valor no backend
- cria order
- cria sessão de pagamento

---

### 7.2 payment-webhook

- valida assinatura
- atualiza pedido
- cria access_grant
- registra cupom
- registra afiliado
- envia notificação
- registra logs

---

### 7.3 generate-asset-access

- valida usuário
- valida compra
- valida módulo
- gera URL assinada
- nunca expõe path direto

---

### 7.4 claim-free-product

- valida produto gratuito
- cria access_grant
- impede duplicidade

---

### 7.5 apply-coupon-preview

- valida cupom
- calcula desconto
- não cria pedido

---

### 7.6 create-affiliate-profile

- gera código único
- cria afiliado
- atualiza perfil

---

### 7.7 register-affiliate-referral

- registra tracking
- não gera comissão

---

### 7.8 admin-create-product

- valida admin
- cria produto
- valida consistência

---

### 7.9 admin-update-product

- valida admin
- atualiza produto
- registra auditoria

---

### 7.10 admin-revoke-access

- revoga grant
- registra motivo
- registra auditoria

---

### 7.11 admin-send-notification

- cria notificações
- opcional email
- suporta envio em massa

---

### 7.12 create-support-ticket

- cria ticket
- cria mensagem inicial

---

### 7.13 reply-support-ticket

- valida permissão
- adiciona resposta
- atualiza status

---

### 7.14 cron-process-notifications

- processa fila
- registra job_runs

---

### 7.15 cron-reconcile-orders

- corrige inconsistências
- valida pedidos
- garante grants

---

## 8. Autenticação por tipo de função

### Pública controlada
- create-checkout
- apply-coupon-preview

### Autenticada
- generate-asset-access
- claim-free-product
- support

### Admin
- admin-*

### Interna (cron)
- cron-*

---

## 9. Segurança obrigatória

- validar tudo no backend
- nunca confiar no frontend
- usar RLS no banco
- usar URL assinada para arquivos
- validar webhook
- usar service role apenas internamente

---

## 10. Idempotência

Aplicar em:

- webhook
- grants
- cupons
- afiliados
- cron jobs

---

## 11. Logs

Registrar:

- request_id
- usuário
- ação
- resultado
- erro

---

## 12. Auditoria

Registrar em audit_logs:

- ações admin
- revogação de acesso
- alterações críticas
- correções manuais

---

## 13. Integrações

### Pagamento
- backend only
- webhook obrigatório

### Email
- via backend
- log em email_deliveries

### Storage
- acesso via função
- nunca público

### Afiliados
- cálculo server-side
- validação completa

---

## 14. Erros padrão

- 400 validação
- 401 não autenticado
- 403 sem permissão
- 404 não encontrado
- 409 conflito
- 422 regra de negócio
- 500 erro interno

Formato:

{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Descrição"
}

---

## 15. Critérios de aceite

- lógica crítica fora do frontend
- pagamentos confirmados via backend
- grants corretos
- arquivos seguros
- afiliados e cupons corretos
- admin protegido
- logs e auditoria ativos

---

## 16. Riscos

- webhook sem validação
- grant duplicado
- acesso indevido a arquivos
- funções admin expostas
- falta de logs

---

## 17. Observações finais

- create-checkout, payment-webhook e generate-asset-access são críticos
- access_grants é a base real de acesso
- nenhuma regra crítica deve ficar no frontend
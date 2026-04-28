# Automações — Mariana Explica

## 1. Contexto

Este documento define as automações da plataforma Mariana Explica.

As automações são responsáveis por executar processos recorrentes, assíncronos ou operacionais sem depender de ação manual do usuário ou do admin em tempo real.

Elas devem ser tratadas como parte crítica da arquitetura, pois impactam:

- confirmação e reconciliação de pedidos
- concessão e revogação de acessos
- notificações
- e-mails transacionais
- campanhas operacionais
- manutenção da consistência do sistema

---

## 2. Objetivo

Garantir que a plataforma tenha automações:

- seguras
- rastreáveis
- idempotentes
- reprocessáveis
- desacopladas do frontend
- preparadas para falhas parciais

---

## 3. Princípios obrigatórios

### 3.1 Toda automação crítica deve ter log

Cada execução deve registrar:

- início
- contexto
- resultado
- falha, quando houver
- horário
- identificador da execução

### 3.2 Toda automação financeira ou de acesso deve ser idempotente

Especialmente em:

- pagamento
- concessão de grant
- revogação de grant
- uso de cupom
- consolidação de afiliado
- reprocessamento de webhook

### 3.3 Automação não pode confiar no frontend

Toda decisão deve partir de:

- banco
- evento externo validado
- job interno
- regra backend

### 3.4 Toda automação crítica deve poder ser reprocessada com segurança

O sistema precisa permitir:

- retry seguro
- execução manual administrativa, quando necessário
- auditoria do que aconteceu

---

## 4. Escopo das automações

As automações da plataforma devem cobrir:

- confirmação de pagamento
- reconciliação de pedidos Stripe
- concessão de acesso
- revogação de acesso quando aplicável
- envio de e-mails transacionais
- geração de notificações internas
- processamento de filas simples
- tarefas administrativas recorrentes
- manutenção operacional

---

## 5. Tipos de automação

### 5.1 Event-driven

Executadas em resposta a um evento.

Exemplos:
- webhook da Stripe
- criação de ticket
- compra confirmada
- ativação de produto gratuito

### 5.2 Agendadas (cron)

Executadas em horários ou intervalos definidos.

Exemplos:
- reconciliação de pedidos
- reenvio de notificações falhadas
- limpeza de links expirados
- varredura de inconsistências

### 5.3 Operacionais manuais

Executadas por admin de forma controlada.

Exemplos:
- reprocessar pedido
- reenviar e-mail
- recriar grant ausente
- invalidar acesso manualmente

---

## 6. Estrutura recomendada

As automações devem viver em Edge Functions específicas, com responsabilidade única.

Estrutura sugerida:

supabase/
  functions/
    payment-webhook/
    cron-reconcile-orders/
    cron-process-notifications/
    cron-retry-email-deliveries/
    cron-clean-expired-links/
    cron-audit-access-consistency/
    admin-reprocess-order/
    admin-resend-notification/
    _shared/

---

## 7. Fonte de verdade das automações

A automação deve sempre usar como fonte de verdade:

- `orders`
- `access_grants`
- `affiliate_referrals`
- `coupon_usages`
- `notifications`
- `email_deliveries`
- `job_runs`
- `audit_logs`

### Regra central
- `orders` representa o estado comercial
- `access_grants` representa o acesso real
- automações nunca devem inferir estado apenas a partir do frontend

---

## 8. Automação: confirmação de pagamento

## 8.1 Origem

- webhook da Stripe

## 8.2 Objetivo

Quando o pagamento for confirmado, o sistema deve:

- atualizar o pedido
- registrar o status correto
- conceder acesso
- consolidar afiliado
- registrar uso de cupom
- criar notificação
- registrar e-mail transacional

## 8.3 Etapas da automação

1. validar assinatura do webhook
2. validar evento
3. localizar pedido interno
4. verificar idempotência
5. atualizar `orders`
6. criar ou confirmar `access_grants`
7. registrar `coupon_usages`, se aplicável
8. consolidar `affiliate_referrals`, se aplicável
9. criar `notifications`
10. registrar `email_deliveries`
11. salvar log de execução

## 8.4 Falhas toleráveis

Falhas secundárias, como e-mail ou notificação, não devem invalidar:

- atualização do pedido
- concessão do grant

Essas falhas devem ser registradas para retry posterior.

---

## 9. Automação: reconciliação de pedidos Stripe

## 9.1 Objetivo

Detectar e corrigir inconsistências entre:

- estado do pedido no banco
- confirmação real da Stripe
- existência de grant
- status de notificações e e-mails

## 9.2 Quando executar

- por cron
- sob demanda administrativa

## 9.3 Casos a reconciliar

- pedido pago sem grant
- pedido com grant, mas status incorreto
- pedido pendente com confirmação externa já recebida
- pedido reembolsado com acesso ainda ativo
- falha parcial no pós-pagamento

## 9.4 Regras

- toda correção deve ser segura
- toda correção deve registrar `job_runs`
- ações manuais devem gerar `audit_logs`
- automação deve impedir duplicidade de grants e comissões

---

## 10. Automação: concessão de access_grants

## 10.1 Objetivo

Transformar uma condição válida de acesso em grant real no banco.

## 10.2 Fontes válidas

- compra paga
- claim de produto gratuito
- concessão administrativa
- ajuste operacional controlado

## 10.3 Regras

- grant ativo não pode ser duplicado
- reprocessamento deve ser idempotente
- grant revogado não deve ser recriado sem validação explícita
- origem do grant deve ficar registrada em `source_type`

---

## 11. Automação: revogação de acesso

## 11.1 Objetivo

Remover acesso quando houver motivo legítimo.

## 11.2 Casos previstos

- reembolso confirmado
- bloqueio manual
- fraude
- correção operacional
- expiração futura, caso venha a existir

## 11.3 Regras

- revogação deve atualizar `access_grants`
- deve registrar motivo
- deve gerar auditoria quando a ação for administrativa
- deve refletir corretamente na área do aluno

---

## 12. Automação: notificações internas

## 12.1 Objetivo

Criar e distribuir notificações do sistema.

## 12.2 Casos previstos

- compra confirmada
- produto gratuito ativado
- ticket criado
- ticket respondido
- aviso administrativo
- campanha futura

## 12.3 Regras

- notificação nasce no backend
- falha de notificação não pode corromper o fluxo principal
- envio em massa deve usar lote rastreável
- leitura acontece no frontend, mas criação deve ser server-side

---

## 13. Automação: e-mails transacionais

## 13.1 Objetivo

Enviar comunicações acionadas por eventos do sistema.

## 13.2 Casos iniciais

- compra confirmada
- acesso a produto gratuito
- ticket criado
- ticket respondido
- comunicação administrativa

## 13.3 Regras

- criar log em `email_deliveries`
- separar erro técnico de erro de negócio
- permitir retry seguro
- não bloquear o fluxo principal em caso de falha secundária

---

## 14. Automação: retry de e-mails falhados

## 14.1 Objetivo

Tentar novamente entregas que falharam temporariamente.

## 14.2 Regras

- aplicar limite de tentativas
- registrar novo status
- evitar loop infinito
- registrar motivo da falha mais recente
- permitir reprocessamento manual pelo admin quando necessário

---

## 15. Automação: processamento de notificações em massa

## 15.1 Objetivo

Permitir comunicações operacionais e campanhas controladas.

## 15.2 Regras

- segmentação validada no backend
- lote identificado
- falhas individuais não derrubam o lote completo
- execução registrada em `job_runs`
- mensagens críticas devem poder ser auditadas

---

## 16. Automação: limpeza de links expirados

## 16.1 Objetivo

Eliminar referências temporárias ou estados pendentes ligados a acessos expirados.

## 16.2 Regras

- útil para housekeeping
- não pode apagar histórico de negócio
- não pode afetar grants válidos
- deve ser reversível quando possível, ou ao menos auditável

---

## 17. Automação: verificação de consistência de acesso

## 17.1 Objetivo

Verificar divergências entre:

- `orders`
- `access_grants`
- `module_assets`
- status do usuário

## 17.2 Casos críticos

- usuário bloqueado com acesso ainda ativo
- pedido reembolsado com grant ativo
- grant ativo para produto arquivado quando isso for operacionalmente inválido
- asset disponível sem política correta de acesso

## 17.3 Resultado esperado

- gerar alertas
- registrar log
- opcionalmente corrigir automaticamente apenas casos seguros

---

## 18. Automação: suporte

## 18.1 Objetivo

Disparar efeitos secundários quando tickets mudam de estado.

## 18.2 Casos previstos

- criar notificação ao abrir ticket
- registrar e-mail quando ticket recebe resposta
- atualizar `last_reply_at`
- atualizar status operacional

---

## 19. Automação: afiliados

## 19.1 Objetivo

Consolidar corretamente a indicação após pagamento real.

## 19.2 Regras

- comissão só nasce com pedido pago
- referral inválido não gera comissão
- pedido reembolsado pode invalidar ou estornar o efeito conforme política
- duplicidade deve ser evitada com idempotência

---

## 20. Automação: cupons

## 20.1 Objetivo

Registrar uso e consistência do cupom após conclusão válida da compra.

## 20.2 Regras

- cupom não deve ser contado como usado antes da confirmação válida
- `current_uses` deve refletir o estado real do sistema
- reprocessamentos não podem inflar contagem

---

## 21. Tabela `job_runs`

## 21.1 Finalidade

Registrar execuções de jobs, cron jobs e automações relevantes.

## 21.2 Campos importantes

- `job_name`
- `status`
- `started_at`
- `finished_at`
- `payload`
- `result`
- `error_message`
- `idempotency_key`

## 21.3 Regras

- toda automação crítica deve registrar execução
- falhas devem ser rastreáveis
- jobs reprocessados devem poder ser identificados

---

## 22. Idempotência

## 22.1 Fluxos obrigatórios

Aplicar idempotência em:

- webhook da Stripe
- criação de grant pós-pagamento
- consolidação de afiliado
- contabilização de cupom
- cron jobs de reconciliação
- envios em massa
- retry de e-mails

## 22.2 Estratégias recomendadas

- `idempotency_key`
- unique constraints
- verificação prévia de estado
- checagem por `payment_reference`
- checagem de grant já existente
- checagem de referral já consolidado

---

## 23. Logs e observabilidade

Toda automação deve registrar, no mínimo:

- nome da automação
- entidade principal
- status de execução
- horário
- request_id ou execution_id
- erro, quando houver

### Casos obrigatórios
- pagamento
- grant
- revogação
- notificação em massa
- reconciliação
- retry de e-mail
- falhas de integração Stripe

---

## 24. Retry e reprocessamento

## 24.1 Regras gerais

- retry apenas em fluxos idempotentes
- registrar tentativa adicional
- limitar número de retries quando fizer sentido
- distinguir falha temporária de falha definitiva

## 24.2 Casos com retry permitido

- envio de e-mail
- reconciliação
- notificações
- jobs administrativos

## 24.3 Casos com cuidado especial

- pagamentos
- grants
- afiliados
- uso de cupom

Nesses casos, o reprocessamento deve sempre verificar o estado atual antes de aplicar qualquer mutação.

---

## 25. Segurança das automações

As automações devem seguir:

- segredo interno quando chamadas por cron
- validação de assinatura quando vierem de webhook
- service role apenas dentro da função
- nenhuma lógica crítica no frontend
- logs de ações sensíveis
- auditoria para reprocessamentos manuais

---

## 26. Operações administrativas manuais

O admin deve poder acionar, de forma controlada:

- reprocessar pedido
- recriar grant ausente
- reenviar e-mail
- reenviar notificação
- revogar acesso
- corrigir inconsistência operacional

### Regras
- toda ação manual deve ser auditada
- deve exigir permissão admin real
- deve registrar antes/depois quando a operação alterar estado crítico

---

## 27. Ordem de prioridade das automações no projeto

### Fase 1
- webhook Stripe
- concessão de grant
- notificação pós-compra
- e-mail pós-compra

### Fase 2
- reconciliação de pedidos
- retry de e-mails
- notificações de suporte
- claim de produto gratuito com automação completa

### Fase 3
- campanhas administrativas
- verificações de consistência
- limpeza operacional
- rotinas de manutenção

---

## 28. Critérios de aceite

As automações serão consideradas adequadas quando:

- pagamento confirmado gerar estado correto no sistema
- grants forem concedidos e revogados corretamente
- falhas secundárias não quebrarem o fluxo principal
- jobs tiverem logs completos
- reprocessamentos forem seguros
- integrações Stripe forem reconciliáveis
- notificações e e-mails puderem ser reenviados
- ações administrativas manuais forem auditadas

---

## 29. Riscos

### Riscos técnicos
- webhook duplicado sem idempotência
- grant duplicado
- retry inflando contagem de cupom
- comissão duplicada
- cron sem logs
- reconciliação corrigindo errado por regra fraca

### Riscos operacionais
- pagamento confirmado sem acesso liberado
- acesso mantido após reembolso
- e-mail não enviado sem visibilidade para suporte
- notificação em massa disparada para segmento errado
- reprocessamento manual sem auditoria

---

## 30. Observações finais

- automação é parte central do produto, não acessório
- Stripe + grants + reconciliação formam o núcleo operacional mais sensível
- toda automação crítica deve nascer com log, idempotência e reprocessamento seguro
- o sistema deve permitir manutenção operacional sem depender de intervenção técnica no banco
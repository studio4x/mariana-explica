# Integrações — Mariana Explica

## 1. Contexto

Este documento define as integrações externas da plataforma Mariana Explica.

As integrações devem ser tratadas como parte crítica da arquitetura, pois envolvem:

- pagamentos
- e-mail
- analytics
- rastreamento de conversão
- notificações
- serviços auxiliares de operação

Toda integração sensível deve ocorrer no backend, nunca diretamente no frontend quando houver segredo, credencial privada, lógica crítica ou risco operacional.

---

## 2. Objetivo

Garantir que as integrações da plataforma sejam:

- seguras
- desacopladas
- auditáveis
- fáceis de evoluir
- consistentes com a arquitetura serverless
- preparadas para operação real

---

## 3. Princípios obrigatórios

### 3.1 Backend como intermediário

Toda integração que envolva:

- segredo
- token privado
- validação crítica
- dados sensíveis
- webhooks
- automações

deve ser realizada por Edge Functions.

### 3.2 Frontend não é a fonte de verdade

O frontend pode iniciar fluxos e exibir estados, mas nunca deve:

- confirmar pagamento
- calcular preço final como verdade absoluta
- validar cupom como fonte final
- liberar acesso
- guardar segredo de API

### 3.3 Logs e rastreabilidade

Toda integração crítica deve prever:

- log de execução
- log de falha
- contexto mínimo da operação
- rastreabilidade por pedido, usuário ou evento

### 3.4 Idempotência

Integrações críticas devem prever idempotência, especialmente em:

- pagamentos
- webhooks
- automações
- reconciliações
- envios em massa

---

## 4. Mapa geral de integrações

A plataforma deve considerar inicialmente:

- Stripe (pagamento)
- serviço de e-mail transacional
- Google Analytics
- Meta Pixel
- Google Ads Conversion Tracking
- Supabase Storage
- Supabase Auth
- Supabase Realtime ou alternativa futura para notificações em tempo real

---

## 5. Gateway de pagamento oficial

## 5.1 Solução escolhida

O gateway oficial da plataforma será a Stripe.

### Papel da Stripe no projeto

A Stripe será responsável por:

- checkout
- processamento de pagamento
- confirmação assíncrona
- referência transacional externa
- suporte à reconciliação operacional

---

## 6. Integração com Stripe

## 6.1 Objetivo

Permitir que a plataforma:

- cobre produtos pagos com segurança
- crie pedidos internamente
- associe pagamentos a usuários e produtos
- confirme pagamentos via backend
- libere acesso apenas após confirmação válida

---

## 6.2 Estratégia de integração

A integração com Stripe deve seguir o fluxo:

1. frontend solicita início do checkout
2. backend valida produto, cupom e afiliado
3. backend cria `order` interno
4. backend cria sessão de checkout na Stripe
5. frontend redireciona usuário para o checkout hospedado
6. Stripe processa o pagamento
7. Stripe envia webhook para o backend
8. backend valida o evento
9. backend atualiza pedido
10. backend concede acesso

---

## 6.3 Abordagem recomendada

A integração deve usar Stripe Checkout como fluxo principal de pagamento.

O sistema interno deve tratar o checkout da Stripe como etapa externa do fluxo comercial, mas a fonte de verdade do negócio continua sendo o banco da aplicação.

---

## 6.4 Dados internos obrigatórios no checkout

Ao criar a sessão na Stripe, o backend deve vincular o pagamento ao domínio interno da plataforma.

Informações obrigatórias a associar:

- `order_id`
- `user_id`
- `product_id`
- `coupon_id` quando existir
- `affiliate_id` quando existir
- ambiente
- versão do fluxo quando necessário

Esses dados devem ser enviados de forma segura para facilitar reconciliação posterior.

---

## 6.5 Campos de reconciliação recomendados

Na integração com a Stripe, a plataforma deve usar mecanismos que permitam associar a sessão externa ao pedido interno.

Campos recomendados para estratégia de reconciliação:

- `client_reference_id`
- `metadata`
- referência externa persistida no banco local

---

## 6.6 Criação da sessão de checkout

A criação da sessão deve ser feita exclusivamente no backend.

A função responsável deve:

- validar se o produto está publicado
- validar se o produto é pagável
- validar cupom
- validar afiliado
- calcular valor final
- criar pedido interno
- criar sessão da Stripe
- salvar referência externa no pedido
- retornar URL segura para redirecionamento

---

## 6.7 Regras obrigatórias do checkout

- nunca aceitar valor final vindo do frontend
- nunca confiar em desconto calculado apenas no cliente
- nunca liberar acesso com base em retorno visual do navegador
- nunca assumir pagamento concluído apenas porque o usuário voltou da página de sucesso

---

## 6.8 Webhook da Stripe

O webhook será a principal fonte de confirmação do pagamento.

### Responsabilidades do webhook

- validar assinatura do evento
- localizar pedido interno
- mapear status externo para status interno
- evitar processamento duplicado
- conceder acesso quando aplicável
- registrar uso de cupom
- consolidar afiliado
- disparar notificações
- registrar logs

### Regras obrigatórias

- processar apenas eventos esperados
- validar assinatura antes de qualquer ação
- manter idempotência por evento
- registrar falhas técnicas e de negócio separadamente

---

## 6.9 Eventos de interesse da Stripe

A implementação deve ser preparada para consumir apenas os eventos realmente necessários ao domínio da plataforma.

Na fase inicial, o sistema deve considerar prioritariamente eventos ligados a:

- conclusão de checkout
- confirmação de pagamento
- falha
- expiração/cancelamento quando necessário
- reembolso, quando fizer parte da política operacional

A lista final de eventos tratados deve ficar explícita no código e na configuração do webhook.

---

## 6.10 Idempotência na Stripe

Toda operação crítica iniciada contra a Stripe deve considerar idempotência.

Casos obrigatórios:

- criação de sessão de checkout
- criação de objetos de pagamento quando houver retry
- reprocessamento de operações de backend ligadas a pagamento

Estratégia recomendada:

- usar chave de idempotência baseada no `order_id` ou identificador equivalente
- impedir duplicidade também no banco local
- tratar replays de webhook com segurança

---

## 6.11 Política de status de pedido

A Stripe possui estados externos; o sistema da plataforma possui seus próprios estados internos.

O backend deve fazer o mapeamento para os estados internos do projeto, por exemplo:

- `pending`
- `paid`
- `failed`
- `cancelled`
- `refunded`

O estado final operacional da plataforma deve sempre ser o estado interno, não o payload bruto da Stripe.

---

## 6.12 Reembolso

Quando houver reembolso:

- o backend deve atualizar o pedido
- o backend deve aplicar a política de revogação de acesso
- o backend deve registrar auditoria
- o backend deve registrar contexto do motivo quando disponível

---

## 6.13 Ambiente e credenciais Stripe

A integração deve prever:

- ambiente de teste
- ambiente de produção
- segregação completa de credenciais
- segredos apenas no backend
- webhook secret separado por ambiente

Variáveis esperadas:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY` (uso público controlado quando necessário)
- `STRIPE_PRICE_*` apenas se a estratégia usar preços pré-cadastrados
- `APP_BASE_URL`

---

## 6.14 Estratégia de modelagem para Stripe

A tabela `orders` deve armazenar referências externas da Stripe, como:

- `payment_provider = 'stripe'`
- `payment_reference`
- `checkout_session_id`

Opcionalmente, também pode armazenar:

- payload resumido
- status externo normalizado
- timestamps relevantes da integração

---

## 6.15 Segurança específica da Stripe

A implementação deve seguir estas regras:

- segredo nunca no frontend
- webhook sempre validado
- checkout sempre iniciado pelo backend
- pedido interno sempre criado antes ou junto da sessão externa
- grants só após confirmação backend
- logs obrigatórios em falhas de integração
- reconciliação segura em caso de inconsistência

---

## 7. Integração com e-mail

## 7.1 Objetivo

Enviar mensagens transacionais e operacionais, como:

- confirmação de compra
- acesso a produto gratuito
- notificação de suporte
- resposta de suporte
- comunicação administrativa

---

## 7.2 Estratégia

O envio de e-mail deve ser feito via backend.

O sistema deve registrar em `email_deliveries`:

- destinatário
- template
- status
- erro, quando houver
- referência do provedor, quando existir

---

## 7.3 Tipos de e-mail iniciais

- `purchase_confirmed`
- `free_product_claimed`
- `support_ticket_created`
- `support_ticket_replied`
- `manual_notification`

---

## 7.4 Regras

- o e-mail nunca substitui a verdade do banco
- e-mail é consequência da operação, não confirmação primária do estado
- falha de e-mail não pode corromper pedido ou grant
- a falha deve ficar logada para reprocessamento

---

## 8. Integração com analytics

## 8.1 Objetivo

Medir comportamento, conversão e uso da plataforma.

### Ferramentas previstas
- Google Analytics
- Meta Pixel
- Google Ads Conversion Tracking

---

## 8.2 Regras gerais

- rastreamento comercial no frontend
- eventos críticos podem ser reforçados no backend quando necessário
- não enviar dados sensíveis indevidamente
- respeitar política de consentimento de cookies quando aplicável

---

## 8.3 Eventos recomendados

### Área pública
- visualização de home
- visualização de produto
- início de checkout
- aplicação de cupom
- clique em CTA principal

### Conversão
- checkout iniciado
- pagamento confirmado
- compra concluída

### Área do aluno
- acesso a produto
- abertura de módulo
- download de material
- abertura de ticket

---

## 8.4 Fonte de verdade para conversão

Para uso comercial e mídia, eventos do frontend podem ser úteis.

Para operação interna da plataforma, a fonte de verdade deve continuar sendo:

- `orders`
- `access_grants`
- logs backend

---

## 9. Integração com Meta Pixel

## 9.1 Objetivo

Acompanhar comportamento e conversão para campanhas Meta.

### Eventos iniciais sugeridos
- `PageView`
- `ViewContent`
- `InitiateCheckout`
- `Purchase`

### Regras
- eventos públicos podem sair do frontend
- evento de compra deve ser coerente com confirmação real do pedido
- evitar disparo duplicado

---

## 10. Integração com Google Ads / conversões

## 10.1 Objetivo

Rastrear conversões oriundas de campanhas.

### Regras
- disparo de conversão deve acontecer apenas em condição realmente confirmada
- evitar considerar como conversão apenas retorno da página de sucesso
- sempre que necessário, reforçar validação pela camada backend

---

## 11. Integração com Supabase Storage

## 11.1 Objetivo

Armazenar:

- PDFs
- capas
- materiais de apoio
- anexos de suporte, se houver

### Regras
- arquivos privados por padrão
- acesso controlado por backend
- URL assinada temporária
- paths organizados por domínio

---

## 12. Integração com Supabase Auth

## 12.1 Objetivo

Gerenciar:

- login
- cadastro
- recuperação de senha
- sessão

### Regras
- perfil operacional complementar em `profiles`
- roles e status controlados na base
- backend usa contexto autenticado para validar operações

---

## 13. Integração com notificações internas

## 13.1 Objetivo

Comunicação dentro da plataforma.

### Casos
- compra confirmada
- novo acesso liberado
- suporte atualizado
- aviso administrativo

### Estratégia
- criação no backend
- leitura pelo frontend
- possibilidade futura de realtime

---

## 14. Integração com suporte

## 14.1 Objetivo

Permitir abertura e resposta de tickets.

### Estratégia
- criação de ticket via Edge Function
- mensagens persistidas no banco
- admin responde pelo painel
- eventos relevantes podem gerar e-mail/notificação

---

## 15. Integração com realtime (opcional evolutivo)

Pode ser usada futuramente para:

- notificações em tempo real
- atualização de tickets
- alertas operacionais

Não é dependência crítica do MVP, mas a arquitetura deve permitir sua adoção sem refatoração estrutural.

---

## 16. Mapeamento de responsabilidades por integração

### Frontend
Responsável por:
- iniciar ações
- exibir estado
- rastrear eventos de interface
- consumir dados autorizados

### Backend
Responsável por:
- pagamentos
- validação de cupom
- afiliados
- confirmação de compra
- concessão de acesso
- e-mails
- webhooks
- automações
- integração segura com storage

### Banco
Responsável por:
- persistir pedidos
- grants
- notificações
- logs
- auditoria
- referências externas

---

## 17. Logs e observabilidade

Toda integração crítica deve registrar:

- nome da integração
- ação executada
- entidade principal
- status
- erro
- timestamp
- request_id quando houver

Casos críticos de log:

- falha ao criar sessão Stripe
- webhook inválido
- divergência entre pedido e pagamento
- falha ao enviar e-mail
- falha ao gerar URL assinada
- evento de analytics inconsistente, quando monitorado no backend

---

## 18. Estratégia de retry

Integrações externas devem prever retentativa segura em casos controlados.

### Casos aplicáveis
- envio de e-mail
- automações
- reconciliação de pedido
- jobs agendados

### Casos com cuidado especial
- criação de pagamento
- reprocessamento de webhook
- consolidação de comissão

Retentativa sem idempotência é proibida em fluxos financeiros.

---

## 19. Critérios de aceite

As integrações serão consideradas adequadas quando:

- Stripe estiver integrada com segurança
- checkout for criado pelo backend
- webhook validar e confirmar pagamentos corretamente
- grants forem concedidos só após confirmação real
- e-mails estiverem desacoplados do fluxo crítico
- analytics e pixels rastrearem conversão sem comprometer segurança
- storage estiver protegido
- logs permitirem suporte operacional

---

## 20. Riscos

### Riscos técnicos
- webhook sem validação
- compra duplicada por retry sem idempotência
- divergência entre pedido interno e sessão Stripe
- disparo duplicado de conversão
- bucket mal configurado
- falha de e-mail bloqueando fluxo indevidamente

### Riscos operacionais
- grant não criado após pagamento confirmado
- acesso mantido após reembolso
- afiliado contabilizado incorretamente
- cupom aplicado no frontend mas recusado no backend
- inconsistência entre analytics e banco

---

## 21. Observações finais

- Stripe é a integração mais crítica da plataforma
- o pedido interno deve existir como fonte de verdade do negócio
- webhook é obrigatório para consistência operacional
- integrações de marketing ajudam conversão, mas não substituem o banco
- toda integração sensível deve nascer com log, segurança e possibilidade de reprocessamento
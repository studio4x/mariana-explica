# Especificação de Implementação — Integração Stripe + Moloni

| Campo                   | Valor                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| Projeto                 | Mariana Explica                                                         |
| Status                  | Proposta pronta para implementação, condicionada às decisões da seção 6 |
| Versão                  | 1.0                                                                     |
| Data                    | 23/07/2026                                                              |
| Responsáveis funcionais | Cliente e contabilista                                                  |
| Responsável técnico     | Equipe Mariana Explica                                                  |

---

## 1. Finalidade

Implementar a integração entre a Mariana Explica, a Stripe e a Moloni para que toda venda paga:

- continue sendo confirmada exclusivamente pela Stripe no backend;
- preserve `orders` como fonte do estado comercial;
- preserve `access_grants` como fonte real de autorização ao conteúdo;
- gere automaticamente o documento fiscal correspondente na Moloni;
- envie à Moloni os dados fiscais do comprador e os dados exatos da venda;
- permita consultar o documento fiscal na área do aluno e no admin;
- suporte falhas, retentativas, reprocessamento e reconciliação sem duplicidade;
- trate reembolsos por documento retificativo, conforme definição da contabilista.

A Stripe não deve comunicar diretamente com a Moloni. A Mariana Explica será a orquestradora das duas integrações.

---

## 2. Autoridade documental

Esta especificação é auxiliar e deve ser interpretada segundo a seguinte precedência:

1. `docs/Estrutura Inicial/02-regras-negocio.md`;
2. `docs/Estrutura Inicial/03-arquitetura.md`;
3. `docs/Estrutura Inicial/10-autenticacao-seguranca.md`;
4. `docs/Estrutura Inicial/04-banco-dados.md`;
5. `docs/Estrutura Inicial/05-backend-edge-functions.md`;
6. `docs/Estrutura Inicial/11-integracoes.md`;
7. `docs/Estrutura Inicial/12-automacoes.md`;
8. `docs/Estrutura Inicial/15-plano-de-implementacao.md`;
9. `AGENTS.md`;
10. esta especificação.

Em caso de conflito, os documentos canônicos e as regras fiscais validadas pela contabilista prevalecem.

---

## 3. Estado atual confirmado no repositório

O projeto já possui:

- checkout Stripe criado no backend pela Edge Function `create-checkout`;
- pedido interno criado antes da sessão Stripe;
- `order_id`, `user_id`, `product_id` e demais referências associados à sessão;
- Stripe Checkout com endereço de faturação obrigatório;
- coleta de nome, e-mail e NIF opcional no checkout da plataforma;
- Stripe Tax habilitado;
- criação opcional de Invoice na Stripe quando o comprador solicita NIF;
- webhook com validação de assinatura;
- tratamento de:
  - `checkout.session.completed`;
  - `checkout.session.async_payment_succeeded`;
  - `checkout.session.async_payment_failed`;
  - `checkout.session.expired`;
  - `charge.refunded`;
  - eventos de disputa já previstos no código;
- validação de ambiente, moeda e valor pago;
- atualização de `orders`;
- criação e revogação de `access_grants`;
- registro de cupom, afiliado, notificação, e-mail e auditoria;
- reconciliação de pedidos com a Stripe;
- painel administrativo de pagamentos;
- colunas `tax_amount_cents`, `total_paid_cents` e `stripe_invoice_id`.

Lacunas que esta implementação deve resolver:

- não existe integração Moloni;
- os dados fiscais da venda não são congelados em snapshot próprio do pedido;
- o endereço retornado pelo Stripe Checkout não é persistido como dado fiscal do pedido;
- não existe fila durável para emissão fiscal;
- não existe vínculo entre produto interno e artigo/taxa/série da Moloni;
- não existe armazenamento do identificador, número e status do documento Moloni;
- não existe reconciliação de pedidos pagos sem documento fiscal;
- não existe fluxo fiscal para reembolso;
- a interface ainda trata a Invoice Stripe como “fatura”, o que poderá confundir comprovativo de pagamento com documento fiscal Moloni.

---

## 4. Arquitetura-alvo

```text
Cliente
  |
  v
Mariana Explica / create-checkout
  |  cria order + snapshot fiscal inicial
  v
Stripe Checkout
  |
  | webhook assinado
  v
payment-webhook
  |  confirma pagamento e enriquece snapshot
  |  mantém grants e demais efeitos atuais
  v
Banco / fila fiscal durável
  |
  | processamento assíncrono
  v
process-moloni-documents
  |  resolve cliente + emite documento
  v
Moloni API
  |
  v
fiscal_documents + auditoria + área do aluno/admin
```

### 4.1 Separação obrigatória

O `payment-webhook` não deve aguardar a emissão do documento na Moloni.

Ao confirmar o pagamento, ele deve:

1. validar e persistir o pagamento;
2. manter o fluxo atual de `access_grants`;
3. completar o snapshot fiscal;
4. garantir a criação idempotente de uma tarefa fiscal;
5. responder à Stripe sem depender da disponibilidade da Moloni.

A indisponibilidade da Moloni:

- não pode desfazer um pagamento confirmado;
- não pode remover ou atrasar o `access_grant`;
- não pode fazer o webhook Stripe responder com erro depois que os efeitos comerciais essenciais estiverem persistidos;
- deve gerar uma falha fiscal reprocessável e visível no admin.

### 4.2 Consistência

Não existe transação distribuída entre PostgreSQL e Moloni.

A solução deve usar consistência eventual com:

- fila/outbox persistida no PostgreSQL;
- chave idempotente por pedido e tipo de documento;
- bloqueio concorrente da tarefa;
- busca de documento já criado antes de repetir uma emissão incerta;
- reconciliação periódica;
- reprocessamento administrativo auditado.

---

## 5. Fontes de verdade

| Domínio                            | Fonte de verdade                |
| ---------------------------------- | ------------------------------- |
| Confirmação externa do pagamento   | Stripe                          |
| Estado comercial da venda          | `orders`                        |
| Itens e valores vendidos           | `order_items` + snapshot fiscal |
| Autorização ao conteúdo            | `access_grants`                 |
| Dados fiscais usados naquela venda | `order_billing_details`         |
| Estado da emissão fiscal           | `fiscal_documents`              |
| Documento fiscal oficial           | Moloni                          |
| Configuração e mapeamento fiscal   | tabelas administrativas Moloni  |

O perfil atual do usuário não pode substituir o snapshot da venda. Alterações posteriores em nome, NIF ou endereço não devem modificar um documento já emitido nem os dados históricos do pedido.

---

## 6. Decisões fiscais bloqueantes

Antes de ativar a emissão automática em produção, a cliente e a contabilista devem responder e registrar:

- [ ] Documento para pagamento imediato:
  - fatura-recibo; ou
  - fatura seguida de recibo.
- [ ] Regra para comprador sem NIF.
- [ ] Campos fiscais obrigatórios para pessoa singular.
- [ ] Campos fiscais obrigatórios para empresa.
- [ ] Série documental Moloni que será usada em produção.
- [ ] Série documental ou estratégia de rascunho para homologação.
- [ ] CAE aplicável, quando a conta tiver mais de um.
- [ ] Artigo ou artigos Moloni correspondentes aos produtos digitais.
- [ ] Taxa de IVA aplicável em Portugal.
- [ ] Regras para compradores de outros países.
- [ ] Tratamento de vendas B2C/B2B intracomunitárias e eventual OSS.
- [ ] Tratamento de isenção e respetivo motivo legal, quando aplicável.
- [ ] Documento necessário em reembolso total.
- [ ] Documento necessário em reembolso parcial.
- [ ] Tratamento contábil de chargeback/disputa.
- [ ] Se o documento deve ser fechado automaticamente (`status = 1`) ou criado em rascunho durante homologação.
- [ ] Se a comunicação à Autoridade Tributária está ativa e corretamente configurada na Moloni.
- [ ] Política de envio do PDF ao cliente.

Nenhum valor fiscal, `tax_id`, motivo de isenção, série ou tipo documental deve ser inventado no código.

---

## 7. Dados fiscais do comprador

### 7.1 Campos do snapshot

Criar `public.order_billing_details` com, no mínimo:

| Campo                | Tipo sugerido      | Regra                                               |
| -------------------- | ------------------ | --------------------------------------------------- |
| `id`                 | `uuid`             | PK                                                  |
| `order_id`           | `uuid`             | FK única para `orders`, `on delete cascade`         |
| `user_id`            | `uuid`             | FK para `profiles`, redundância controlada para RLS |
| `customer_type`      | `text`             | `individual`, `company` ou valor aprovado           |
| `legal_name`         | `text`             | nome fiscal usado no documento                      |
| `email`              | `text`             | e-mail usado na compra                              |
| `vat_number`         | `text null`        | NIF/NIPC normalizado                                |
| `vat_country`        | `text null`        | ISO-2                                               |
| `address_line1`      | `text null`        | endereço fiscal                                     |
| `address_line2`      | `text null`        | complemento                                         |
| `postal_code`        | `text null`        | código postal                                       |
| `city`               | `text null`        | cidade/localidade                                   |
| `state`              | `text null`        | região/distrito quando aplicável                    |
| `country_code`       | `text null`        | ISO-2                                               |
| `stripe_customer_id` | `text null`        | referência externa                                  |
| `stripe_tax_id_type` | `text null`        | apenas quando fornecido pela Stripe                 |
| `source`             | `text`             | `platform`, `stripe` ou `merged`                    |
| `completed_at`       | `timestamptz null` | quando o snapshot ficou apto à emissão              |
| `created_at`         | `timestamptz`      | padrão `now()`                                      |
| `updated_at`         | `timestamptz`      | trigger padrão                                      |

### 7.2 Origem e precedência

Na criação do checkout:

- congelar nome, e-mail e NIF informados/validados pela plataforma;
- associar o snapshot ao `order_id`.

Na confirmação Stripe:

- ler `customer_details`;
- persistir endereço de faturação, país e referências Stripe;
- preencher apenas campos que não devem contrariar dados fiscais explícitos da plataforma;
- validar divergências relevantes de nome/NIF;
- marcar o snapshot como completo ou como `requires_review`.

Precedência sugerida:

1. NIF e nome fiscal explicitamente confirmados na plataforma;
2. dados retornados pelo Stripe Checkout;
3. perfil do usuário apenas como origem inicial.

### 7.3 Validação

- normalizar NIF sem espaços/pontuação;
- validar checksum de NIF português no frontend e novamente no backend;
- não tratar apenas “nove dígitos” como validação suficiente;
- validar e-mail, país e código postal;
- não confiar em dados recebidos do frontend;
- não permitir edição do snapshot pelo cliente depois da emissão;
- toda correção pós-emissão deve seguir procedimento fiscal, não simples `UPDATE`.

### 7.4 Dados ausentes

Se faltar dado obrigatório:

- o pagamento e o acesso continuam válidos;
- o job fiscal fica em `blocked_data`;
- o admin recebe indicação clara dos campos ausentes;
- a emissão automática não cria documento incorreto;
- o reprocessamento ocorre depois da correção autorizada.

---

## 8. Modelo de dados fiscal

Toda alteração deve ser criada por migration SQL versionada.

### 8.1 `fiscal_documents`

Registro principal de cada documento fiscal:

| Campo                         | Tipo sugerido      | Regra                                                                    |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------ |
| `id`                          | `uuid`             | PK                                                                       |
| `order_id`                    | `uuid`             | FK para `orders`, `on delete restrict`                                   |
| `user_id`                     | `uuid`             | FK para `profiles`, usado em RLS                                         |
| `provider`                    | `text`             | inicialmente `moloni`                                                    |
| `document_kind`               | `text`             | `invoice`, `invoice_receipt`, `receipt`, `credit_note`, `payment_return` |
| `status`                      | `text`             | ver estados abaixo                                                       |
| `environment`                 | `text`             | `test`, `draft` ou `live`, conforme estratégia aprovada                  |
| `moloni_company_id`           | `integer null`     | empresa emissora                                                         |
| `moloni_customer_id`          | `integer null`     | cliente                                                                  |
| `moloni_document_id`          | `integer null`     | documento                                                                |
| `moloni_document_set_id`      | `integer null`     | série                                                                    |
| `document_number`             | `text null`        | número legível                                                           |
| `original_fiscal_document_id` | `uuid null`        | vínculo de documento retificativo                                        |
| `currency`                    | `text`             | igual ao pedido                                                          |
| `net_amount_cents`            | `integer`          | líquido                                                                  |
| `tax_amount_cents`            | `integer`          | imposto                                                                  |
| `total_amount_cents`          | `integer`          | total                                                                    |
| `payment_reference`           | `text null`        | PaymentIntent/Checkout                                                   |
| `your_reference`              | `text`             | usar `order_id` com sufixo por tipo                                      |
| `payload_hash`                | `text`             | detecta alteração e auxilia idempotência                                 |
| `issued_at`                   | `timestamptz null` | emissão concluída                                                        |
| `last_error_code`             | `text null`        | código normalizado                                                       |
| `last_error_message`          | `text null`        | mensagem sanitizada                                                      |
| `created_at`                  | `timestamptz`      | padrão                                                                   |
| `updated_at`                  | `timestamptz`      | trigger                                                                  |

Estados mínimos:

- `pending`;
- `processing`;
- `blocked_data`;
- `issued`;
- `failed_retryable`;
- `failed_permanent`;
- `credit_pending`;
- `credited`;
- `cancelled_before_issue`.

Constraints mínimas:

- valores monetários não negativos;
- `total_amount_cents = net_amount_cents + tax_amount_cents`, salvo arredondamento explicitamente tratado;
- unicidade de documento principal por `order_id + provider + document_kind`;
- unicidade parcial de `moloni_document_id`;
- documento `issued` exige `moloni_document_id`, número e `issued_at`;
- documento retificativo exige `original_fiscal_document_id`.

### 8.2 `moloni_document_jobs`

Fila durável:

| Campo                | Tipo sugerido      |
| -------------------- | ------------------ |
| `id`                 | `uuid`             |
| `fiscal_document_id` | `uuid`             |
| `job_type`           | `text`             |
| `status`             | `text`             |
| `idempotency_key`    | `text unique`      |
| `attempt_count`      | `integer`          |
| `max_attempts`       | `integer`          |
| `available_at`       | `timestamptz`      |
| `locked_at`          | `timestamptz null` |
| `locked_by`          | `text null`        |
| `last_http_status`   | `integer null`     |
| `last_error`         | `text null`        |
| `created_at`         | `timestamptz`      |
| `updated_at`         | `timestamptz`      |

Estados:

- `pending`;
- `processing`;
- `retry`;
- `completed`;
- `failed`;
- `cancelled`.

Processamento concorrente deve usar claim atômico, preferencialmente com função SQL e `FOR UPDATE SKIP LOCKED`.

### 8.3 `moloni_product_mappings`

Mapeamento administrativo por produto:

| Campo                    | Tipo sugerido  |
| ------------------------ | -------------- |
| `id`                     | `uuid`         |
| `product_id`             | `uuid unique`  |
| `moloni_company_id`      | `integer`      |
| `moloni_product_id`      | `integer`      |
| `moloni_document_set_id` | `integer`      |
| `moloni_tax_id`          | `integer null` |
| `exemption_reason`       | `text null`    |
| `eac_id`                 | `integer null` |
| `is_active`              | `boolean`      |
| `created_at`             | `timestamptz`  |
| `updated_at`             | `timestamptz`  |

Se houver tributação por país/tipo de comprador, criar estrutura de regras separada. Não sobrecarregar um único `moloni_tax_id` se ele não representar todas as situações.

### 8.4 `moloni_customer_links`

Cache de correspondência entre cliente interno e Moloni:

| Campo                 | Tipo sugerido      |
| --------------------- | ------------------ |
| `id`                  | `uuid`             |
| `user_id`             | `uuid`             |
| `moloni_company_id`   | `integer`          |
| `moloni_customer_id`  | `integer`          |
| `vat_number_snapshot` | `text null`        |
| `last_synced_at`      | `timestamptz null` |
| `created_at`          | `timestamptz`      |
| `updated_at`          | `timestamptz`      |

A busca por NIF na Moloni deve ter precedência sobre e-mail. E-mail não é identificador fiscal imutável.

### 8.5 Eventos Stripe processados

Confirmar se já existe persistência durável por `event.id`. Se não existir, criar tabela ou constraint equivalente para impedir reprocessamento do mesmo evento Stripe.

O simples teste `order.status = paid` não cobre todos os efeitos secundários nem reembolsos parciais.

---

## 9. RLS, privacidade e permissões

### 9.1 Regras

- `order_billing_details`: usuário pode ler somente os próprios dados; admin pode ler; escrita apenas backend.
- `fiscal_documents`: usuário pode ler metadados dos próprios pedidos; admin pode ler; escrita apenas backend.
- `moloni_document_jobs`: somente admin para leitura operacional; escrita apenas backend.
- `moloni_product_mappings`: somente admin; alterações via Edge Function administrativa auditada.
- `moloni_customer_links`: sem acesso direto do aluno; admin conforme necessidade; escrita backend.
- credenciais OAuth: nunca no schema público nem acessíveis por RLS comum.

### 9.2 Dados pessoais

- armazenar apenas campos necessários à obrigação fiscal;
- evitar payload bruto integral da Stripe ou Moloni;
- sanitizar logs para não expor NIF, endereço, tokens ou conteúdo sensível;
- permitir auditoria sem duplicar dados pessoais em `audit_logs`;
- definir retenção segundo obrigação fiscal e política de privacidade.

---

## 10. Autenticação Moloni

A API Moloni usa OAuth 2.0:

- access token com validade limitada;
- refresh token rotativo;
- renovação antes de operações;
- nova autenticação administrativa quando o refresh não for mais válido.

### 10.1 Segredos estáticos

Configurar exclusivamente no backend:

- `MOLONI_CLIENT_ID`;
- `MOLONI_CLIENT_SECRET`;
- `MOLONI_REDIRECT_URI`;
- `MOLONI_COMPANY_ID`, se a configuração for fixa;
- `MOLONI_TOKEN_ENCRYPTION_KEY`, caso a estratégia use criptografia aplicacional;
- segredo interno do cron já adotado pelo projeto.

Nunca usar prefixo `VITE_`.

### 10.2 Tokens mutáveis

Como os tokens são renovados, eles não podem depender apenas de variável de ambiente estática.

Estratégia obrigatória:

- armazenar access/refresh tokens em área server-only;
- preferir Supabase Vault, se validado no projeto;
- alternativa: schema privado não exposto pelo PostgREST, tokens cifrados com chave mantida em secret;
- restringir leitura/escrita a funções backend autorizadas;
- atualizar access e refresh token juntos após cada renovação;
- usar lock para impedir duas renovações concorrentes;
- registrar apenas datas/status, nunca o valor dos tokens.

### 10.3 Fluxo de conexão

Criar:

- `admin-moloni-oauth-start`:
  - exige admin ativo;
  - cria `state` aleatório, de uso único e com expiração;
  - devolve URL oficial de autorização Moloni.
- `moloni-oauth-callback`:
  - valida `state`;
  - troca `code` por tokens;
  - cifra e persiste tokens;
  - consulta a conta/empresa;
  - registra auditoria;
  - redireciona ao admin com resultado sem expor tokens.
- `admin-moloni-disconnect`:
  - exige admin;
  - confirmação explícita;
  - remove/revoga a conexão de forma auditada;
  - não apaga documentos históricos.

---

## 11. Cliente Moloni compartilhado

Criar `supabase/functions/_shared/moloni.ts` com responsabilidade única:

- obter conexão ativa;
- renovar token quando necessário;
- serializar chamadas POST;
- adicionar `access_token`, `json=true` e `human_errors=true`;
- aplicar timeout;
- normalizar respostas e erros;
- classificar erro como retryable ou permanente;
- respeitar limites da API;
- gerar logs sanitizados;
- oferecer métodos tipados mínimos.

Métodos necessários:

- consultar empresa;
- consultar cliente por NIF;
- consultar cliente por e-mail apenas como fallback controlado;
- criar cliente;
- atualizar dados permitidos do cliente;
- consultar artigo;
- criar documento fiscal definido na seção 6;
- consultar documento por `document_id`;
- procurar por `your_reference`;
- obter link/PDF do documento;
- criar nota de crédito;
- criar devolução/recibo, se exigido.

Não implementar endpoints Moloni que estejam fora do escopo.

---

## 12. Criação ou resolução do cliente Moloni

Algoritmo:

1. validar snapshot fiscal;
2. consultar `moloni_customer_links`;
3. se houver NIF, confirmar na Moloni por NIF;
4. se não houver vínculo válido, procurar por NIF diretamente;
5. somente quando permitido, usar e-mail como fallback;
6. criar cliente se não existir;
7. persistir `moloni_customer_id`;
8. atualizar apenas campos que a Moloni permita alterar;
9. nunca tentar alterar NIF de cliente já referenciado em documento;
10. divergência de NIF deve bloquear e exigir revisão.

Idempotência:

- duas tarefas concorrentes não podem criar dois clientes para o mesmo NIF;
- usar lock/advisory lock ou unicidade local;
- após erro de conexão, pesquisar novamente antes de repetir `insert`.

---

## 13. Emissão do documento

### 13.1 Pré-condições

- pedido em `paid`;
- `total_paid_cents` preenchido;
- snapshot fiscal apto;
- produto com mapeamento Moloni ativo;
- conexão OAuth válida;
- regra fiscal aplicável encontrada;
- nenhum documento principal já emitido para o pedido.

### 13.2 Montagem

O payload deve usar:

- `order_id` como referência externa rastreável;
- data de pagamento/emissão aprovada;
- cliente Moloni resolvido;
- artigo Moloni mapeado;
- nome do item a partir do snapshot de `order_items`;
- quantidade;
- valor líquido, imposto e total derivados do pedido confirmado;
- desconto real;
- moeda;
- série;
- taxa ou motivo de isenção;
- método de pagamento “Stripe”;
- referência Stripe sem dados de cartão.

Nunca recalcular preço a partir do produto atual.

### 13.3 Validação monetária

Antes de fechar o documento:

- `total Moloni == orders.total_paid_cents`;
- imposto Moloni compatível com `orders.tax_amount_cents`;
- líquido mais imposto igual ao total dentro da política explícita de arredondamento;
- moeda igual;
- desconto igual ao snapshot do pedido.

Se houver divergência:

- não fechar documento;
- marcar `blocked_data` ou `failed_permanent`;
- exibir diferença no admin;
- exigir correção do mapeamento/regra.

### 13.4 Fechamento

Durante homologação:

- usar documento em rascunho (`status = 0`) ou ambiente/empresa de teste aprovado;
- nunca comunicar documentos de teste à Autoridade Tributária.

Em produção, somente após aceite:

- usar `status = 1` se essa for a decisão da seção 6;
- registrar identificador e número retornados;
- confirmar por leitura do documento;
- persistir `issued_at`;
- marcar job como `completed`.

---

## 14. Idempotência e recuperação de resposta perdida

A API Moloni não deve ser presumida como idempotente.

Usar:

- `idempotency_key = moloni:{environment}:{order_id}:{document_kind}:{version}`;
- unique index local;
- `your_reference` determinística na Moloni;
- `payload_hash`;
- claim atômico do job;
- busca na Moloni antes de inserir em toda retentativa após resultado incerto.

Cenário obrigatório de teste:

1. a Moloni cria o documento;
2. a conexão cai antes da plataforma receber a resposta;
3. o job é retomado;
4. a plataforma encontra o documento pela referência;
5. salva o identificador existente;
6. não cria duplicidade.

---

## 15. Retentativas

Erros retryable:

- timeout;
- falha de DNS/conexão;
- HTTP `429`;
- HTTP `5xx`;
- token expirado renovável;
- indisponibilidade temporária.

Erros permanentes ou bloqueantes:

- NIF inválido;
- cliente fiscal divergente;
- série inexistente;
- artigo/taxa sem mapeamento;
- total divergente;
- regra de isenção ausente;
- refresh token inválido que exige reconexão;
- erro funcional rejeitado pela Moloni.

Backoff sugerido, sujeito ao mecanismo de cron:

- 1 minuto;
- 5 minutos;
- 15 minutos;
- 1 hora;
- 6 horas;
- revisão administrativa após o limite.

Retentativa manual deve:

- exigir admin;
- não permitir emissão duplicada;
- registrar `audit_logs`;
- informar resultado claro.

---

## 16. Reembolsos, estornos e disputas

### 16.1 Regra geral

Documento fechado não deve ser apagado nem alterado.

Quando a Stripe confirmar reembolso:

1. manter o tratamento comercial e de acesso já existente;
2. calcular o delta reembolsado;
3. criar tarefa fiscal idempotente;
4. emitir o documento retificativo aprovado;
5. associar ao documento original;
6. armazenar valores e referências;
7. reconciliar estado.

### 16.2 Reembolso parcial

O código atual diferencia reembolso integral para revogação de acesso, mas a integração fiscal deve observar também reembolsos parciais.

Criar idempotência por:

- `stripe_refund_id`, quando disponível;
- documento original;
- valor acumulado já creditado.

Nunca emitir crédito duas vezes para o mesmo valor/evento.

### 16.3 Disputa/chargeback

Não emitir automaticamente nota de crédito apenas pela abertura da disputa sem regra contábil aprovada.

Registrar evento e:

- manter estado `requires_review`; ou
- executar o fluxo aprovado pela contabilista para perda definitiva/recuperação.

---

## 17. Edge Functions previstas

### 17.1 Alterações

`create-checkout`

- criar snapshot fiscal inicial;
- validar NIF com checksum;
- preservar comportamento de checkout;
- revisar `tax_id_collection` para não confundir NIF pessoal com VAT empresarial;
- revisar `invoice_creation` Stripe conforme seção 20.

`payment-webhook`

- ampliar tipo de `customer_details`;
- completar snapshot fiscal;
- garantir outbox fiscal idempotente;
- não chamar a Moloni diretamente;
- enfileirar ajuste fiscal em reembolso;
- manter toda validação e todos os grants atuais.

`cron-reconcile-orders`

- detectar pedido pago sem registro fiscal/outbox;
- criar tarefa ausente sem duplicidade;
- não tentar mascarar erros fiscais permanentes.

### 17.2 Novas

- `admin-moloni-oauth-start`;
- `moloni-oauth-callback`;
- `admin-moloni-disconnect`;
- `cron-process-moloni-documents`;
- `admin-retry-moloni-document`;
- `admin-update-moloni-mapping`;
- `get-order-fiscal-document`;
- função interna/RPC para claim atômico de jobs.

Cada função deve ter:

- responsabilidade única;
- autenticação compatível com o tipo;
- validação de schema;
- retorno JSON consistente;
- `request_id`;
- logs sanitizados;
- auditoria quando administrativa;
- idempotência.

---

## 18. Disparo da fila fiscal

Não depender exclusivamente de um trecho específico do webhook.

Implementar uma garantia de outbox que cubra toda transição válida para `paid`, inclusive:

- webhook Stripe;
- reconciliação Stripe;
- recuperação operacional autorizada.

Opções aceitáveis:

1. RPC transacional que atualiza o pedido, completa o snapshot e cria a outbox; ou
2. trigger seguro na transição para `paid`, acompanhado de processador que aguarda/valida o snapshot.

Escolher uma opção e documentar a decisão na migration/código. O resultado obrigatório é: todo `order` pago precisa ter exatamente um documento fiscal principal planejado ou uma justificativa operacional explícita.

---

## 19. Admin

Adicionar seção Moloni ao painel de pagamentos ou integrações.

### 19.1 Estado da integração

Mostrar:

- desconectada;
- conectada;
- token próximo da expiração;
- reconexão necessária;
- empresa Moloni;
- última comunicação bem-sucedida;
- fila pendente;
- falhas que exigem ação.

Nunca mostrar tokens.

### 19.2 Configuração

Permitir a admin:

- conectar/reconectar Moloni;
- selecionar empresa, série, artigo, taxa e método conforme endpoints reais;
- mapear cada produto;
- validar configuração;
- criar documento de teste em rascunho;
- ativar emissão automática somente após checklist;
- desativar novas emissões sem apagar histórico.

### 19.3 Pedidos

Em cada pedido, mostrar:

- status Stripe;
- status fiscal;
- tipo e número do documento;
- data de emissão;
- total;
- erro atual;
- tentativas;
- ação “Reprocessar” quando segura;
- link ao documento;
- documentos retificativos.

Toda alteração de configuração e retentativa manual deve ser auditada.

---

## 20. Área do aluno e Invoice Stripe

Após emissão:

- exibir “Documento fiscal” no pedido;
- mostrar tipo, número e data;
- permitir acesso seguro ao PDF;
- validar no backend que o pedido pertence ao usuário;
- não expor token Moloni nem URL administrativa.

Revisar o uso atual de `stripe_invoice_id`:

- Invoice/receipt Stripe deve ser rotulada como comprovativo de pagamento, se mantida;
- documento Moloni deve ser a fatura/documento fiscal oficial apresentado;
- evitar dois botões ou documentos com o mesmo rótulo “Fatura”;
- avaliar a desativação de `invoice_creation[enabled]` na Stripe após a entrada da Moloni;
- manter `automatic_tax` apenas se a estratégia fiscal e os totais Moloni forem compatíveis.

A decisão não deve apagar referências Stripe históricas.

---

## 21. Entrega segura do PDF

Opções, em ordem de preferência:

1. backend busca o PDF Moloni, armazena cópia em storage privado e devolve URL assinada temporária;
2. backend obtém link atual pela Moloni e o devolve somente após autorização, se a segurança/validade do link for confirmada.

Não:

- salvar PDF fiscal em bucket público;
- persistir URL permanente aberta;
- permitir consulta por `document_id` sem validar o dono do pedido;
- expor credenciais Moloni no cliente.

---

## 22. Reconciliação

Criar rotina periódica para:

- pedido `paid` sem `fiscal_documents`;
- documento `pending` sem job;
- job `processing` com lock expirado;
- emissão local `processing` que já existe na Moloni;
- documento `issued` com total divergente;
- pedido `refunded` sem documento retificativo esperado;
- falha de token/conexão;
- documento Moloni não encontrado;
- duplicidade por referência.

Resultados devem alimentar:

- `job_runs`;
- logs técnicos;
- métricas do admin;
- `audit_logs` quando houver ação manual.

A reconciliação fiscal não substitui a reconciliação Stripe existente.

---

## 23. Observabilidade

Registrar, sem dados sensíveis:

- `request_id`;
- `order_id`;
- `fiscal_document_id`;
- `job_id`;
- tipo de documento;
- ambiente;
- endpoint Moloni chamado;
- duração;
- HTTP status;
- código de erro normalizado;
- número da tentativa;
- resultado.

Métricas mínimas:

- documentos emitidos;
- tempo entre pagamento e emissão;
- jobs pendentes;
- jobs bloqueados;
- falhas por categoria;
- reconexão OAuth necessária;
- divergências monetárias;
- reembolsos sem ajuste fiscal.

Alertar admin quando:

- conexão expirar;
- houver falha permanente;
- pedido pago permanecer sem documento acima do SLA;
- houver divergência de total;
- houver fila acumulada.

---

## 24. Configuração por ambiente

Separar totalmente:

- Stripe test;
- Stripe live;
- configuração Moloni de homologação/rascunho;
- configuração Moloni de produção.

Regras:

- venda Stripe test nunca pode emitir documento fiscal Moloni live;
- `payment_environment` deve participar da decisão;
- emissão live exige configuração explicitamente ativa;
- callback OAuth deve usar domínio canônico correto;
- deploy preview não deve emitir documentos live;
- configuração e tokens não podem ser copiados entre ambientes sem validação.

---

## 25. Segurança

- chamadas Moloni apenas no backend;
- `service_role` apenas em Edge Functions;
- OAuth `state` imprevisível, expirável e de uso único;
- tokens cifrados e não logados;
- callback com allowlist de redirect;
- funções admin validam `profiles.is_admin` ou `role = admin`, além do status ativo;
- cron protegido por segredo técnico;
- rate limit em ações admin;
- validação de payload e resposta externa;
- timeouts obrigatórios;
- nenhum segredo em migrations, frontend ou arquivos versionados;
- RLS em todas as novas tabelas públicas;
- grants e liberação de acesso independentes da Moloni.

---

## 26. Ordem de implementação

### Fase 0 — Decisões e preparação

- fechar checklist fiscal da seção 6;
- criar/validar Developer ID e callback Moloni;
- confirmar empresa e ambiente;
- definir série, artigo, imposto e método de pagamento Stripe na Moloni;
- confirmar comportamento do PDF e e-mail.

### Fase 1 — Banco e RLS

- migrations das tabelas;
- constraints, índices e triggers;
- policies;
- RPC/claim da fila;
- testes SQL.

### Fase 2 — Cliente Moloni e OAuth

- `_shared/moloni.ts`;
- armazenamento seguro de tokens;
- conexão/reconexão;
- status administrativo;
- testes de refresh e concorrência.

### Fase 3 — Captura fiscal

- snapshot no checkout;
- captura de `customer_details`;
- validações;
- tela de checkout ajustada, se necessário;
- testes com e sem NIF.

### Fase 4 — Emissão assíncrona

- criação da outbox;
- processador;
- cliente Moloni;
- resolução de cliente;
- emissão em rascunho;
- idempotência e resposta perdida.

### Fase 5 — Admin e aluno

- configuração/mapeamento;
- status e retentativa;
- documento no pedido;
- acesso seguro ao PDF;
- rótulos Stripe/Moloni revisados.

### Fase 6 — Reembolsos

- eventos;
- crédito/retorno conforme decisão fiscal;
- parcial e integral;
- reconciliação.

### Fase 7 — Homologação e produção

- testes controlados;
- aceite da contabilista;
- ativação live;
- deploy seguro;
- verificação de primeira venda;
- monitoramento reforçado.

---

## 27. Testes obrigatórios

### 27.1 Unitários

- validação de NIF;
- normalização de snapshot;
- cálculo líquido/imposto/total;
- geração de chave idempotente;
- classificação de erros Moloni;
- refresh OAuth;
- montagem de payload;
- tratamento de moeda e arredondamento.

### 27.2 Banco/RLS

- aluno lê somente os próprios documentos;
- aluno não escreve snapshot/documento/job;
- admin lê conforme política;
- cliente anônimo não acessa;
- unicidade impede duplicidade;
- claim concorrente entrega job a um único worker;
- trigger/RPC cria outbox em toda transição válida para `paid`.

### 27.3 Integração

- cliente Moloni existente por NIF;
- cliente inexistente;
- NIF divergente;
- token expirado e renovado;
- refresh inválido;
- `429`;
- `5xx`;
- timeout;
- documento em rascunho;
- consulta por referência;
- PDF.

### 27.4 Fluxo Stripe

- pagamento imediato;
- pagamento assíncrono;
- webhook repetido;
- eventos fora de ordem;
- sessão expirada;
- Stripe test não emite Moloni live;
- reconciliação cria job ausente.

### 27.5 Idempotência

- dois webhooks simultâneos;
- dois workers simultâneos;
- resposta perdida após emissão;
- retentativa manual durante retry automático;
- reembolso duplicado;
- parcial seguido de integral.

### 27.6 E2E

- compra sem NIF conforme regra aprovada;
- compra com NIF;
- compra empresarial, se suportada;
- documento visível no admin;
- documento visível para o aluno correto;
- outro aluno recebe acesso negado;
- reembolso e documento retificativo;
- logs/auditoria sem tokens ou dados fiscais excessivos.

---

## 28. Estratégia de homologação

1. testar cliente Moloni com mocks;
2. testar OAuth real sem emissão;
3. criar cliente de homologação controlado;
4. emitir somente rascunho;
5. comparar valores com Stripe;
6. validar documento com a contabilista;
7. testar recuperação de falhas;
8. testar reembolso;
9. ativar produção por feature flag/configuração;
10. acompanhar manualmente as primeiras vendas.

Se a Moloni não disponibilizar sandbox fiscal equivalente, usar exclusivamente a estratégia de rascunho/empresa/série aprovada pela contabilista e pela própria Moloni.

---

## 29. Critérios de aceite

A implementação estará concluída quando:

- [ ] toda venda Stripe live confirmada gerar exatamente um planejamento fiscal;
- [ ] emissão Moloni não bloquear pagamento nem grant;
- [ ] documento não for duplicado por replay, concorrência ou resposta perdida;
- [ ] dados fiscais usados forem snapshots do pedido;
- [ ] total Moloni for igual ao total efetivamente pago;
- [ ] comprador correto puder acessar o documento;
- [ ] admin puder identificar e reprocessar falhas seguras;
- [ ] produto sem mapeamento não emitir documento incorreto;
- [ ] reembolso gerar fluxo fiscal aprovado;
- [ ] Stripe test nunca atingir emissão Moloni live;
- [ ] tokens não aparecerem em logs, frontend ou banco público;
- [ ] RLS e funções administrativas estiverem testadas;
- [ ] reconciliação detectar pedido pago sem documento;
- [ ] contabilista aprovar tipo, série, imposto e documento de teste;
- [ ] produção estiver `READY` e apontando para o commit correto;
- [ ] versão exibida no admin corresponder ao deploy.

---

## 30. Fora de escopo inicial

- substituir a Stripe como gateway;
- deixar a Moloni confirmar o pagamento;
- liberar acesso com base no documento Moloni;
- sincronização contábil genérica bidirecional de todos os dados Moloni;
- estoque físico;
- múltiplas empresas Moloni sem requisito aprovado;
- importação de documentos antigos, salvo tarefa separada;
- alteração automática de documentos já fechados;
- suporte a moedas/regras fiscais não validadas.

---

## 31. Referências oficiais externas

Moloni:

- visão geral: <https://www.moloni.pt/dev/visao-geral/>
- autenticação OAuth: <https://www.moloni.pt/dev/index.php?action=getApiTxtDetail&id=3>
- utilização e renovação de tokens: <https://www.moloni.pt/dev/utilizacao/>
- endpoints: <https://www.moloni.pt/dev/endpoints/>
- clientes: <https://www.moloni.pt/dev/entities/customers>
- faturas: <https://www.moloni.pt/dev/documents/invoices/>
- faturas-recibo: <https://www.moloni.pt/dev/documents/invoice-receipts/>
- inserir fatura-recibo: <https://www.moloni.pt/dev/documents/invoice-receipts/insert/>
- documentos/PDF: <https://www.moloni.pt/dev/documents/documents>

Stripe:

- fulfillment do Checkout: <https://docs.stripe.com/checkout/fulfillment>
- webhooks, retries e ordenação: <https://docs.stripe.com/webhooks>
- assinatura de webhooks: <https://docs.stripe.com/webhooks/signature>
- coleta de endereço/impostos: <https://docs.stripe.com/payments/checkout/taxes>
- coleta de Tax ID: <https://docs.stripe.com/payments/advanced/tax>

---

## 32. Instrução de execução para o Codex

Ao implementar esta especificação, o Codex deve:

1. reler os documentos da seção 2;
2. confirmar as respostas da seção 6;
3. consultar `.env.local` sem expor segredos;
4. confirmar repositório, Supabase `project_id`, URL e ambiente antes de acesso externo;
5. inspecionar migrations e Edge Functions existentes antes de editar;
6. implementar por fases pequenas;
7. não quebrar o fluxo Stripe/grants atual;
8. criar toda mudança estrutural por migration;
9. validar localmente e em ambiente controlado;
10. não emitir documento fiscal live durante testes;
11. atualizar a versão exibida no admin;
12. commitar e fazer push;
13. fazer deploy na ordem backend, banco e frontend;
14. confirmar produção `READY`, domínio canônico e SHA do deploy;
15. informar no fechamento:
    - docs usados;
    - arquivos alterados;
    - migrations aplicadas;
    - funções publicadas;
    - testes realizados;
    - primeira emissão/reconciliação validada;
    - pendências reais;
    - etiqueta completa `VERSAO-DEPLOY-COMMIT`.

# SPEC — Integração Brevo

## Estado

Implementação versionada na migration `0063_brevo_integration.sql`. A Brevo é o transporte oficial para e-mails da plataforma depois de a configuração ser ativada no admin.

## Arquitetura

- Frontend: `/admin/integracoes/brevo`, sem acesso a segredos; chama apenas `admin-brevo`.
- Edge Functions: `admin-brevo`, `cron-process-brevo-contact-syncs` e `auth-send-email-brevo`.
- Fila existente: `email_deliveries` continua sendo a fila de e-mails transacionais e passa a enviar pela API `POST /v3/smtp/email`.
- Fila nova: `brevo_contact_syncs` registra somente consentimentos explícitos e permite retry sem acoplar o checkout ao serviço externo.
- Reconciliação: `admin-brevo` consulta `/v3/smtp/statistics/events` e persiste eventos idempotentes em `brevo_email_events`.

## Credenciais e configuração

`private.brevo_credentials.api_key_ciphertext` usa AES-GCM com chave derivada do secret `BREVO_TOKEN_ENCRYPTION_KEY`. A API key nunca é retornada ao frontend nem registrada em logs. O admin recebe apenas `configured`, `source`, `encryption_key_configured` e `configured_at`.

Configuração operacional em `brevo_integration_settings`: ativo, remetente, reply-to, lista de leads, Consent Group opcional e mapeamento de atributos. A chave pode ser fornecida temporariamente por `BREVO_API_KEY` durante migração, mas a configuração administrativa deve gravá-la cifrada.

## E-mails

`email_deliveries` preserva assunto, HTML, texto, categoria, origem e `provider_message_id`. O processador usa apenas Brevo quando a integração existe; SMTP, Resend, Postmark e SendGrid não são fallback silencioso. O `messageId` retornado pelo endpoint é persistido. Falhas ficam como `failed` e o retry existente reencaminha a fila.

O teste administrativo envia pela mesma API e cria um registro em `email_deliveries`.

## Supabase Auth Hook

`auth-send-email-brevo` valida o corpo com `standardwebhooks` e `SEND_EMAIL_HOOK_SECRET`. Cobre signup, recovery, invite, magiclink, reauthentication e email change. Para alteração segura de e-mail:

- e-mail atual: `token` + `token_hash_new`;
- e-mail novo: `token_new` + `token_hash`.

O hook grava cada envio em `email_deliveries` com origem `supabase_auth_hook` e retorna erro não-sensível quando Brevo falha.

## Consentimento e contatos

O checkbox de novidades é a única origem de opt-in. Sem checkbox, nenhum contato é criado/enfileirado. Com checkbox:

1. `profiles.content_updates_consent` é preservado como verdadeiro;
2. data, origem e evidência são salvas em `profiles`;
3. `brevo_contact_syncs` recebe uma linha idempotente por usuário/e-mail;
4. o cron executa `POST /v3/contacts` com `updateEnabled: true`, `emailBlacklisted: false`, lista configurada e atributos existentes;
5. quando Consent Groups está habilitado e configurado, é feita a importação documentada com `consentGroupIds`;
6. falhas ficam pendentes/failed para retentativa.

O fluxo pago, o fluxo gratuito (`create-checkout`) e o endpoint legado `claim-free-product` cobrem consentimento. A falha Brevo nunca faz rollback do pedido, grant ou checkout.

## Admin

O endpoint `admin-brevo` exige sessão ativa e perfil com `role=admin` e `is_admin=true`. Disponibiliza credencial, configurações, `GET /account`, listas, atributos, Consent Groups, teste, histórico, contatos, retry individual e retry em lote. Toda alteração sensível gera `audit_logs`.

## Histórico e idempotência

Eventos remotos são reconciliados por `event_key`. `messageId` atualiza o registro local correspondente para `sent`, `delivered`, `bounced` ou `failed`, conservando o motivo. Envios usam `delivery_id` como chave de idempotência no request e tag operacional.

## Segurança

- tabelas privadas e políticas administrativas com RLS;
- credencial apenas em schema `private` e RPC service-role;
- validação backend de admin;
- logs sanitizados;
- sem senha, token de autenticação, cartão ou segredo nos atributos Brevo;
- Auth Hook sem `verify_jwt`, protegido por Standard Webhooks;
- checkout/grants continuam governados pelo backend e `access_grants`.

## Operação e rollback

Para ativar: aplicar migration, configurar `BREVO_TOKEN_ENCRYPTION_KEY`, publicar as três funções, configurar `SEND_EMAIL_HOOK_SECRET` e o Send Email Hook, guardar a API key/remetente/lista no admin, validar conta e enviar teste.

Para rollback: desativar a integração no admin e remover o Auth Hook no Supabase. A fila permanece preservada para inspeção; não se deve reativar transportes legados como fallback sem decisão operacional explícita. A migration é aditiva e pode ser mantida durante rollback.

## Testes e limitações reais

Há testes locais de build/lint e cobertura de fluxo de consentimento já existente. O teste real da API, o Consent Group e o Auth Hook dependem dos secrets e da configuração da conta Brevo/Supabase. A API de Consent Groups atual documenta associação via `POST /contacts/import`; se a conta responder `CONSENT_GROUP_NOT_ENABLED`, a interface informa a limitação e sincroniza o contato/lista normalmente.

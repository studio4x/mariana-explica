# ESPECIFICAÇÕES - SISTEMA DE NOTIFICAÇÕES MULTI-CANAL

## Visão Geral

Sistema de **Notificações** implementa entrega multi-canal (Push, Email, WhatsApp, In-app) com fila persistida, retry automático, cron scheduler e auditoria completa. Essencial em qualquer plataforma que necessite comunicação assíncrona com usuários.

---

## 1. ARQUITETURA

### Canais Disponíveis

| Canal | Tipo | Delay | Retry | Exemplo |
|-------|------|-------|-------|---------|
| **In-app** | Real-time | Imediato | Não | Widget toast |
| **Push** | Browser/Mobile | Imediato | Sim (3x) | Desktop + app |
| **Email** | Assíncrono | 1-5 min | Sim (5x) | Caixa de entrada |
| **WhatsApp** | Assíncrono | 1-2 min | Sim (5x) | Celular |

### Eventos que Geram Notificação

```
- Nova mensagem recebida
- Perfil visualizado
- Resposta a contato recebida
- Plano expirar em 7 dias
- Cobrança falhou
- Ticket respondido
- Certificado emitido
- Novo cupom disponível
- Alerta de crise SLA
```

---

## 2. TABELAS DE BANCO DE DADOS

### `notifications`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id)
title VARCHAR (200)
body TEXT
action_url TEXT -- /dashboard/mensagens/:id

-- Categorização
category VARCHAR -- 'payment', 'message', 'system', 'course', etc
priority ENUM: 'low'|'normal'|'high'|'urgent'
is_actionable BOOLEAN DEFAULT true

-- Status
read_at TIMESTAMP
read_by_channels JSONB -- ["push", "email"] = quais canais foram vistos

created_at TIMESTAMP
```

### `notification_queue`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id)
channel ENUM: 'push'|'email'|'whatsapp'|'in-app'
title VARCHAR
body TEXT
payload JSONB -- Dados específicos do canal

-- Status
status ENUM: 'pending'|'sent'|'delivered'|'failed'|'bounced'
attempt_count INTEGER DEFAULT 0
last_attempt_at TIMESTAMP
next_retry_at TIMESTAMP
final_error TEXT

-- Metadata
provider_message_id TEXT -- ID externo (AWS, Firebase, Twilio)

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `notification_delivery_logs`

```sql
id UUID PRIMARY KEY
queue_id UUID (FK notification_queue.id)
channel ENUM
attempt_number INTEGER
status ENUM: 'success'|'failure'
error_message TEXT
response_status_code INTEGER
retry_attempt INT
delivered_at TIMESTAMP

created_at TIMESTAMP
```

### `notification_preferences`

```sql
user_id UUID PRIMARY KEY (FK profiles.id)

-- Por categoria
push_enabled BOOLEAN DEFAULT true
email_enabled BOOLEAN DEFAULT true
whatsapp_enabled BOOLEAN DEFAULT true
in_app_enabled BOOLEAN DEFAULT true

-- Quiet hours
quiet_hours_enabled BOOLEAN DEFAULT false
quiet_hours_start TIME -- "22:00"
quiet_hours_end TIME -- "08:00"
quiet_hours_timezone VARCHAR -- "America/Sao_Paulo"

-- Frequency
email_digest ENUM: 'immediate'|'daily'|'weekly'|'never'

created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 3. COMPONENTES

### NotificationCenter (Dashboard)

**Localização**: `src/components/NotificationCenter.tsx`

```
┌──────────────────────────────────┐
│ 🔔 Notificações (3 novas)        │
├──────────────────────────────────┤
│ [Ler Todos]                      │
├──────────────────────────────────┤
│ ✓ João Silva viu seu perfil      │
│   há 5 minutos                   │
│                                  │
│ ○ Nova mensagem de Empresa XYZ  │
│   há 15 minutos                  │
│                                  │
│ ○ Seu plano expira em 7 dias    │
│   há 1 hora                      │
├──────────────────────────────────┤
│ [Ver todas]                      │
└──────────────────────────────────┘
```

**Features**:
- ✅ Badge com unread count
- ✅ Lista com filtro (todas, não-lidas, por tipo)
- ✅ Marcar como lida / deletar
- ✅ Timestamp relativo
- ✅ Click abre action (redireciona)

### NotificationBell

```typescript
<NotificationBell
  unreadCount={3}
  onClick={openCenter}
/>
```

**Exibe**:
```
🔔(3) ← Badge numerado
```

### InAppNotification (Toast)

```typescript
toast.notify({
  title: "Nova mensagem",
  body: "João Silva enviou uma mensagem",
  type: "info",
  duration: 5000,
  action: "/dashboard/mensagens/123"
})
```

**Exibe**:
```
[ℹ] Nova mensagem
    João Silva enviou uma mensagem
    [Abrir]
```

---

## 4. FLUXO DE NOTIFICAÇÃO

### Trigger → Delivery

```
1. Um evento ocorre
   (ex: nova mensagem)
   ↓
2. Edge function ou trigger detecta
   ↓
3. INSERT em notifications (in-app)
   ↓
4. INSERT em notification_queue (todos canais)
   ↓
5. Realtime broadcast (se online)
   ↓
6. Cron job pick up pending (a cada 1 min)
   ↓
7. Para cada message_queue:
   - Check userPreferences.enabled?
   - Check quiet hours?
   - Enviar via provider
   ↓
8. UPDATE status + log
   ↓
9. Se falhar: schedule retry (exponential backoff)
```

### Exponential Backoff

```
Attempt 1: Imediato
Attempt 2: +5 minutos
Attempt 3: +15 minutos
Attempt 4: +60 minutos
Attempt 5: +4 horas

Max 5 tentativas depois: mark FAILED
```

---

## 5. EDGE FUNCTIONS

### `send-notification`
```
POST /functions/v1/send-notification
Auth: Bearer token (admin/system)
Body: {
  user_id: UUID,
  title: string,
  body: string,
  category: string,
  priority: 'normal'|'high'|'urgent',
  channels: ['push', 'email', 'in-app']
}
Response: { notification_id, queued_count }
```

### `process-notification-queue`
```
POST /functions/v1/process-notification-queue
Auth: Service role (cron trigger)
Body: {}
Response: { processed: N, sent: N, failed: N, retrying: N }
```

### `get-notifications`
```
GET /functions/v1/get-notifications?limit=20&unread_only=false
Auth: Bearer token
Response: { notifications[], total, unread_count }
```

### `mark-notification-read`
```
POST /functions/v1/mark-notification-read
Auth: Bearer token
Body: { notification_id | channel }
Response: { success }
```

---

## 6. CRON JOB - PROCESSAMENTO

### Schedule

```
Frequency: Cada 1 minuto
Função: process-notification-queue

1. SELECT * FROM notification_queue
   WHERE status IN ('pending', 'retry')
   AND next_retry_at <= NOW()
   LIMIT 1000
   
2. Para cada message:
   a. Check user preferences
   b. Check quiet hours
   c. Send via provider
   d. Log result
   e. Update status
   f. Set next_retry_at se failure
```

---

## 7. CANAIS

### Push Notifications

**Provider**: Firebase Cloud Messaging (FCM) ou Expo

```typescript
const pushPayload = {
  notification: {
    title: "Nova mensagem",
    body: "João Silva enviou uma mensagem"
  },
  data: {
    action_url: "/dashboard/mensagens/123",
    notification_id: uuid
  },
  webpush: {
    fcmOptions: {
      link: "/dashboard/mensagens/123"
    }
  }
};

await admin.messaging().send({
  token: userDeviceToken,
  ...pushPayload
});
```

### Email

**Provider**: SendGrid, AWS SES, Mailgun

```typescript
const emailPayload = {
  to: user.email,
  from: 'noreply@homecarematch.com.br',
  subject: 'Nova mensagem de João Silva',
  html: emailTemplate(title, body),
  trackingSettings: {
    clickTracking: { enable: true },
    openTracking: { enable: true }
  }
};

await sendgridClient.send(emailPayload);
```

### WhatsApp

**Provider**: Twilio, Zenvia, Chatwoot

```typescript
const whatsappPayload = {
  to: `+55${userPhone}`,
  from: 'homecarebot',
  body: `${title}\n\n${body}\n\n${actionUrl}`,
  mediaUrl: null
};

await twilioClient.messages.create(whatsappPayload);
```

### In-App (Realtime)

```typescript
// Broadcast via Supabase Realtime
supabase.channel('user-notifications')
  .send({
    type: 'broadcast',
    event: 'notification',
    payload: {
      id: notificationId,
      title,
      body,
      action_url
    }
  });
```

---

## 8. PREFERÊNCIAS DE USUÁRIO

### Settings Page

**Localização**: `/dashboard/settings/notificacoes`

```
┌─────────────────────────────────┐
│ Notificações                    │
├─────────────────────────────────┤
│ ☑ Push notifications            │
│ ☑ Email                         │
│ ☑ WhatsApp                      │
│ ☑ In-app (widget)               │
├─────────────────────────────────┤
│ 🔇 Horas silenciosas            │
│ ☑ Ativar                        │
│ De 22:00 às 08:00               │
│ Fuso: São Paulo                 │
├─────────────────────────────────┤
│ 📧 Frequência de Email          │
│ ○ Imediato (cada evento)        │
│ ○ Diário (resumo)               │
│ ○ Semanal (resumo)              │
│ ● Nunca (desativar)             │
├─────────────────────────────────┤
│ [Salvar Preferências]           │
└─────────────────────────────────┘
```

---

## 9. ADMIN DASHBOARD

### `/admin/notificacoes` - Notifications Hub

**Features**:

#### 1. Send Broadcast

```
[Enviar notificação em massa]
Título: __________
Mensagem: __________
Filtro: ○ Todos ○ Por perfil ○ Por plan ○ Por tag
Canais: ☑ Push ☑ Email ☑ WhatsApp
[Agendar] [Enviar Agora]
```

#### 2. Queue Monitor

```
Pending: 342
Sent: 15,234
Failed: 23
  Retrying: 8

Fila por canal:
  Push: 120 pending
  Email: 180 pending
  WhatsApp: 42 pending
```

#### 3. Analytics

```
Notificações enviadas (7 dias):
  Total: 25.342
  Push: 67%
  Email: 28%
  WhatsApp: 5%

Taxa de entrega:
  Push: 99%
  Email: 96%
  WhatsApp: 92%

Engagement:
  Aberturas: 45%
  Cliques: 28%
```

#### 4. Failed Messages

```
Message | User | Channel | Error | Retry
────────────────────────────────────────
"..." | João | WhatsApp | Invalid phone | +1
```

---

## 10. EMAIL TEMPLATES

### Template Base

```html
<html>
<head>
  <style>
    /* Responsive + dark mode support */
  </style>
</head>
<body style="background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    <!-- Header -->
    <div style="background: #0066cc; color: white; padding: 20px; text-align: center;">
      <h1>{{ title }}</h1>
    </div>
    
    <!-- Body -->
    <div style="padding: 30px;">
      <p>Olá {{ firstName }},</p>
      
      <p>{{ bodyText }}</p>
      
      {{ if actionUrl }}
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ actionUrl }}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          {{ actionText }}
        </a>
      </div>
      {{ endif }}
    </div>
    
    <!-- Footer -->
    <div style="background: #f5f5f5; color: #666; font-size: 12px; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
      <p>HomeCare Match | <a href="/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
```

---

## 11. SEGURANÇA & COMPLIANCE

### Privacy

```
- Não enviar passwords em notificações
- Não expor dados sensíveis em preview
- Respeitar unsubscribe links
```

### Rate Limiting

```
- Max 10 notificações por usuário / por dia
- Max 5 push / por hora
- Alert se abuse pattern detectado
```

### GDPR

```
- Unsubscribe link em email
- Audit trail de todas as notificações
- Direito de deletar histórico
```

---

## 12. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas: notifications, notification_queue, delivery_logs
- [x] NotificationCenter component
- [x] NotificationCenter page
- [x] Preferences settings
- [x] Edge functions (send, process queue, get, mark-read)
- [x] Cron job para processar fila
- [x] Push integration (FCM)
- [x] Email integration (SendGrid)
- [x] WhatsApp integration (Twilio)
- [x] In-app Realtime
- [x] Admin dashboard
- [x] Error handling + retries
- [x] Quiet hours logic
- [x] Audit logging

---

## 13. ROADMAP

- [ ] SMS notifications
- [ ] Telegram integration
- [ ] Slack integration (para admin)
- [ ] Notification scheduling (agendar futuro)
- [ ] A/B testing de notificações
- [ ] ML-powered best send times
- [ ] Do-not-disturb modes

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção

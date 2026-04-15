# ESPECIFICAÇÕES - MENSAGENS EM TEMPO REAL

## Visão Geral

Sistema de **Mensagens em Tempo Real** implementa comunicação bidirecional entre profissionais e clientes (empresas/famílias) com suporte a Realtime Supabase, histórico persistido e notificações integradas. Reutilizável em marketplaces, plataformas de serviços e SaaS com comunicação direct.

---

## 1. ARQUITETURA

### Tipos de Conversa

| Tipo | Participantes | Uso |
|------|--------------|-----|
| **Direct Message** | 2 usuários | Negociação, contato direto |
| **Support Ticket** | N (user + support team) | Suporte técnico |
| **Group** | 3+ usuários | Futuro: team collaboration |

---

## 2. TABELAS DE BANCO DE DADOS

### `conversations`

```sql
id UUID PRIMARY KEY
conversation_type ENUM: 'direct'|'support'|'group'
title VARCHAR -- Para group/support, ex: "Ticket #123"
created_by UUID (FK profiles.id)

-- Metadata
last_message_at TIMESTAMP
last_message_preview TEXT (50 chars)
message_count INTEGER DEFAULT 0

-- Status
is_archived BOOLEAN DEFAULT false
archived_at TIMESTAMP

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `conversation_participants`

```sql
id UUID PRIMARY KEY
conversation_id UUID (FK conversations.id) ON DELETE CASCADE
user_id UUID (FK profiles.id) ON DELETE CASCADE
role ENUM: 'participant'|'admin'|'observer'

-- Tracking
joined_at TIMESTAMP
last_read_at TIMESTAMP
unread_count INTEGER DEFAULT 0

created_at TIMESTAMP

UNIQUE(conversation_id, user_id)
```

### `messages`

```sql
id UUID PRIMARY KEY
conversation_id UUID (FK conversations.id) ON DELETE CASCADE
sender_id UUID (FK profiles.id)
content TEXT (5000 chars)
message_type ENUM: 'text'|'file'|'system'|'notification'

-- Metadata
edited_at TIMESTAMP
edited_by UUID (FK profiles.id, se editado)
edited_reason VARCHAR

-- Attachments
attachments JSONB -- [{ file_id, type, name, size_bytes, url }]

-- Status
is_deleted BOOLEAN DEFAULT false
deleted_at TIMESTAMP
deleted_by UUID

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `message_read_status`

```sql
id UUID PRIMARY KEY
message_id UUID (FK messages.id) ON DELETE CASCADE
user_id UUID (FK profiles.id)
read_at TIMESTAMP

created_at TIMESTAMP
UNIQUE(message_id, user_id)
```

### `message_reactions`

```sql
id UUID PRIMARY KEY
message_id UUID (FK messages.id) ON DELETE CASCADE
user_id UUID (FK profiles.id)
reaction_type VARCHAR -- "👍", "❤️", etc

created_at TIMESTAMP
UNIQUE(message_id, user_id, reaction_type)
```

---

## 3. COMPONENTES FRONTEND

### ChatWindow (Direct Message)

**Localização**: `src/components/ChatWindow.tsx` (novo)

```typescript
<ChatWindow
  conversationId={id}
  recipientId={otherUserId}
  onClose={handleClose}
/>
```

**Componentes Internos**:

#### Header
- Avatar + nome do outro user
- Status (online, offline, "digitando...")
- Menu (bloquear, reportar, etc)

#### Messages Area
```
[João] 14:30
Olá, tudo bem?

[Você] 14:31
Tudo! Como posso ajudar?

[João] 14:35
Digitando... ⏳
```

**Features**:
- ✅ Auto-scroll para mensagem nova
- ✅ "Digitando..." indicator
- ✅ Read receipts (✓✓ azul = lido)
- ✅ Timestamps
- ✅ Editar / deletar mensagem (próprias)
- ✅ Reações com emoji
- ✅ @ mentions
- ✅ Links preview

#### Input Box
```
[____________ Digite...] [Emoji] [Anexar] [Enviar]
```

**Features**:
- ✅ Sugerir emoji
- ✅ Attach files (images, docs)
- ✅ Auto-save draft (localStorage)
- ✅ Character counter (0/5000)

### MessageList

```typescript
<MessageList
  messages={messages}
  isLoading={loading}
  onLoadOlder={loadPrevious}
  currentUserId={userId}
/>
```

**Infinite Scroll**:
- Carrega antigas ao scroll up
- Paginação: 50 mensagens por fetch

### TypingIndicator

```typescript
<TypingIndicator
  usersTyping={['João', 'Maria']}
  animated={true}
/>
```

**Exibe**:
```
João está digitando...
```

### ReadReceipt

```
✓ Entregue
✓✓ Lido às 14:31
```

---

## 4. PAGES

### `/dashboard/mensagens` - Conversation List

**Arquivo**: `src/pages/dashboard/MessagesPage.tsx`

**Layout**:
```
┌────────────────┬──────────────────────┐
│ Conversas      │ Chat Window          │
├────────────────┤                      │
│ [🔍 Buscar]    │ [Header]             │
│                │ [Messages]           │
│ João Silva     │ [Input]              │
│ 14:30  "Olá..│                      │
│                │                      │
│ Maria Santos   │                      │
│ Ayer "Tudo..│                      │
│                │                      │
│ Empresa XYZ    │                      │
│ Yest "Pode..│                      │
└────────────────┴──────────────────────┘
```

**Funcionalidades**:
- ✅ Lista de conversas (recentes primeiro)
- ✅ Busca por nome
- ✅ Badge com unread count
- ✅ Preview ultima mensagem
- ✅ Timestamp (relativo)
- ✅ Click para abrir chat

### `/dashboard/suporte` - Support Tickets

**Arquivo**: `src/pages/dashboard/SupportTicketsPage.tsx` (já existe)

**Integração com Messaging**:
- Cada ticket = conversation
- Messages = suport_messages
- Same realtime infrastructure

---

## 5. REALTIME - SUPABASE

### Subscription Setup

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        // Nova mensagem chegou em tempo real
        setMessages(prev => [...prev, payload.new]);
      }
    )
    .on(
      'presence',
      { event: 'sync' },
      () => {
        // Outros users online/offline
        const newState = channel.presenceState();
        updateTypingUsers(newState);
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}, [conversationId]);
```

### Typing Status

```typescript
const [typingTimer, setTypingTimer] = useState(null);

const handleInput = (text) => {
  setText(text);
  
  // Notify: "digitando"
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { user_id: userId, is_typing: true }
  });
  
  // Clear previous timer
  clearTimeout(typingTimer);
  
  // Stop typing after 3 seconds of no input
  setTypingTimer(
    setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: userId, is_typing: false }
      });
    }, 3000)
  );
};
```

---

## 6. EDGE FUNCTIONS

### `send-message`
```
POST /functions/v1/send-message
Auth: Bearer token
Body: {
  conversation_id: UUID,
  content: string,
  attachments?: File[]
}
Response: { message_id, created_at, ... }
```

### `get-messages`
```
GET /functions/v1/get-messages?conversation_id=X&page=1&limit=50
Auth: Bearer token
Response: { messages[], total, page, has_more }
```

### `mark-as-read`
```
POST /functions/v1/mark-as-read
Auth: Bearer token
Body: { conversation_id }
Response: { success }
```

### `upload-attachment`
```
POST /functions/v1/upload-attachment
Auth: Bearer token
Body: FormData { file, conversation_id }
Response: { file_id, url, size_bytes }
```

### `create-conversation`
```
POST /functions/v1/create-conversation
Auth: Bearer token
Body: { recipient_id }
Response: { conversation_id }
```

---

## 7. FLUXO DE ENVIO

### Step-by-Step

```
1. User digita + clica enviar
   ↓
2. Button disabledça, mostra loading
   ↓
3. Client cria message com status "sending"
   ↓
4. POST /functions/v1/send-message
   ↓
5. Backend:
   - Validar sender in conversation
   - INSERT message
   - UPDATE last_message_at
   - UPDATE message_count
   ↓
6. Supabase triggers:
   - Broadcast via Realtime
   - Send notification se recipient offline
   ↓
7. Client recebe error ou success
   ↓
8. Update message status: "sent" ou "failed"
   ↓
9. Se recipient online: message aparece em RT
   ↓
10. Se recipient faz read: update read_at
    ↓
11. Notificação read receipt para sender
```

---

## 8. NOTIFICAÇÕES

### Push Notification

Se recipient offline/sem app:

```
Title: "João Silva"
Body: "Olá, tudo bem?"
Action: Abre /dashboard/mensagens/:conversationId
```

### Email Notification

Se recipient offline por > 2 horas:

```
Subject: "Nova mensagem de João Silva"
Body:
João Silva enviou uma mensagem:
"Olá, tudo bem?"

[Responder no app]
```

---

## 9. PERFORMANCE

### Caching

```
- Conversation list: 5 min
- Messages: Realtime (não cache)
- Unread counts: 1 min
```

### Indices

```sql
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_read_status ON message_read_status(message_id, user_id);
```

### Pagination

```
- Load 50 messages initially
- Infinite scroll: load próximos 50 ao scroll up
- Max 500 messages (então arquivo)
```

---

## 10. MODERATION & SAFETY

### Report Message

```
User clica "..." → "Reportar"
  ↓
Modal com motivo (spam, harass, inapropriate, etc)
  ↓
INSERT em message_reports
  ↓
Admin notificado
  ↓
Admin review → Delete / Archive
```

### Block User

```
User clica "..." → "Bloquear"
  ↓
INSERT user_blocks (user_id, blocked_user_id)
  ↓
Blocked user não consegue enviar mensagens
  ↓
Conversas anteriores archived
```

---

## 11. ADMIN INTERFACE

### `/admin/mensagens` - Message Moderation

**Features**:
- ✅ Fila de reportes
- ✅ Preview mensagem
- ✅ Delete / Archive
- ✅ Warn user / Suspend
- ✅ Analytics por user

---

## 12. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas: conversations, messages, participants, read_status
- [x] Component ChatWindow
- [x] Page /dashboard/mensagens
- [x] Realtime Supabase subscriptions
- [x] Edge functions (send, get, mark-read)
- [x] Read receipts
- [x] Typing indicator
- [x] Notifications (push + email)
- [x] File attachments
- [x] Message reactions
- [x] Report/Block system
- [x] Infinite scroll
- [x] Performance optimization

---

## 13. ROADMAP

- [ ] Voice messages
- [ ] Video calls (WebRTC)
- [ ] Group chats
- [ ] Chat encryption (E2E)
- [ ] Message search with full-text
- [ ] Chat bots for auto-replies
- [ ] Chatbot integration

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção

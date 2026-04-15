# ESPECIFICAÇÕES - VALIDAÇÃO DE CERTIFICADOS

## Visão Geral

Sistema de **Validação de Certificados** permite que terceiros (empresas, famílias) verifiquem autenticidade de certificados digitais emitidos. Segue padrão de código único com validação pública e auditoria de acesso. Reutilizável em qualquer plataforma com certificação digital.

---

## 1. MODELO

### Fluxo de Validação

```
Certificado Emitido
    ↓
Código Único Gerado (8 dígitos aleatório)
    ↓
Profissional recebe link + código
    ↓
Terceiro: acessa /validar
    ↓
Digita código da certificado
    ↓
Sistema valida:
  - Existe certificado?
  - Ainda é válido (não expirado)?
  - Não foi revogado?
    ↓
Exibe dados:
  - Nome do profissional
  - Curso completado
  - Nível
  - Data de emissão
  - Código verificação ✅ AUTÊNTICO
```

---

## 2. TABELAS DE BANCO DE DADOS

### `certificates`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id)
course_slug VARCHAR (FK academy_courses.slug)
course_title VARCHAR -- Snapshot do título
course_level VARCHAR -- 'iniciante', 'intermediario', 'avancado'

-- Código de validação
validation_code VARCHAR(8) UNIQUE -- "A7K9M2P1"
is_public_available BOOLEAN DEFAULT true -- Pode ser validado publicamente?

-- Datas
issued_at TIMESTAMP
expires_at TIMESTAMP -- NULL = nunca expira
revoked_at TIMESTAMP -- NULL = ativo

-- Metadata
file_url TEXT -- URL do PDF salvo
file_storage_path TEXT -- Path no storage

created_at TIMESTAMP
updated_at TIMESTAMP
```

### `certificate_validation_logs`

```sql
id UUID PRIMARY KEY
certificate_id UUID (FK certificates.id)
validation_code VARCHAR
was_found BOOLEAN
validator_ip VARCHAR
validator_user_agent TEXT
accessed_at TIMESTAMP
```

### `certificate_revocations`

```sql
id UUID PRIMARY KEY
certificate_id UUID (FK certificates.id)
revoked_by UUID (FK profiles.id, admin)
reason VARCHAR
revoked_at TIMESTAMP
created_at TIMESTAMP
```

---

## 3. PÁGINAS FRONTEND

### `/certificado/:id` - Certificate View (Private)

**Arquivo**: `src/pages/CertificateView.tsx`

**Acesso**: Apenas profissional autenticado ou PDF link direto

**Layout**:
```
┌──────────────────────────────┐
│   HomeCare Match Academy     │
│   CERTIFICADO DE CONCLUSÃO   │
├──────────────────────────────┤
│ Profissional: João Silva     │
│ Curso: Enfermagem Básica     │
│ Nível: Intermediário         │
│ Data: 15 de abril de 2026    │
│ Código: A7K9M2P1             │
├──────────────────────────────┤
│ [Download PDF]               │
│ [Compartilhar] [Imprimir]   │
└──────────────────────────────┘
```

**Funcionalidades**:
- ✅ Display bonito (layout de certificado)
- ✅ Download como PDF
- ✅ Compartilhar (link + código)
- ✅ Print-friendly
- ✅ QR code com link de validação

### `/validar` - Public Validation Page

**Arquivo**: `src/pages/ValidateCertificate.tsx`

**Acesso**: Público (sem login)

**Layout**:
```
┌────────────────────────────────────┐
│ Validar Certificado                │
│ Verificar autenticidade de         │
│ certificados HomeCare Match        │
├────────────────────────────────────┤
│ Digite o código:                   │
│ [_______________________]          │
│                                    │
│ [Validar]                          │
└────────────────────────────────────┘
```

**After Validation Success**:
```
┌────────────────────────────────────┐
│ ✅ CERTIFICADO AUTÊNTICO           │
├────────────────────────────────────┤
│ Profissional: João Silva           │
│ Certificação: Enfermagem Básica    │
│ Nível: Intermediário               │
│ Emitido em: 15/04/2026             │
│ Status: ✅ VÁLIDO                  │
│ Validações: 45 vezes               │
├────────────────────────────────────┤
│ [Voltar] [Compartilhar validação]  │
└────────────────────────────────────┘
```

**After Validation Failure**:
```
┌────────────────────────────────────┐
│ ❌ CERTIFICADO NÃO ENCONTRADO      │
├────────────────────────────────────┤
│ Código inválido ou não existe      │
│ Verifique o código e tente novamente│
│ Códigos são case-insensitive       │
└────────────────────────────────────┘
```

---

## 4. GERAÇÃO DE CERTIFICADO

### Edge Function: `issue-certificate`

```
POST /functions/v1/issue-certificate
Auth: Bearer token (user)
Body: {
  user_id: UUID,
  course_slug: string
}

Process:
1. ✅ Verificar: user completou 100% do curso?
2. ✅ Verificar: user tem subscription ativa?
3. ✅ Existe certificado anterior? (reuse)
4. ✅ Gerar código único (8 chars)
5. ✅ Criar entrada em certificates
6. ✅ Gerar PDF (html2pdf)
7. ✅ Upload PDF para storage
8. ✅ Email com link + código
9. ✅ Retornar certificate_id + url

Response: {
  certificate_id: UUID,
  validation_code: "A7K9M2P1",
  certificate_url: "/certificado/...",
  pdf_download_url: "...",
  validation_url: "/validar?code=A7K9M2P1"
}
```

### Geração de Código

```typescript
function generateCertificateCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

---

## 5. VALIDAÇÃO PÚBLICA

### Edge Function: `validate-certificate`

```
GET /functions/v1/validate-certificate?code=A7K9M2P1

Process:
1. ✅ Sanitize & format code
2. ✅ Query: SELECT * FROM certificates WHERE validation_code
3. ✅ Check: is_public_available = true
4. ✅ Check: revoked_at IS NULL
5. ✅ Check: (expires_at IS NULL OR expires_at > NOW())
6. ✅ Log access em certificate_validation_logs
7. ✅ Return data

Response: {
  found: true,
  is_valid: true,
  certificate: {
    id: UUID,
    professional_name: string,
    course_title: string,
    course_level: string,
    issued_at: timestamp,
    expires_at: timestamp | null,
    validation_count: number
  }
}
```

---

## 6. ADMIN INTERFACE

### `/admin/certificados` - Certificate Management

**Arquivo**: `src/components/admin/CertificatesTab.tsx`

### Features

#### 1. Listar Certificados

```
Profissional | Curso | Data | Código | Validações | Status | Ações
────────────────────────────────────────────────────────────────────
João Silva | Enfermagem | 15/04 | A7K9M2P1 | 45 | Ativo | ...
Maria Santos | Fisioterapia | 20/03 | K2P9M7A1 | 12 | Ativo | ...
```

**Filtros**:
- Professor
- Período
- Status (ativo, expirado, revogado)
- Course

#### 2. Detalhes do Certificado

- Nome profissional
- Curso + Nível
- Código validação
- Velocidade de validações (45 vezes)
- IP/User agent últimas validações
- Status: Ativo / Revogado / Expirado

#### 3. Revogar Certificado

```
Modal "Revogar Certificado":
  - Motivo (dropdown: fraude, erro, duplicado, outro)
  - Campo de texto adicional
  - Confirmar

Ação:
  - Marca revoked_at = NOW()
  - Log em certificate_revocations
  - Email notification ao profissional
  - Validações futuras falham
```

#### 4. Analytics

```
Total certificados: N
Ativos: N (X%)
Revogados: N
Expirados: N
Validações este mês: N
Validações por hora (gráfico)
Código mais validado: A7K9M2P1 (89x)
```

---

## 7. PDF GENERATION

### Certificado PDF

**Usando**: `html2pdf` ou `jsPDF`

**Template**:
```html
<div class="certificate">
  <h1>HomeCare Match Academy</h1>
  <h2>Certificado de Conclusão</h2>
  
  <p>Certificamos que <strong>[PROFESSIONAL_NAME]</strong></p>
  <p>completou com sucesso o curso de</p>
  <p class="course-title">[COURSE_TITLE]</p>
  <p>no nível <strong>[COURSE_LEVEL]</strong></p>
  
  <p>Data de emissão: [ISSUED_DATE]</p>
  <p>Código de verificação: <strong>[CODE]</strong></p>
  
  <p>Valide este certificado em:</p>
  <p><code>https://app.homecarematch.com.br/validar</code></p>
  
  <div class="qr-code">[QR_CODE]</div>
</div>
```

**QR Code**:
- Links para: `/validar?code=A7K9M2P1`
- Gerado server-side (libqr)

---

## 8. EDGE FUNCTIONS

### `validate-certificate`
```
GET /functions/v1/validate-certificate?code=X
Response: { found, is_valid, certificate_data, validation_count }
```

### `revoke-certificate`
```
POST /functions/v1/revoke-certificate
Auth: Bearer token (admin)
Body: { certificate_id, reason }
Response: { success, revoked_at }
```

### `get-certificate-validations`
```
GET /functions/v1/get-certificate-validations?certificate_id=X
Auth: Bearer token (admin)
Response: { validations: [{ ip, user_agent, timestamp }] }
```

### `download-certificate-pdf`
```
GET /functions/v1/download-certificate-pdf?certificate_id=X
Auth: Bearer token (user)
Response: PDF binary + headers (attachment)
```

---

## 9. EMAIL TEMPLATES

### Certificado Emitido

```
Assunto: 🎓 Seu certificado de conclusão!
Corpo:
- Congratulações
- Curso + Nível
- Código: A7K9M2P1
- Link para visualizar
- Link para compartilhar
- CTA: "Compartilhe seu sucesso"
```

### Certificado Revogado

```
Assunto: ⚠️ Certificado revogado
Corpo:
- Aviso de revogação
- Motivo
- Data
- Contato admin
```

---

## 10. SEGURANÇA

### Validação de Integridade

```
- Código unique com constraint UNIQUE
- Imutável após emissão
- Timestamp audit trail
- IP logging para detectar validações suspeitas
```

### Rate Limiting

```
- Max 100 validações por IP / por dia
- Alert se > 10 validações do mesmo código / por hora
- Bloqueio automático suspeitos em admin dashboard
```

### Privacy

```
- Validação pública mostra: apenas nome + curso + data
- Não exibe email do profissional
- Não exibe user_id
```

---

## 11. INTEGRAÇÕES

### Com Dashboard

```
- Link "Meus Certificados" em /dashboard
- Card com lista de certificados
- Download PDF direto
- Compartilhar código
```

### Com Profiles

```
- Badge "🎓 Certificado em X" no perfil
- Link clicável para validar
- Velocidade no ranking
```

---

## 12. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas: certificates, certificate_validation_logs
- [x] Página `/certificado/:id`
- [x] Página `/validar` pública
- [x] Edge function: issue-certificate
- [x] Edge function: validate-certificate
- [x] PDF generation (template + QR code)
- [x] Admin interface para revogar
- [x] Email templates
- [x] Analytics dashboard
- [x] Rate limiting
- [x] Security & audit trails

---

## 13. ROADMAP

- [ ] Blockchain certificates (immutable)
- [ ] Integration com LinkedIn
- [ ] Batch validation (search múltiplos códigos)
- [ ] QR code scanning mobile
- [ ] Expiration reminders
- [ ] Certificate wallets

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção

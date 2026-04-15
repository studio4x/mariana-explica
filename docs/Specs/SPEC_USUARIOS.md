# ESPECIFICAÇÕES - USUÁRIOS (CRIAÇÃO E EDIÇÃO)

## Visão Geral

O sistema de **Usuários** da HomeCare Match suporta criação, edição e gerenciamento de perfis com suporte a múltiplos tipos de usuários (Profissional, Empresa, Família). Cada tipo possui campos e validações específicas, com fluxo de verificação identitária e documento.

---

## 1. TIPOS DE USUÁRIO

### Classificação por Role

| Role | Display | Descrição |
|------|---------|-----------|
| **professional** | Profissional | Prestador de serviço (saúde) |
| **company** | Empresa | Contratante (clínicas, homecare) |
| **family** | Família | Responsáveis por clientes (caregivers) |
| **admin** | Administrador | Staff da plataforma |

### Características por Tipo

#### Profissional
- ✅ Perfil público
- ✅ Múltiplas especialidades
- ✅ Disponibilidades
- ✅ Verificação profissional (RG + Registro)
- ✅ Avaliações e histórico
- ✅ Certificados

#### Empresa
- ✅ Perfil público
- ✅ Dados de contato
- ✅ Histórico de contratos
- ✅ Verificação de CNPJ
- ✅ Vagas/oportunidades
- ✅ Reviews como contratante

#### Família
- ✅ Perfil privado (não listável)
- ✅ Dados do paciente
- ✅ Especificidades de cuidado
- ✅ Verificação de documento
- ✅ Prova de endereço

---

## 2. FLUXO DE CRIAÇÃO DE USUÁRIO

### Estágio 1: Autenticação (Email/Senha)

```
1. Usuário acessa /auth
2. Clica "Criar conta"
3. Email verification link enviado
4. Usuário confirma email
5. Perfil básico criado em `profiles` table
```

**Campos Iniciais**:
- `id` (UUID, gerado por Supabase)
- `email` (verificado)
- `password_hash` (Supabase Auth)
- `email_confirmed_at` (timestamp)
- `created_at` (now)
- `role` (NULL inicialmente)
- `full_name` (NULL)

### Estágio 2: Onboarding (Tipo + Dados Básicos)

```
1. POST-confirmação, usuário vê OnboardingModal
2. Seleciona tipo (Professional / Company / Family)
3. Preenche dados básicos:
   - Nome completo
   - Telefone
   - Estado / Cidade
   - Foto (avatar)
4. Clica próximo
```

**Campos Preenchidos**:
- `role` = "professional" | "company" | "family"
- `full_name`
- `phone`
- `state`
- `city`
- `avatar_url`

### Estágio 3: Especificações por Tipo

#### Se Profissional:
```
1. Seleciona especialidade (dropdown com 14 opções)
2. Disponibilidades (checkboxes múltiplos)
3. Perfis de paciente atendidos
4. Clica finalizar
```

**Campos**:
- `specialties` (JSONB array)
- `availability` (JSONB array)
- `patient_profiles` (JSONB array)

#### Se Empresa:
```
1. Preenche CNPJ / Razão Social
2. Seleciona tipo (Homecare, Clínica, etc)
3. Descrição breve
4. Clica finalizar
```

**Campos**:
- `cnpj`
- `company_type`
- `company_description`
- `company_legal_name`

#### Se Família:
```
1. Dados do paciente:
   - Nome
   - Idade
   - Condições médicas
   - Nível de mobilidade
   - Estado cognitivo
   - Equipamentos especiais
   - Habilidades de comunicação
2. Clica finalizar
```

**Campos**:
- `patient_name`
- `patient_age`
- `patient_medical_conditions`
- `patient_specialties`
- `patient_mobility_level`
- `patient_cognitive_state`
- `patient_special_equipment`
- `patient_communication_skills`

---

## 3. PÁGINA DE PERFIL (EDIÇÃO)

### Localização
- **URL**: `/dashboard/perfil`
- **Arquivo**: `src/pages/dashboard/ProfilePage.tsx`
- **Acesso**: Apenas usuário logado

### Estrutura de Abas

#### 1. Informações Básicas

**Campos Editáveis**:
- Avatar (upload com cropper)
- Nome completo
- Email (read-only)
- Telefone
- Data de nascimento
- Bio/Descrição pessoal
- Links (site, LinkedIn, etc)

**Upload de Avatar**:
- Formato: JPEG, PNG
- Tamanho máximo: 5MB
- Crop image com ImageCropper
- Storage: `uploads/avatar/{user_id}/{uuid}.jpg`

#### 2. Dados de Localização

**Campos**:
- Estado (select com 27 unidades)
- Cidade (populated dinamicamente via `fetchCitiesByState`)
- CEP (opcional, com busca de endereço)
- Endereço completo (read-only após lookup CEP)

**Comportamento**:
```
1. Usuário digita CEP
2. Click "Buscar"
3. Integração com API de CEP
4. Preenchimento automático (estado, cidade, rua, bairro)
5. Usuário pode editar se necessário
```

#### 3. Verificação de Identidade

**Para Professionais**:
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id_document_url` | file | Sim | RG/CNH/Passaporte |
| `prof_registration_url` | file | Sim | Registro profissional (COREN, CRM, etc) |
| `registration` | text | Sim | Número do registro |

**Para Familia**:
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `patient_document_url` | file | Sim | Documento do paciente |
| `patient_address_proof_url` | file | Sim | Comprovante de endereço |

**Upload de Documentos**:
- Formatos: PDF, JPG, PNG
- Tamanho máximo: 10MB
- Storage: `uploads/verification/{type}/{user_id}/{uuid}`
- Status: Pending → Verified (manual review)

#### 4. Especialidades (Profissional)

**Checkboxes Disponíveis**:
```
- Assistente Social
- Auxiliar de Enfermagem
- Cuidador(a) de Idosos
- Dentista
- Enfermeiro(a)
- Farmacêutico(a)
- Fisioterapeuta
- Fonoaudiólogo(a)
- Médico(a) - Clínico Geral / Geriatra
- Nutricionista
- Psicólogo(a)
- Psicopedagogo(a)
- Técnico(a) de Enfermagem
- Terapeuta Ocupacional
```

**Storage**: `specialties` (JSONB array)

#### 5. Disponibilidades (Profissional)

**Opções**:
```
- Período da Manhã
- Período da Tarde
- Período da Noite
- Dia Integral (Diurno)
- Plantão 12h (Noturno)
- Finais de Semana
- 1h de atendimento
- 2h de atendimento
- 3h de atendimento
```

**Storage**: `availability` (JSONB array)

#### 6. Perfis de Paciente (Profissional)

**Opções**:
```
- Idosos
- Pediátrico
- Pós-cirúrgico
- Doenças Crônicas
- Cuidados Paliativos
- Reabilitação Neurológica
```

**Storage**: `patient_profiles` (JSONB array)

#### 7. Dados do Paciente (Familia)

**Campos Específicos**:

```
Nome do Paciente: text
Idade: number
Condições Médicas: textarea (ex: Diabetes, Hipertensão)
Especialidades Necessárias: checkboxes (14 tipos)

Nível de Mobilidade:
- Acamado
- Cadeira de Rodas
- Anda com Auxílio
- Totalmente Móvel

Estado Cognitivo:
- Alerta e Orientado
- Comprometimento Leve
- Demência
- Confusão/Agitação

Equipamentos Especiais:
- Oxigênio
- Sonda de Alimentação
- Cateter
- Ventilador
- Ostomia

Habilidades de Comunicação:
- Verbal
- Não-Verbal
- Com Dificuldade
- Prancha de Comunicação
```

#### 8. Bio Automática (Profissional)

**Feature**: Geração de Bio por IA

```
1. Clique em "ícone de varinha mágica"
2. System chama edge function "generate-bio"
3. Analisa: especialidades, disponibilidades, pacientes
4. Gera texto em português natural
5. Usuário pode aceitar / rejeitar / editar
```

#### 9. Gerenciamento da Conta

**Alterção de Senha**:
```
1. Clique "Mudar senha"
2. Dialog com ChangePasswordDialog component
3. Validação de senha atual
4. Nova senha com confirmação
5. Requisição via Supabase Auth
```

**Conexões Externas** (se habilitado):
- Google
- Apple
- LinkedIn

**Dados de Localização Atualizada**:
- Geocoding com reverse lookup
- Armazena `latitude`, `longitude`, `address_formatted`

#### 10. Zona Perigosa (Danger Zone)

**Ações Irreversíveis**:

```
1. Deletar Conta
   - Requer confirmação dupla
   - Digitar "Quero deletar minha conta"
   - 30 dias de carência (cancelável)
   - Após 30 dias: dados removidos
   ```

**Dados Mantidos Após Exclusão**:
- Transações (anonymized)
- Histórico de suporte
- Registros legais

---

## 4. TABELAS DE BANCO DE DADOS

### `profiles` (Principal)

```sql
-- Autenticação
id UUID PRIMARY KEY (FK auth.users.id)
email TEXT UNIQUE
email_confirmed_at TIMESTAMP

-- Tipo e Status
role ENUM: 'professional'|'company'|'family'|'admin'
is_admin BOOLEAN DEFAULT false
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP (soft delete)

-- Básico
full_name TEXT
phone TEXT
avatar_url TEXT
date_of_birth DATE
bio TEXT
registration TEXT (professional license number)

-- Localização
state VARCHAR(2)
city TEXT
street_address TEXT
street_number TEXT
neighborhood TEXT
zip_code VARCHAR(10)
latitude DECIMAL(10,8)
longitude DECIMAL(11,8)
address_formatted TEXT

-- Verificação
id_document_url TEXT
id_document_verified BOOLEAN DEFAULT false
prof_registration_url TEXT
prof_registration_verified BOOLEAN DEFAULT false
verification_status ENUM: 'pending'|'verified'|'rejected'

-- Especialidades (Professional)
specialties JSONB (array of strings)
availability JSONB (array of strings)
patient_profiles JSONB (array of strings)

-- Empresa
cnpj TEXT UNIQUE
company_type TEXT
company_description TEXT
company_legal_name TEXT

-- Família
patient_name TEXT
patient_age INTEGER
patient_medical_conditions TEXT
patient_specialties JSONB
patient_mobility_level TEXT
patient_cognitive_state TEXT
patient_special_equipment JSONB
patient_communication_skills JSONB
patient_document_url TEXT
patient_address_proof_url TEXT

-- Notificações e Preferências
notifications_enabled BOOLEAN DEFAULT true
subscription_tier ENUM: 'free'|'monthly'|'yearly'
subscription_until TIMESTAMP
```

### Validações Estruturais

**Constraints Automáticas**:
- `email` não pode ser NULL
- `full_name` obrigatório após onboarding
- `phone` formato: ^(\+55)?\d{10,11}$
- `zip_code` formato: ^\d{5}-?\d{3}$
- `specialties` max length 20 items
- `role` não pode ser NULL após onboarding

---

## 5. FLUXOS DE ATUALIZAÇÃO

### Salvar Perfil (POST_EDIÇÃO)

```
1. Usuário clica "Salvar"
2. Validação local de campos obrigatórios
3. POST /rest/v1/profiles
4. Backend valida tipos de dados
5. Se sucesso: Toast "Perfil atualizado"
6. Se erro: Toast com mensagem específica
7. Refetch de dados via React Query
```

### Upload de Arquivo

```
1. Usuário seleciona arquivo via input file
2. Validação (tipo, tamanho)
3. Sanitização de nome
4. PUT /storage/v1/object/uploads
5. Geração de public_url
6. UPDATE profiles SET {field}_url = public_url
7. Feedback visual com ícone de checkmark
```

### Busca de Cidades por Estado

```
1. Estado selecionado
2. Effect dispara em [profile.state]
3. Chama fetchCitiesByState(state)
4. Popula select de cidades
5. Reset de city para ''
```

### Geocoding (CEP → Coordenadas)

```
1. Usuário digita CEP
2. Clica "Buscar endereço"
3. API lookup de CEP externo
4. Preenche: estado, cidade, rua
5. Reverse geocoding: get lat/long
6. Atualiza profiles com coordinates
```

---

## 6. VALIDAÇÕES

### Email
- ✅ Obrigatório
- ✅ Formato válido: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- ✅ Único no sistema
- ✅ Confirmado via Supabase Auth

### Telefone
- ✅ Formato: Com ou sem +55
- ✅ Mínimo 10 dígitos
- ✅ Máximo 11 dígitos

### Nome Completo
- ✅ Mínimo 3 caracteres
- ✅ Máximo 100 caracteres
- ✅ Não pode ser vazio

### CEP
- ✅ Formato: XXXXX-XXX ou XXXXXXXX
- ✅ Lookup via API de CEP
- ✅ Validação de existência

### Documentos (Professional)
- ✅ Mínimo 1 arquivo de ID
- ✅ Mínimo 1 arquivo de registro profissional
- ✅ Formatos aceitos: PDF, JPG, PNG
- ✅ Tamanho máximo: 10MB

### Especialidades
- ✅ Mínimo 1 selecionada
- ✅ Máximo 20
- ✅ Valores válidos conforme lista

---

## 7. COMPONENTES RELACIONADOS

### ImageCropper
**Localização**: `src/components/profile/ImageCropper.tsx`

- ✅ Crop circular/rectangular
- ✅ Zoom e resize
- ✅ Preview em tempo real
- ✅ Download cropped image

### ChangePasswordDialog
**Localização**: `src/components/ChangePasswordDialog.tsx`

- ✅ Validação de senha atual
- ✅ Força de senha
- ✅ Confirmação
- ✅ Integração Supabase Auth

### OnboardingModal
**Localização**: `src/components/OnboardingModal.tsx`

- ✅ Multi-step form
- ✅ Seleção de tipo
- ✅ Progressbar
- ✅ Skip option

---

## 8. EDGE FUNCTIONS

### `generate-bio`
```
POST /functions/v1/generate-bio
Auth: Bearer token
Body: {
  specialties: string[],
  availability: string[],
  patient_profiles: string[]
}
Response: { bio: string }
```

### `verify-cep`
```
POST /functions/v1/verify-cep
Body: { cep: string }
Response: {
  state: string,
  city: string,
  street: string,
  neighborhood: string,
  latitude: number,
  longitude: number
}
```

---

## 9. HOOKS CUSTOMIZADOS

### `useAuth()`
```typescript
{
  user: User | null,
  session: Session | null,
  loading: boolean,
  signOut: () => Promise<void>
}
```

### `useSiteConfig()`
```typescript
{
  data: SiteConfig | null,
  isLoading: boolean,
  error?: Error
}
```

---

## 10. FLUXOS DE REFERÊNCIA

### Captura de Referral Code

```
1. URL: /?ref=CODE ou /convite?ref=CODE
2. AuthProvider extrai ref param
3. Armazena em: sessionStorage.referral_code
4. Onboarding (Nova conta) lê referral_code
5. Cria affiliate_referral com código
6. Associate com affiliate_partners.id
```

### Redirecionamento Pós-Signup

```
1. Email confirmado
2. Redirect para /dashboard
3. Se incompleto → OnboardingModal auto-open
4. Após onboarding → Redirect para próxima page
```

---

## 11. COMPLETUDE DE PERFIL

**Arquivo**: `src/lib/profile-completeness.ts`

```typescript
getProfileCompleteness(profile): {
  percentage: number,
  missing: string[],
  nextStep?: string
}
```

**Métricas**:
- Avatar (10%)
- Especialidades (15%)
- Disponibilidades (15%)
- Documentos (25%)
- Bio (15%)
- Localização (20%)

---

## 12. SEGURANÇA & PRIVACIDADE

### Dados Sensíveis
- ✅ Documentos criptografados em storage
- ✅ Senhas via Supabase Auth (bcrypt)
- ✅ Dados de paciente (família) privados
- ✅ Acesso apenas pelo próprio usuário + admin

### Auditoria
- ✅ `updated_at` timestamp
- ✅ Histórico de edições (via logging)
- ✅ Soft delete com `deleted_at`
- ✅ RLS policies por user_id

###PolícasRow Level Security (RLS)

```sql
-- Users can only see/edit their own profile
CREATE POLICY profile_self_access
  ON profiles
  FOR ALL
  USING (auth.uid() = id OR is_admin);

-- Public can only see verified professional profiles
CREATE POLICY profile_public_professional
  ON profiles
  FOR SELECT
  USING (role = 'professional' AND verification_status = 'verified');
```

---

## 13. MOBILE RESPONSIVENESS

- ✅ Mobile-first design
- ✅ Touch-friendly inputs
- ✅ Collapsible sections
- ✅ Optimized images
- ✅ Full-screen forms no mobile

---

## 14. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Autenticação com email/senha
- [x] Onboarding modal com tipos de usuário
- [x] Página de perfil `/dashboard/perfil`
- [x] Upload de avatar com cropper
- [x] Upload de documentos com verificação
- [x] Busca de CEP com geocoding
- [x] Seleção de especialidades (profissional)
- [x] Dados de paciente (família)
- [x] Geração de bio via IA
- [x] Mudança de senha
- [x] Delete account com confirmação
- [x] Notificações de sucesso/erro
- [x] RLS policies
- [x] Mobile responsiveness

---

## 15. REFERÊNCIAS

- [Image Cropper Component](src/components/profile/ImageCropper.tsx)
- [Change Password Dialog](src/components/ChangePasswordDialog.tsx)
- [Auth Provider](src/components/auth/AuthProvider.tsx)
- [Profile Completeness](src/lib/profile-completeness.ts)
- [Geo Utils](src/lib/geo-utils.ts)
- [Brazil Locations](src/lib/brazil-locations.ts)

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
- **Último Revisor**: AI Assistant

# ESPECIFICAÇÕES - PROGRAMA DE AFILIADOS

## Visão Geral

O **Programa de Afiliados** da HomeCare Match é um modelo de parceria para divulgação da plataforma e captação de novos profissionais. Afiliados recebem comissões por referências bem-sucedidas seguindo um modelo de bônus por marco + comissão recorrente.

---

## 1. MODELO DE NEGÓCIO

### Tipo de Programa
- ✅ **Afiliação por performance** (comissão variável)
- ✅ **Bônus por marco** (número de assinaturas validadas)
- ✅ **Comissão recorrente** (% sobre pagamentos do indicado)
- ✅ **Clawback automático** (estornos/cancelamentos)

### Elegibilidade
- **Perfil**: Parceiros dedicados à divulgação
- **Distinção**: Diferente de usuários profissionais (conta regular)
- **Aprovação**: Análise manual de candidaturas
- **Múltiplos Programas**: Profissional pode ser tanto "profissional regular" quanto "afiliado dedicado"

### Atribuição de Referências
- **Método**: First-touch (primeiro ponto de contato)
- **Imutabilidade**: Atribuição permanente após confirmação
- **Sem Retroatividade**: Só conta depois da ativação do módulo
- **Regra de Prioridade**: Afiliado > Usuário profissional com referral code

---

## 2. ESTRUTURA DE COMISSÕES

### Valores Configuráveis (via Admin)

| Parâmetro | Default | Unidade | Descrição |
|-----------|---------|--------|-----------|
| `signup_commission_amount` | 50 | BRL | Bônus por marco de assinaturas |
| `signup_macro_count` | 10 | unidades | Quantas assinaturas = 1 bônus |
| `recurring_commission_percent` | 10 | % | Comissão mensal sobre pagamentos válidos |
| `payout_minimum_amount` | 100 | BRL | Saldo mínimo para saque |
| `monthly_payout_max` | 24 | meses | Limite de refunds recorrentes por mês |
| `annual_payout_max` | 2 | anos | Limite de refunds anuais |

### Exemplo de Apuração

**Bônus por Marco**:
```
10 novos profissionais inscritos → 1 bônus de R$ 50
20 novos profissionais inscritos → 2 bônus (R$ 100)
```

**Comissão Recorrente**:
```
Indicado assina plano de R$ 1.000 → Afiliado recebe 10% = R$ 100/mês
Se indicado cancela → Comissão para automaticamente
```

### Clawback (Estornos)

```
Indicado faz pagamento → Crédito em "shadow" → Validação passa → Crédito em "available"
Indicado cancela/estorna → Clawback automático (débito em "available" ou futuros)
```

---

## 3. CICLO DE VIDA DO AFILIADO

### Estágios de Status

| Status | Descrição |
|--------|-----------|
| **pending** | Candidatura em revisão |
| **approved** | Aprovado e ativo |
| **rejected** | Rejeitado (bloqueado) |
| **inactive** | Pausado temporariamente |
| **blocked** | Suspeito de fraude/violação |

### Fluxo de Aprovação

```
1. Afiliado preenche candidatura (email, dados PIX, mensagem)
   ↓
2. Sistema valida email (busca duplicatas)
   ↓
3. Admin revisa na página de admin (/admin/afiliados)
   ↓
4. Admin aprova/rejeita com motivo
   ↓
5. Afiliado acessa dashboard (/dashboard/afiliados)
```

---

## 4. SALDO E PAGAMENTOS

### Estados do Saldo

```
shadow: Créditos não validados (risco fraude)
available: Seguro para saque
reserved: Em lote de pagamento pendente
paid: Já pago ao afiliado
voided: Anulado (clawback)
```

### Fluxo de Pagamento

```
1. Afiliado solicita saque (saldo >= mínimo)
2. Admin cria "batch" de lote de pagamentos
3. Batch status: draft → approved → paid
4. Sistema integra com Banco/PIX
5. Afiliado recebe transferência
```

### Dados PIX

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `pix_key` | string | Sim | Chave PIX (CPF, CNPJ, email, etc) |
| `pix_key_type` | enum | Sim | Tipo: random, cpf, cnpj, email, phone |

**Validação**: Chave PIX deve estar **em nome do afiliado**, caso contrário saque é recusado.

---

## 5. TABELAS DE BANCO DE DADOS

### `affiliate_partners`

```sql
id UUID PRIMARY KEY
user_id UUID (FK profiles.id)
status ENUM: 'active'|'inactive'|'blocked'
application_status ENUM: 'pending'|'approved'|'rejected'
full_name TEXT
email TEXT
phone TEXT
city TEXT
state TEXT
audience TEXT -- Descrição do público-alvo
experience TEXT -- Experiência/histórico
message TEXT -- Mensagem de candidatura
pix_key TEXT
pix_key_type ENUM: 'random'|'cpf'|'cnpj'|'email'|'phone'
agreement_version TEXT -- Versão do termo aceito
agreement_accepted_at TIMESTAMP
rejection_reason TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `affiliate_referral_links`

```sql
id UUID PRIMARY KEY
partner_id UUID (FK affiliate_partners.id)
short_code VARCHAR UNIQUE
target_path TEXT -- Ex: '/convite'
short_url TEXT -- URL pública
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `affiliate_ledger`

```sql
id UUID PRIMARY KEY
partner_id UUID (FK affiliate_partners.id)
entry_type ENUM: 'signup_credit'|'recurring_credit'|'clawback_debit'|'manual_adjustment'
amount DECIMAL
status ENUM: 'shadow'|'available'|'reserved'|'paid'|'voided'
related_referral_id UUID
related_transaction_id UUID
description TEXT
created_at TIMESTAMP
processed_at TIMESTAMP
voided_at TIMESTAMP
```

### `affiliate_payouts`

```sql
id UUID PRIMARY KEY
partner_id UUID (FK affiliate_partners.id)
batch_id UUID (FK affiliate_payout_batches.id)
amount DECIMAL
status ENUM: 'reserved'|'paid'|'canceled'
pix_key TEXT
pix_key_type VARCHAR
bank_reference TEXT
error_message TEXT
requested_at TIMESTAMP
paid_at TIMESTAMP
created_at TIMESTAMP
```

### `affiliate_payout_batches`

```sql
id UUID PRIMARY KEY
month VARCHAR -- YYYY-MM
status ENUM: 'draft'|'approved'|'paid'|'canceled'
total_amount DECIMAL
payment_count INTEGER
created_by UUID (FK profiles.id)
approved_at TIMESTAMP
paid_at TIMESTAMP
created_at TIMESTAMP
```

### `affiliate_applications`

```sql
id UUID PRIMARY KEY
full_name TEXT
email TEXT
phone TEXT
city TEXT
state TEXT
audience TEXT
experience TEXT
message TEXT
pix_key_type VARCHAR
pix_key TEXT
status ENUM: 'pending'|'approved'|'rejected'
rejection_reason TEXT
agreement_version TEXT
agreement_accepted_at TIMESTAMP
created_at TIMESTAMP
reviewed_by UUID (FK profiles.id)
reviewed_at TIMESTAMP
```

---

## 6. PÁGINAS E COMPONENTES

### Para Usuários

#### `/afiliados` - Landing Page
**Arquivo**: `src/pages/AffiliateProgramPage.tsx`

- ✅ Descrição do programa
- ✅ Termos e condições (10 seções)
- ✅ Formulário de candidatura
  - Nome completo
  - Email (com validação de duplicata)
  - Telefone
  - Cidade/Estado
  - Público-alvo (textarea)
  - Experiência (textarea)
  - Tipo PIX + Chave
  - Aceitar termos

**Validação de Email**: Async via `affiliate-check-email` function

#### `/dashboard/afiliados` - Dashboard do Afiliado
**Arquivo**: `src/pages/dashboard/AffiliatesPage.tsx`

**Seções**:
1. **Status do Programa**: Badges (ativo, sombra, desativado)
2. **Saldo em Tempo Real**:
   - Saldo disponível (verde)
   - Saldo em sombra (amarelo)
   - Reservado (azul)
   - Já pago (cinza)
   - Lifetime total

3. **Dados PIX**: Form com Tipo + Chave (editável)

4. **Link de Afiliado**: 
   - Botão gerar/copiar
   - Atualiza dinamicamente via `affiliate-generate-short-link`
   - Reutiliza link existente se já gerado

5. **Ledger/Extrato**:
   - Tabela com histórico de créditos/débitos
   - Filtro por status (shadow, available, reserved, paid, voided)
   - Formatação de moeda BRL

6. **Payouts Históricos**:
   - Tabela com saques realizados
   - Status de cada lote (reserved, paid, canceled)
   - Data de processamento

#### `/dashboard/afiliados/kit-midia` - Kit de Mídia
**Arquivo**: `src/pages/dashboard/AffiliateMediaKitPage.tsx`

- ✅ 3 Templates de Mensagens (com {{affiliate_link}} placeholder)
- ✅ 3 Imagens para download (PNG)
- ✅ Botão copiar texto
- ✅ Botão baixar imagem

---

### Para Admin

#### `/admin/afiliados` - Admin Dashboard
**Arquivo**: `src/pages/admin/AffiliatesPage.tsx`

**Abas**:

1. **Configurações**
   - Toggle: Habilitar/desabilitar programa
   - Toggle: Modo sombra (coleta sem payout)
   - Bônus por marco (R$)
   - % comissão recorrente
   - Mínimo de saque
   - Limites mensais/anuais
   - Salvar com validação

2. **Parceiros**
   - Lista de todos os afiliados
   - Status, email, saldo total
   - Detalhes expandíveis
   - Ações: bloquear, reativar

3. **Aplicações Pendentes**
   - Fila de candidaturas
   - Form pré-preenchido de cada candidato
   - Botões: Aprovar / Rejeitar (com motivo)

4. **Lotes de Pagamento**
   - Criar novo lote (mês)
   - Status: draft → approved → paid
   - Total de valores
   - Histórico

5. **Kit de Mídia**
   - Editor de 3 prompts (título, descr, conteúdo)
   - Upload de 3 imagens
   - Pré-visualização
   - Salvar alterações

---

## 7. EDGE FUNCTIONS

### `affiliate-check-email`
```
POST /functions/v1/affiliate-check-email
Body: { email: string }
Response: { available: bool, reason?: string }
```

### `affiliate-dashboard-stats`
```
GET /functions/v1/affiliate-dashboard-stats
Auth: Bearer token
Response: {
  partner: AffiliatePartner | null,
  config: AffiliateConfig,
  balances: { shadow_balance, available_balance, reserved_balance, paid_balance, lifetime_balance },
  links: AffiliateReferralLink[],
  ledger: AffiliateLedgerEntry[],
  payouts: AffiliatePayout[]
}
```

### `affiliate-generate-short-link`
```
POST /functions/v1/affiliate-generate-short-link
Auth: Bearer token
Body: { target_path: string }
Response: { short_url: string, short_code: string, reused: bool }
```

### `affiliate-admin-list`
```
GET /functions/v1/affiliate-admin-list
Auth: Bearer token (admin only)
Response: {
  config: AffiliateConfig,
  partners: AffiliatePartner[],
  applications: AffiliateApplication[],
  batches: AffiliatePayoutBatch[]
}
```

---

## 8. FLUXOS DE REFERÊNCIA

### Captura de Referência

```
1. Usuário clica em link /convite?ref=SHORT_CODE
   ↓
2. Sistema resolve short_code → affiliate_id
   ↓
3. Armazena em session/localStorage: referral_context={ affiliate_id, timestamp }
   ↓
4. Usuário faz signup e cria conta
   ↓
5. Sistema cria referral record:
   referrer_id = affiliate_id
   referral_type = "affiliate"
   ↓
6. Profissional completa verificação (identity check)
   ↓
7. Primeira assinatura paga → Crédito de bônus em "shadow"
```

### Validação de Clawback

```
1. Indicado faz pagamento → ledger entry (status: shadow)
   ↓
2. Validação de fraude passa → Muda para "available"
   ↓
3. Indicado cancela/estorna → Clawback automático
   ↓
4. Sistema procura saldo "available" → Débito
   ↓
5. Se saldo insuficiente → Marca como "voided" para auditoria
```

---

## 9. COMPLIANCE & SEGURANÇA

### Condutas Proibidas

❌ Auto-indicação (afiliado se indicando)
❌ Fraude (fake accounts)
❌ Identidades de terceiros
❌ Spam
❌ Publicidade enganosa
❌ Promessa de resultado garantido
❌ Uso indevido de marca

**Consequências**:
- Bloqueio de novas atribuições
- Estorno de comissões
- Suspensão da conta
- Medidas legais

### Auditoria

- ✅ Todos os ledger entries imutáveis
- ✅ Timestamps de criação, validação, processamento
- ✅ Rastreamento de admin approvals
- ✅ Logs de clawback com motivo
- ✅ Rejeição de candidatura com reason

---

## 10. RELATÓRIOS & ANALYTICS

### Dashboard Admin

```
Total de Parceiros: N
Parceiros Ativos: N
Aplicações Pendentes: N
Saldo Total em Sombra: R$ X
Saldo Total Disponível: R$ Y
Clawback do Mês: R$ Z
```

### Extrato Individual

```
Período: Jan 2026
Bônus por marcos: R$ 500
Comissão recorrente: R$ 2.340
Clawbacks: -R$ 150
Saldo final: R$ 2.690
```

---

## 11. TERMOS & CONDIÇÕES

**Versão Atual**: `2026-03-19-v1`

**Última Atualização**: 19/03/2026

**Seções**:
1. Objeto (sem vínculo trabalhista)
2. Elegibilidade (aprovação HCM)
3. Regras de atribuição (first-touch)
4. Comissões e apuração (bônus + recorrente)
5. Pagamento (PIX, saque mínimo)
6. Clawback (anulação de estornos)
7. Condutas proibidas
8. Responsabilidades
9. Privacidade e dados
10. Vigência e alterações

**Aceite**: Obrigatório no cadastro, versionado, timestamped

---

## 12. CHECKLIST DE IMPLEMENTAÇÃO

- [x] Tabelas de banco de dados criadas
- [x] Landing page `/afiliados` com formulário
- [x] Validação de email duplicado (function)
- [x] Dashboard `/dashboard/afiliados`
- [x] Geração de short links
- [x] Admin `/admin/afiliados` com abas
- [x] Kit de mídia (templates + imagens)
- [x] Ledger e extrato
- [x] Lotes de pagamento
- [x] Termos e condições versionados
- [x] Analytics de tickets por urgência
- [x] Edge functions de suporte

---

## 13. REFERÊNCIAS

- [Arquivo de Termos](regras_programa_indicacoes_embaixador.txt)
- [Documento Detalhado de Regras](regras_programa_indicacoes_embaixador.txt)

---

## Versão do Documento

- **Data**: Abril 2026
- **Versão**: 1.0
- **Status**: ✅ Em Produção
- **Último Revisor**: AI Assistant


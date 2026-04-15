# Skill: Supabase Migrations & RLS

## Propósito

Padronizar a criação de migrations SQL, índices, triggers, constraints e policies de RLS seguras.

**Objetivo:** garantir que toda alteração estrutural de banco seja feita por migration versionada, que RLS proteja dados privados, que índices melhorem performance e que constraints mantenham integridade.

---

## Quando usar esta skill

Use **Supabase Migrations & RLS** quando:

- precisar **criar ou alterar uma tabela**
- precisar **criar índices** para melhorar performance
- precisar **proteger dados privados com RLS**
- precisar **criar constraints** de foreign key ou unique
- precisar **adicionar triggers** para `updated_at` ou automação
- precisar **definir policies** de acesso seguro por role/user
- estiver **refatorando estrutura do banco**
- tiver dúvida sobre **como modelar algo com segurança**

---

## Documentos obrigatórios a consultar

Na ordem de prioridade:

1. **docs/04-banco-dados.md** — modelagem, estrutura, convenções SQL
2. **docs/10-autenticacao-seguranca.md** — RLS, policies, autorização no banco
3. **docs/03-arquitetura.md** — separação de camadas, exemplo SPA
4. **docs/02-regras-negocio.md** — regras críticas que o banco deve enforçar

---

## Regra crítica: migrations SQL são fonte oficial

**Nunca faça:**

- ❌ alterar schema manualmente no painel Supabase
- ❌ confiar em snapshot de schema como verdade
- ❌ copiar estrutura sem versionar

**Sempre faça:**

- ✅ criar migration SQL versionada `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`
- ✅ testar migration localmente
- ✅ versioná-la no Git
- ✅ fazer deploy com Supabase CLI

---

## Padrão obrigatório de migration

### Estrutura base

```sql
-- Migration: YYYYMMDDHHMMSS_descricao
-- Propósito: descrever clara e concisamente o que faz

BEGIN;

-- Criar tabela ou alterar estrutura
CREATE TABLE [IF NOT EXISTS] nome_tabela (
  id BIGSERIAL PRIMARY KEY,
  coluna_dados tipo NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Foreign keys com constraint clara
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Índices inline quando faz sentido
  UNIQUE (email),
  CONSTRAINT nome_constraint CHECK (condicao)
);

-- Criar índices críticos
CREATE INDEX idx_tabela_user_id ON nome_tabela(user_id);
CREATE INDEX idx_tabela_coluna ON nome_tabela(coluna_dados);

-- Criar trigger para updated_at
CREATE TRIGGER atualizar_timestamp_nome_tabela
  BEFORE UPDATE ON nome_tabela
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

-- Habilitar RLS se tabela for privada
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

-- Criar policies de acesso
CREATE POLICY "política_descritiva" ON nome_tabela
  FOR SELECT
  USING (auth.uid() = user_id); -- ou regra apropriada

COMMIT;
```

---

## Convenções obrigatórias

### Tabelas

- ✅ `id` como chave primária (BIGSERIAL ou UUID)
- ✅ `created_at` sempre, com valor default `NOW()`
- ✅ `updated_at` sempre que tabela puder ser alterada, com trigger
- ✅ `user_id` referenciando `auth.users(id)` quando privada
- ✅ Foreign keys com `ON DELETE CASCADE` ou apropriado
- ✅ Nomes em snake_case
- ✅ Comentários claros sobre o propósito da coluna se não óbvio

### Índices

- ✅ Foreign keys sempre indexadas
- ✅ Colunas usadas em WHERE/JOIN sempre indexadas
- ✅ Coluna de busca (`name`, `title`, `email`) indexada se busca frequente
- ✅ Índices compostos se queries usem múltiplas colunas frequentemente
- ❌ Não indexar tudo; ser seletivo para evitar overhead

### RLS e Policies

- ✅ Tabelas PRIVADAS obrigatoriamente com RLS ativado
- ✅ Policies explícitas para cada operação (SELECT, INSERT, UPDATE, DELETE)
- ✅ Policies devem referenciar `auth.uid()` ou roles
- ✅ Policy SELECT é mais comum; UPDATE/DELETE mais restritivas
- ✅ Roles administrativas podem ter policies menos restritivas
- ❌ Tabela privada sem RLS = RISCO DE SEGURANÇA

### Triggers

- ✅ Trigger `updated_at` em toda tabela que precisar tracking
- ✅ Trigger de auditoria em tabelas críticas (usuários, pagamentos, etc.)
- ✅ Trigger para manter constraints dinâmicas se necessário

---

## Checklist antes de escrever migration

- [ ] Identifiquei qual tabela vai ser criada/alterada?
- [ ] A tabela é pública ou privada?
- [ ] Se privada, qual regra de acesso (por user_id, por role, por status)?
- [ ] Quais campos são obrigatórios?
- [ ] Existe chave estrangeira? Precisa de ON DELETE?
- [ ] Qual coluna ser indexada para performance?
- [ ] Tabela precisa de updated_at tracking?
- [ ] Preciso de constraints especiais (UNIQUE, CHECK)?
- [ ] Preciso de RLS? Quais policies?
- [ ] Existe triggerauditoria necessária?
- [ ] A migration é idempotente (não quebra se rodar 2x)?

---

## Padrão de RLS por tipo de tabela

### Tabela de usuário privada

```sql
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus dados
CREATE POLICY "usuarios_select_own"
  ON usuarios FOR SELECT
  USING (auth.uid() = id);

-- Usuário atualiza apenas seus dados
CREATE POLICY "usuarios_update_own"
  ON usuarios FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin consegue ler tudo (com extra check se necessário)
-- CREATE POLICY "usuarios_admin_select"
--   ON usuarios FOR SELECT
--   USING (auth.jwt() -> 'custom_claims' ->> 'is_admin' = 'true');
```

### Tabela de dados de negócio (orders, products, etc.)

```sql
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus pedidos
CREATE POLICY "pedidos_select_own"
  ON pedidos FOR SELECT
  USING (auth.uid() = user_id);

-- Usuário não consegue inserir/atualizar/deletar (backend faz)
-- (ou policies mais permissivas só para operações específicas)

-- Admin consegue ver tudo
-- (definir policy admin se necessário)
```

### Tabela pública (não precisa RLS)

Exemplo: `produtos` lista pública, `categorias`, `faq`

```sql
-- SEM RLS
-- Acesso público é controlado pelo frontend/regra de negócio
-- Não é tabela privada
```

---

## Anti-padrões a evitar

❌ **NÃO FAÇA:**

- Criar tabela privada sem RLS ativado
- Usar UUID sem `uuid_generate_v4()` ou referência válida
- Foreign key sem constraint apropriada
- Esquecer `created_at` e `updated_at` em tabelas
- Indexar colunas que nunca serão usadas em query
- Deixar trigger `updated_at` sem executar função correta
- Policy RLS que assume dados vindo do frontend (sempre revalidar)
- Constraint CHECK sem validar logicamente
- Coluna com default incoerente com tipo (ex: default NULL em NOT NULL)
- Abandonar migration versionada e editar schema manual

---

## Estrutura de migrations no projeto

Padrão esperado:

```
supabase/
  migrations/
    20250101000000_initial_schema.sql
    20250102000000_add_rls_policies.sql
    20250103000000_add_audit_log.sql
    ...
```

Cada migrations deve ser **autossuficiente** e **idempotente** (não quebra se rodada 2x):

```sql
-- Use IF NOT EXISTS, IF EXISTS para segurança
CREATE TABLE IF NOT EXISTS tabela (...);
DROP POLICY IF EXISTS "policy_name" ON tabela;
```

---

## Resultado esperado ao usar esta skill

- ✅ Migration SQL criada com versionamento
- ✅ Tabelas com id, created_at, updated_at
- ✅ Índices em foreign keys e colunas críticas
- ✅ RLS ativado e policies corretas em tabelas privadas
- ✅ Triggers para updated_at
- ✅ Constraints e foreign keys bem definidos
- ✅ Migration testada localmente antes de commit
- ✅ Documentação clara sobre o que a migration faz

---

## Exemplo prático: criar tabela de pedidos

```sql
-- Migration: 20250414000001_create_orders_table.sql
-- Propósito: criar tabela de pedidos com RLS

BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  stripe_session_id TEXT UNIQUE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Trigger para updated_at
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: tabela privada
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus pedidos
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Admin pode ver todos (quando implementado)
-- CREATE POLICY "orders_select_admin"
--   ON orders FOR SELECT
--   USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

COMMIT;
```

---

## Checklist final

- [ ] Criei migration em `supabase/migrations/`?
- [ ] Migrations tem nome com timestamp?
- [ ] Consultei docs/04-banco-dados.md?
- [ ] Tabelas privadas com RLS ativado?
- [ ] Foreign keys com constraint apropriada?
- [ ] Índices em foreign keys e colunas críticas?
- [ ] Triggers `updated_at` onde aplicável?
- [ ] Policies RLS explícitas e seguras?
- [ ] Migration é idempotente?
- [ ] Testei localmente antes de commit?
- [ ] Documentei o propósito da migration?

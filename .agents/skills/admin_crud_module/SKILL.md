# Skill: Admin CRUD Module

## Propósito

Padronizar a criação de módulos CRUD no painel administrativo, garantindo listagem, filtros, busca, formulário de criação/edição, confirmações e segurança em ações críticas.

**Objetivo:** garantir que toda funcionalidade admin (usuários, produtos, pedidos, etc.) seja operável, segura, auditável e consistente em UX.

---

## Quando usar esta skill

Use **Admin CRUD Module** quando:

- precisar **criar módulo admin** para gerenciar entidade (usuários, produtos, pedidos, etc.)
- precisar **listar dados** com paginação, filtros e busca
- precisar **criar/editar/deletar** registros de forma segura
- precisar **gerenciar usuários** (criar, editar, bloquear, alterar role)
- precisar **confirmar ações críticas** (deleção, alteração de role, bloqueio)
- precisar **auditar ações** administrativas
- precisar **filtrar por role, status, data, etc.**
- tiver dúvida sobre **fluxo seguro ou UX** do admin

---

## ⚠️ AVISO CRÍTICO: Gestão de usuários é área de alta sensibilidade

**Gestão de usuários = risco segurança máximo**

Regras obrigatórias:

- ✅ Toda ação (criar, editar, role, bloquear, deletar) precisa auditoria
- ✅ Alteração de role precisa confirmação visual e log
- ✅ Deleção de usuário = soft delete (marcar como deleted, não remover)
- ✅ Admin não pode remover a si próprio sem proteção extra
- ✅ Mudança de email/senha = validação extra
- ✅ Bloqueio/desbloqueio = exigir motivo e auditar
- ✅ Senhas nunca devem ser vistas, apenas resetadas pelo backend
- ✅ Qualquer alteração de usuário pode exigir MFA/confirmação de segurança

---

## Documentos obrigatórios a consultar

Na ordem de prioridade:

1. **docs/09-admin.md** — páginas, fluxos e funcionalidades admin
2. **docs/10-autenticacao-seguranca.md** — autorização, auditoria, segurança
3. **docs/04-banco-dados.md** — estrutura, campos, relacionamentos
4. **docs/05-backend-edge-functions.md** — operações críticas no backend
5. **docs/07-ui-ux.md** — padrões visual e de interação

---

## Arquitetura de módulo CRUD admin

### Estrutura de pastas

```
src/
  pages/
    admin/
      <entity>/
        index.tsx           # Página principal com listagem
        [id]/
          edit.tsx          # Página de edição
        new.tsx             # Página de criação
        
  components/
    admin/
      <entity>/
        <EntityList.tsx     # Componente de listagem
        <EntityForm.tsx     # Componente de formulário
        <EntityActions.tsx  # Ações bulk (deletar, etc.)
        
  hooks/
    use<Entity>Query.ts     # Query de listagem
    use<Entity>Mutation.ts  # Mutations (create, update, delete)
```

---

## Componente 1: Listagem com filtros e busca

### Requisitos

```typescript
interface ListEntityProps {
  // Paginação
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  
  // Filtros
  filters: {
    status?: string;
    role?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
  onFiltersChange: (filters: any) => void;
  
  // Busca
  searchText: string;
  onSearchChange: (text: string) => void;
  
  // Dados
  data: Entity[];
  isLoading: boolean;
  error?: Error;
  totalCount: number;
}
```

### Estrutura esperada

```tsx
export function EntityList({ 
  page, 
  pageSize, 
  onPageChange,
  filters,
  onFiltersChange,
  searchText,
  onSearchChange,
  data,
  isLoading,
  totalCount,
}: ListEntityProps) {
  return (
    <div className="space-y-4">
      {/* Barra de filtros e busca */}
      <div className="flex gap-2">
        <Input
          placeholder="Buscar..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={isLoading}
        />
        
        <Select value={filters.status} onValueChange={(v) => onFiltersChange({...filters, status: v})}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
            <SelectItem value="banned">Banido</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Mais filtros conforme necessário */}
      </div>

      {/* Tabela de resultados */}
      {isLoading && <Loader />}
      
      {!isLoading && data.length === 0 && (
        <EmptyState message="Nenhum registro encontrado" />
      )}
      
      {!isLoading && data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell>{entity.id}</TableCell>
                  <TableCell>{entity.name}</TableCell>
                  <TableCell>{entity.email}</TableCell>
                  <TableCell>
                    <Badge variant={entity.status === 'active' ? 'default' : 'secondary'}>
                      {entity.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(entity.created_at)}</TableCell>
                  <TableCell>
                    <EntityActions entity={entity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Paginação */}
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
```

### Padrões obrigatórios

- ✅ Campo de busca sempre visível
- ✅ Filtros por status, role, data (conforme tipo entidade)
- ✅ Paginação clara (current page, total, page size)
- ✅ Loader enquanto buscando dados
- ✅ Empty state quando zero resultados
- ✅ Timestamp de criação e atualização
- ✅ Ações na coluna final (editar, deletar, mais)

---

## Componente 2: Formulário de criação/edição

### Requisitos

```typescript
interface EntityFormProps {
  entity?: Entity;
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (data: EntityInput) => Promise<void>;
  onCancel: () => void;
}
```

### Estrutura esperada

```tsx
export function EntityForm({
  entity,
  isLoading,
  isSubmitting,
  onSubmit,
  onCancel,
}: EntityFormProps) {
  const [form, setForm] = useState<EntityInput>(entity || defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação client-side
    const validation = validateEntityInput(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    // Backend valida novamente antes de aceitar
    try {
      await onSubmit(form);
      toast.success(entity ? "Atualizado com sucesso" : "Criado com sucesso");
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Campos do formulário */}
      
      <FormField>
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={isSubmitting}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && <ErrorMessage id="name-error">{errors.name}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          disabled={isSubmitting}
          aria-invalid={!!errors.email}
        />
        {errors.email && <ErrorMessage>{errors.email}</ErrorMessage>}
      </FormField>

      {/* Campo crítico: Role (apenas admin pode alterar) */}
      {isAdmin && (
        <FormField>
          <Label htmlFor="role">Função</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger id="role" disabled={isSubmitting}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="affiliate">Afiliado</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Aviso se alterando role */}
          {entity && entity.role !== form.role && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Aviso</AlertTitle>
              <AlertDescription>
                Você está alterando a função deste usuário. Esta ação será auditada.
              </AlertDescription>
            </Alert>
          )}
        </FormField>
      )}

      {/* Botões de ação */}
      <div className="flex gap-2">
        <Button 
          type="submit" 
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {entity ? "Atualizar" : "Criar"}
        </Button>
        <Button 
          type="button" 
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
```

### Padrões obrigatórios

- ✅ Campos obrigatórios marcados com `*`
- ✅ Validação client-side com feedback imediato
- ✅ Backend revalida todos os campos
- ✅ Campos sensíveis com avisos visuais (role, status, email)
- ✅ Loader e disabled state durante submit
- ✅ Cancelar volta sem salvar
- ✅ Mensagem de sucesso/erro clara

---

## Componente 3: Ações críticas com confirmação

### Requisitos para operações sensíveis

```tsx
// Exemplo: Alterar role
async function handleRoleChange(userId: string, newRole: string) {
  // 1. Confirmar ação visualmente
  const confirmed = await ConfirmDialog.show({
    title: "Alterar função do usuário",
    description: `Você está alterando a função de ${user.name} para "${newRole}". Esta ação será auditada.`,
    confirmText: "Alterar",
    cancelText: "Cancelar",
    isDangerous: true, // Highlight em vermelho
  });

  if (!confirmed) return;

  // 2. Executar no backend
  try {
    await updateUserRole(userId, newRole);
    toast.success("Função alterada com sucesso");
    refetchUser();
  } catch (error) {
    toast.error(`Erro ao alterar função: ${error.message}`);
  }
}

// Exemplo: Deletar usuário
async function handleDeleteUser(userId: string) {
  const confirmed = await ConfirmDialog.show({
    title: "Deletar usuário?",
    description: `Tem certeza que deseja deletar ${user.name}? Esta ação não pode ser desfeita.`,
    confirmText: "Deletar",
    cancelText: "Cancelar",
    isDangerous: true,
    requiresInput: true, // Exigir digitar "CONFIRMAR"
    inputPlaceholder: "Digite CONFIRMAR para prosseguir",
  });

  if (!confirmed) return;

  try {
    await deleteUser(userId);
    toast.success("Usuário deletado");
    router.push("/admin/users");
  } catch (error) {
    toast.error(`Erro: ${error.message}`);
  }
}

// Exemplo: Bloquear usuário
async function handleBanUser(userId: string, reason: string) {
  const confirmed = await ConfirmDialog.show({
    title: "Bloquear usuário?",
    description: `Você está bloqueando ${user.name}. O motivo será registrado: "${reason}"`,
    confirmText: "Bloquear",
    cancelText: "Cancelar",
    isDangerous: true,
  });

  if (!confirmed) return;

  try {
    await banUser(userId, { reason });
    toast.success("Usuário bloqueado");
    refetchUser();
  } catch (error) {
    toast.error(`Erro: ${error.message}`);
  }
}
```

### Padrões obrigatórios

- ✅ Confirmação visual antes de ação irreversível
- ✅ Descrição clara do que vai acontecer
- ✅ Botão "Confirmar" marcado em vermelho (isDangerous)
- ✅ Para deleção: exigir input confirmation ("CONFIRMAR")
- ✅ Motivo/contexto deve ser registrado
- ✅ Ação auditada no backend

---

## Edge Function para ação admin crítica

### Padrão esperado

```typescript
// supabase/functions/admin-update-user-role/index.ts
const { userId, newRole, reason } = await req.json();

// 1. Validar admin
const admin = await requireAuth(req);
if (admin.role !== "admin") {
  return handleError("Admin only", 403);
}

// 2. Validar que admin não está alterando a si próprio sem cuidado
if (userId === admin.id && newRole !== admin.role) {
  // Poderia exigir segunda confirmação, MFA, etc.
  return handleError("Cannot change own role", 400);
}

// 3. Validar novo role é válido
if (!["user", "admin", "affiliate"].includes(newRole)) {
  return handleError("Invalid role", 400);
}

// 4. Atualizar no banco
const result = await db
  .from("profiles")
  .update({ role: newRole })
  .eq("id", userId);

// 5. Auditar
await logAudit({
  user_id: admin.id,
  action: "admin_user_role_changed",
  target_type: "user",
  target_id: userId,
  details: { new_role: newRole, reason },
  status: "success",
});

return new Response(JSON.stringify({ success: true }), { status: 200 });
```

---

## Checklist para criar módulo CRUD admin

- [ ] Consultei docs/09-admin.md?
- [ ] Consultei docs/10-autenticacao-seguranca.md?
- [ ] Criei página de listagem com paginação?
- [ ] Criei filtros por status, role, data?
- [ ] Criei campo de busca?
- [ ] Criei página de criação?
- [ ] Criei página de edição?
- [ ] Validei que operação crítica tem confirmação visual?
- [ ] Criei Edge Function para ação sensível?
- [ ] Auditei ações de gestão de usuários?
- [ ] Evitei deixar admin remover a si próprio?
- [ ] Exibi avisos para alteração de role?
- [ ] Testei com dados reais?
- [ ] Validei segurança em 3 camadas?

---

## Anti-padrões a evitar

❌ **NÃO FAÇA:**

- Deletar usuário sem soft-delete strategy
- Alterar role sem confirmação visual
- Permitir admin remover a si próprio
- Deixar ação crítica sem auditoria
- Mostrar senha de usuário
- Permitir busca/filtro sem limit (evitar data exfiltration)
- Deixar formulário sem validação client-side
- Fazer ação crítica sem Edge Function
- Omitir motivo/contexto de ação administrativa
- Não logar tentativas falhadas

---

## Resultado esperado ao usar esta skill

- ✅ Módulo CRUD completo (listagem, criação, edição, deleção)
- ✅ Listagem com paginação, filtros e busca
- ✅ Formulário validado client-side e backend
- ✅ Ações críticas com confirmação visual
- ✅ Edge Functions para operações sensíveis
- ✅ Auditoria completa de ações administrativas
- ✅ Segurança especial para gestão de usuários
- ✅ Experiência admin profissional e consistente

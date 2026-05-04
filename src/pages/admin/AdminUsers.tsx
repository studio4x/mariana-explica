import { useDeferredValue, useMemo, useState, type FormEvent } from "react"
import { KeyRound, RefreshCw, Trash2, UserPlus, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
  useUpdateAdminUserPassword,
} from "@/hooks/useAdmin"
import type { AdminUserSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"
import { cn } from "@/lib/cn"

type UserRoleFilter = AdminUserSummary["role"] | "all"
type UserStatusFilter = AdminUserSummary["status"] | "all"

interface UserFormState {
  fullName: string
  email: string
  password: string
  role: AdminUserSummary["role"]
  status: AdminUserSummary["status"]
  notificationsEnabled: boolean
  marketingConsent: boolean
}

const defaultCreateState: UserFormState = {
  fullName: "",
  email: "",
  password: "",
  role: "student",
  status: "active",
  notificationsEnabled: true,
  marketingConsent: false,
}

function roleLabel(role: AdminUserSummary["role"]) {
  if (role === "admin") return "Admin"
  if (role === "affiliate") return "Afiliado"
  return "Aluno"
}

function roleTone(role: AdminUserSummary["role"]) {
  if (role === "admin") return "border-sky-200 bg-sky-50 text-sky-700"
  if (role === "affiliate") return "border-violet-200 bg-violet-50 text-violet-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function statusLabel(status: AdminUserSummary["status"]) {
  if (status === "pending_review") return "Em revisao"
  if (status === "blocked") return "Bloqueado"
  if (status === "inactive") return "Inativo"
  return "Ativo"
}

function statusTone(status: AdminUserSummary["status"]) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "pending_review") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-slate-100 text-slate-700"
}

function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDateTime(value) : "Sem registo"
}

function UserModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-white shadow-[0_32px_80px_rgba(15,23,42,0.26)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#15323b]">{title}</h2>
            <p className="mt-1 text-sm font-medium text-[#6d7a80]">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#5F7077] transition hover:bg-[#F2F7F9] hover:text-[#15323b]"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

function UserField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">{label}</span>
      {children}
    </label>
  )
}

export function AdminUsers() {
  const usersQuery = useAdminUsers()
  const createUser = useCreateAdminUser()
  const updateUser = useUpdateAdminUser()
  const updateUserPassword = useUpdateAdminUserPassword()
  const deleteUser = useDeleteAdminUser()

  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all")
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all")
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null)
  const [passwordUser, setPasswordUser] = useState<AdminUserSummary | null>(null)
  const [createState, setCreateState] = useState<UserFormState>(defaultCreateState)
  const [editState, setEditState] = useState<UserFormState | null>(null)
  const [passwordDraft, setPasswordDraft] = useState({ password: "", confirmPassword: "" })
  const deferredQuery = useDeferredValue(query)

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = roleFilter === "all" ? true : user.role === roleFilter
      const matchesStatus = statusFilter === "all" ? true : user.status === statusFilter
      const matchesQuery = !normalizedQuery
        ? true
        : [
            user.full_name,
            user.email,
            user.nif,
            user.role,
            statusLabel(user.status),
            user.id,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)

      return matchesRole && matchesStatus && matchesQuery
    })
  }, [users, roleFilter, statusFilter, normalizedQuery])

  const metrics = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      students: users.filter((user) => user.role === "student").length,
      affiliates: users.filter((user) => user.role === "affiliate").length,
      blocked: users.filter((user) => user.status === "blocked").length,
    }),
    [users],
  )

  const openEditModal = (user: AdminUserSummary) => {
    setEditingUser(user)
    setEditState({
      fullName: user.full_name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
      notificationsEnabled: user.notifications_enabled,
      marketingConsent: user.marketing_consent,
    })
  }

  const resetCreateModal = () => {
    setCreateState(defaultCreateState)
    setIsCreateOpen(false)
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setEditState(null)
  }

  const closePasswordModal = () => {
    setPasswordUser(null)
    setPasswordDraft({ password: "", confirmPassword: "" })
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)

    try {
      await createUser.mutateAsync({
        fullName: createState.fullName,
        email: createState.email,
        password: createState.password,
        role: createState.role,
      })

      if (createState.status !== "active" || !createState.notificationsEnabled || createState.marketingConsent) {
        const newestUser = [...(usersQuery.data ?? [])].find(
          (user) => user.email.toLowerCase() === createState.email.trim().toLowerCase(),
        )
        if (newestUser) {
          await updateUser.mutateAsync({
            userId: newestUser.id,
            status: createState.status,
            notificationsEnabled: createState.notificationsEnabled,
            marketingConsent: createState.marketingConsent,
          })
        }
      }

      setFeedback({ tone: "success", message: "Utilizador criado com sucesso." })
      resetCreateModal()
      void usersQuery.refetch()
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel criar o utilizador.",
      })
    }
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser || !editState) return

    setFeedback(null)
    try {
      await updateUser.mutateAsync({
        userId: editingUser.id,
        fullName: editState.fullName,
        email: editState.email,
        role: editState.role,
        status: editState.status,
        notificationsEnabled: editState.notificationsEnabled,
        marketingConsent: editState.marketingConsent,
      })
      setFeedback({ tone: "success", message: `Dados de ${editingUser.full_name} atualizados.` })
      closeEditModal()
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar o utilizador.",
      })
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passwordUser) return

    setFeedback(null)

    if (passwordDraft.password.trim().length < 8) {
      setFeedback({ tone: "error", message: "A nova senha deve ter pelo menos 8 caracteres." })
      return
    }

    if (passwordDraft.password !== passwordDraft.confirmPassword) {
      setFeedback({ tone: "error", message: "As senhas nao coincidem." })
      return
    }

    try {
      await updateUserPassword.mutateAsync({
        userId: passwordUser.id,
        password: passwordDraft.password,
      })
      setFeedback({ tone: "success", message: `Senha redefinida para ${passwordUser.full_name}.` })
      closePasswordModal()
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel redefinir a senha.",
      })
    }
  }

  const handleDelete = async (user: AdminUserSummary) => {
    if (user.status === "inactive") {
      setFeedback({ tone: "error", message: `${user.full_name} ja esta excluido.` })
      return
    }

    if (
      !window.confirm(
        `Excluir ${user.full_name}?\n\nEsta acao remove a conta do Supabase Auth, revoga acessos ativos e anonimiza o perfil.`,
      )
    ) {
      return
    }

    setFeedback(null)
    try {
      await deleteUser.mutateAsync(user.id)
      setFeedback({ tone: "success", message: `${user.full_name} foi excluido com sucesso.` })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : `Nao foi possivel excluir ${user.full_name}.`,
      })
    }
  }

  if (usersQuery.isLoading) {
    return <LoadingState message="A carregar utilizadores..." />
  }

  if (usersQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os utilizadores"
        message={usersQuery.error instanceof Error ? usersQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void usersQuery.refetch()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-7 rounded-[32px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
        <header className="flex flex-col gap-3 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#1398B7]">Admin / Usuarios</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#15323b]">
              Usuarios e Regras
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-[#6d7a80]">
              Cadastre alunos, afiliados e admins, acompanhe validacao de email, estado de conta e acoes sensiveis em um unico fluxo operacional.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]"
              onClick={() => setIsCreateOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Novo usuario
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]"
              onClick={() => void usersQuery.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar lista
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-[26px] border border-[#D8E6EB] bg-[#F2F7F9] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Usuarios</p>
            <p className="mt-3 text-3xl font-black text-[#15323b]">{metrics.total}</p>
          </article>
          <article className="rounded-[26px] border border-[#D9F0F5] bg-[#E8F6FA] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1398B7]">Admins</p>
            <p className="mt-3 text-3xl font-black text-[#0A3640]">{metrics.admins}</p>
          </article>
          <article className="rounded-[26px] border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Alunos</p>
            <p className="mt-3 text-3xl font-black text-emerald-800">{metrics.students}</p>
          </article>
          <article className="rounded-[26px] border border-violet-100 bg-violet-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">Afiliados</p>
            <p className="mt-3 text-3xl font-black text-violet-800">{metrics.affiliates}</p>
          </article>
          <article className="rounded-[26px] border border-rose-100 bg-rose-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">Bloqueados</p>
            <p className="mt-3 text-3xl font-black text-rose-800">{metrics.blocked}</p>
          </article>
        </section>

        <section className="grid gap-5">
          <div className="self-start rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="block">
                <span className="sr-only">Buscar usuario</span>
                <input
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-semibold text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                  placeholder="Buscar por nome, e-mail, ID ou regra"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="sr-only">Filtrar por papel</span>
                <select
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-black text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as UserRoleFilter)}
                >
                  <option value="all">Todos os papeis</option>
                  <option value="admin">Admins</option>
                  <option value="student">Alunos</option>
                  <option value="affiliate">Afiliados</option>
                </select>
              </label>
              <label className="block">
                <span className="sr-only">Filtrar por estado</span>
                <select
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-black text-[#163138] outline-none transition focus:border-[#1398B7] focus:ring-4 focus:ring-[#1398B7]/10"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}
                >
                  <option value="all">Todos os estados</option>
                  <option value="active">Ativos</option>
                  <option value="blocked">Bloqueados</option>
                  <option value="pending_review">Em revisao</option>
                  <option value="inactive">Inativos</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {feedback ? (
          <div
            className={cn(
              "rounded-[24px] border px-5 py-4 text-sm font-medium shadow-sm",
              feedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            )}
          >
            {feedback.message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-sm">
          <div className="border-b border-[#D8E6EB] px-5 py-4">
            <p className="text-sm font-bold text-[#6d7a80]">{filteredUsers.length} usuario(s) encontrado(s)</p>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Sem utilizadores nesta filtragem"
                message="Ajuste busca e filtros para encontrar a conta pretendida."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-[#F2F7F9]/90 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#5F7077]">Usuario</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#5F7077]">Contato</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#5F7077]">Papel</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#5F7077]">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#5F7077]">Atividade</th>
                    <th className="w-[240px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-[#5F7077]">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[#EDF4F6] align-top transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-4 text-sm text-[#15323b]">
                        <div className="min-w-[220px] space-y-1">
                          <p className="font-display text-[15px] font-semibold text-[#15323b]">{user.full_name}</p>
                          <p className="text-xs text-[#6d7a80]">Criado em {formatDateTime(user.created_at)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#15323b]">
                        <div className="min-w-[220px] space-y-1 text-xs text-[#6d7a80]">
                          <p>{user.email}</p>
                          <p>{user.phone?.trim() ? user.phone : "Sem telefone"}</p>
                          <p>{user.nif?.trim() ? `NIF: ${user.nif}` : "Sem NIF"}</p>
                          <p>auth: {user.id.slice(0, 8)}...</p>
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                              user.email_verified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {user.email_verified ? "Email validado" : "Email pendente"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#15323b]">
                        <div className="space-y-2">
                          <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium", roleTone(user.role))}>
                            {roleLabel(user.role)}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {user.notifications_enabled ? (
                              <span className="inline-flex rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-medium text-[#15803d]">
                                Notificacoes
                              </span>
                            ) : null}
                            {user.marketing_consent ? (
                              <span className="inline-flex rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 text-[11px] font-medium text-[#1d4ed8]">
                                Marketing
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                user.content_updates_consent
                                  ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
                                  : "border-slate-200 bg-slate-100 text-slate-600",
                              )}
                            >
                              {user.content_updates_consent ? "Quer novidades" : "Sem novidades"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#15323b]">
                        <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium", statusTone(user.status))}>
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#15323b]">
                        <div className="min-w-[180px] space-y-1 text-xs text-[#6d7a80]">
                          <p>Ultimo login: {formatOptionalDate(user.last_login_at)}</p>
                          <p>Validacao: {user.email_verified_at ? formatDateTime(user.email_verified_at) : "Pendente"}</p>
                          <p>ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="w-[240px] px-4 py-4 text-right text-sm text-[#15323b]">
                        <div className="flex min-w-[260px] justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-[#D8E6EB] bg-white/90 px-4 text-xs text-[#15323b] hover:bg-[#F2F7F9]"
                            onClick={() => openEditModal(user)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-[#D8E6EB] bg-white/90 px-4 text-xs text-[#15323b] hover:bg-[#F2F7F9]"
                            onClick={() => setPasswordUser(user)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Senha
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-rose-200 bg-rose-50 px-4 text-xs text-rose-700 hover:bg-rose-100"
                            onClick={() => void handleDelete(user)}
                            disabled={deleteUser.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <UserModal
        open={isCreateOpen}
        title="Novo usuario"
        description="Crie manualmente um novo acesso administrativo ou operacional."
        onClose={resetCreateModal}
      >
        <form className="space-y-5" onSubmit={(event) => void handleCreate(event)}>
          <div className="grid gap-4 md:grid-cols-2">
            <UserField label="Nome completo">
              <input
                value={createState.fullName}
                onChange={(event) => setCreateState((current) => ({ ...current, fullName: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                placeholder="Nome completo"
              />
            </UserField>
            <UserField label="Email">
              <input
                value={createState.email}
                onChange={(event) => setCreateState((current) => ({ ...current, email: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                placeholder="email@dominio.com"
              />
            </UserField>
            <UserField label="Senha inicial">
              <input
                type="password"
                value={createState.password}
                onChange={(event) => setCreateState((current) => ({ ...current, password: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                placeholder="Minimo 8 caracteres"
              />
            </UserField>
            <UserField label="Papel">
              <select
                value={createState.role}
                onChange={(event) => setCreateState((current) => ({ ...current, role: event.target.value as AdminUserSummary["role"] }))}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
              >
                <option value="student">Aluno</option>
                <option value="affiliate">Afiliado</option>
                <option value="admin">Admin</option>
              </select>
            </UserField>
            <UserField label="Estado inicial">
              <select
                value={createState.status}
                onChange={(event) => setCreateState((current) => ({ ...current, status: event.target.value as AdminUserSummary["status"] }))}
                className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
              >
                <option value="active">Ativo</option>
                <option value="pending_review">Em revisao</option>
                <option value="blocked">Bloqueado</option>
                <option value="inactive">Inativo</option>
              </select>
            </UserField>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#15323b]">
              <input
                type="checkbox"
                checked={createState.notificationsEnabled}
                onChange={(event) => setCreateState((current) => ({ ...current, notificationsEnabled: event.target.checked }))}
              />
              Receber notificacoes da plataforma
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#15323b]">
              <input
                type="checkbox"
                checked={createState.marketingConsent}
                onChange={(event) => setCreateState((current) => ({ ...current, marketingConsent: event.target.checked }))}
              />
              Aceitar comunicacoes de marketing
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#D8E6EB] pt-5">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={resetCreateModal}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]" disabled={createUser.isPending}>
              {createUser.isPending ? "A criar..." : "Criar usuario"}
            </Button>
          </div>
        </form>
      </UserModal>

      <UserModal
        open={Boolean(editingUser && editState)}
        title={editingUser ? `Editar ${editingUser.full_name}` : "Editar usuario"}
        description="Ajuste papel, estado e preferencias sem sair da fila operacional."
        onClose={closeEditModal}
      >
        {editingUser && editState ? (
          <form className="space-y-5" onSubmit={(event) => void handleEdit(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <UserField label="Nome completo">
                <input
                  value={editState.fullName}
                  onChange={(event) => setEditState((current) => (current ? { ...current, fullName: event.target.value } : current))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                />
              </UserField>
              <UserField label="Email">
                <input
                  value={editState.email}
                  onChange={(event) => setEditState((current) => (current ? { ...current, email: event.target.value } : current))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                />
              </UserField>
              <UserField label="Papel">
                <select
                  value={editState.role}
                  onChange={(event) => setEditState((current) => (current ? { ...current, role: event.target.value as AdminUserSummary["role"] } : current))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                >
                  <option value="student">Aluno</option>
                  <option value="affiliate">Afiliado</option>
                  <option value="admin">Admin</option>
                </select>
              </UserField>
              <UserField label="Estado">
                <select
                  value={editState.status}
                  onChange={(event) => setEditState((current) => (current ? { ...current, status: event.target.value as AdminUserSummary["status"] } : current))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                >
                  <option value="active">Ativo</option>
                  <option value="pending_review">Em revisao</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="inactive">Inativo</option>
                </select>
              </UserField>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#15323b]">
                <input
                  type="checkbox"
                  checked={editState.notificationsEnabled}
                  onChange={(event) => setEditState((current) => (current ? { ...current, notificationsEnabled: event.target.checked } : current))}
                />
                Receber notificacoes da plataforma
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#15323b]">
                <input
                  type="checkbox"
                  checked={editState.marketingConsent}
                  onChange={(event) => setEditState((current) => (current ? { ...current, marketingConsent: event.target.checked } : current))}
                />
                Aceitar comunicacoes de marketing
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#D8E6EB] pt-5">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={closeEditModal}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]" disabled={updateUser.isPending}>
                {updateUser.isPending ? "A guardar..." : "Guardar alteracoes"}
              </Button>
            </div>
          </form>
        ) : null}
      </UserModal>

      <UserModal
        open={Boolean(passwordUser)}
        title={passwordUser ? `Redefinir senha de ${passwordUser.full_name}` : "Redefinir senha"}
        description="Define uma nova senha manualmente para devolver o acesso sem depender do fluxo de recuperacao."
        onClose={closePasswordModal}
      >
        {passwordUser ? (
          <form className="space-y-5" onSubmit={(event) => void handlePasswordSubmit(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <UserField label="Nova senha">
                <input
                  type="password"
                  value={passwordDraft.password}
                  onChange={(event) => setPasswordDraft((current) => ({ ...current, password: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Minimo 8 caracteres"
                />
              </UserField>
              <UserField label="Confirmar senha">
                <input
                  type="password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Repita a nova senha"
                />
              </UserField>
            </div>

            <div className="rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#5F7077]">
              Esta acao atualiza a senha diretamente no Supabase Auth e fica auditada como operacao sensivel do admin.
            </div>

            <div className="flex justify-end gap-3 border-t border-[#D8E6EB] pt-5">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={closePasswordModal}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]" disabled={updateUserPassword.isPending}>
                {updateUserPassword.isPending ? "A atualizar..." : "Atualizar senha"}
              </Button>
            </div>
          </form>
        ) : null}
      </UserModal>
    </div>
  )
}

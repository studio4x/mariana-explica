import { useState, type FormEvent } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "@/hooks/useAdmin"
import type { AdminUserSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

export function AdminUsers() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AdminUserSummary["role"]>("student")
  const usersQuery = useAdminUsers()
  const createUser = useCreateAdminUser()
  const updateUser = useUpdateAdminUser()
  const deleteUser = useDeleteAdminUser()

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await createUser.mutateAsync({ fullName, email, password, role })
    setFullName("")
    setEmail("")
    setPassword("")
    setRole("student")
  }

  if (usersQuery.isLoading) {
    return <LoadingState message="Carregando usuários..." />
  }

  if (usersQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os usuários"
        message={usersQuery.error instanceof Error ? usersQuery.error.message : "Tente novamente em instantes."}
        onRetry={() => void usersQuery.refetch()}
      />
    )
  }

  const users = usersQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Criação manual, alteração de role/status e soft delete."
      />

      <form onSubmit={handleCreate} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Criar usuário</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome completo" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <select value={role} onChange={(event) => setRole(event.target.value as AdminUserSummary["role"])} className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white">
            <option value="student">student</option>
            <option value="affiliate">affiliate</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button type="submit" className="mt-4" disabled={createUser.isPending}>
          {createUser.isPending ? "Criando..." : "Criar usuário"}
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState
          title="Sem usuários"
          message="Os perfis criados e sincronizados com auth aparecem aqui."
        />
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">{user.full_name}</h2>
                    <StatusBadge label={user.role} tone={user.role === "admin" ? "danger" : user.role === "affiliate" ? "info" : "neutral"} />
                    <StatusBadge label={user.status} tone={user.status === "active" ? "success" : "warning"} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{user.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Criado em {formatDateTime(user.created_at)} · Último login {formatDateTime(user.last_login_at)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:w-[520px]">
                  <select
                    value={user.role}
                    onChange={(event) =>
                      void updateUser.mutateAsync({ userId: user.id, role: event.target.value as AdminUserSummary["role"] })
                    }
                    className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                  >
                    <option value="student">student</option>
                    <option value="affiliate">affiliate</option>
                    <option value="admin">admin</option>
                  </select>
                  <select
                    value={user.status}
                    onChange={(event) =>
                      void updateUser.mutateAsync({ userId: user.id, status: event.target.value as AdminUserSummary["status"] })
                    }
                    className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="blocked">blocked</option>
                    <option value="pending_review">pending_review</option>
                  </select>
                  <Button variant="outline" onClick={() => void deleteUser.mutateAsync(user.id)} disabled={deleteUser.isPending}>
                    Soft delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useDeferredValue, useState, type FormEvent } from "react"
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
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
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

  const users = usersQuery.data ?? []
  const q = deferredQuery.trim().toLowerCase()
  const filteredUsers = !q
    ? users
    : users.filter((user) =>
        [user.full_name, user.email, user.role, user.status].join(" ").toLowerCase().includes(q),
      )
  const adminCount = users.filter((user) => user.role === "admin").length
  const blockedCount = users.filter((user) => user.status === "blocked").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizadores"
        description="Criacao manual, alteracao de papel e controlo de estado com leitura operacional mais segura."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total de utilizadores</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{users.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Admins</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{adminCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Bloqueados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{blockedCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form onSubmit={handleCreate} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Criacao controlada</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Criar utilizador</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Usa esta area para criacao manual quando o fluxo operacional pedir intervencao do admin.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nome completo" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Palavra-passe inicial" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
            <select value={role} onChange={(event) => setRole(event.target.value as AdminUserSummary["role"])} className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white">
              <option value="student">Aluno</option>
              <option value="affiliate">Afiliado</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" className="mt-4 rounded-full" disabled={createUser.isPending}>
            {createUser.isPending ? "A criar..." : "Criar utilizador"}
          </Button>
        </form>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Governanca</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Boas praticas</h2>
          <div className="mt-5 grid gap-3">
            {[
              "Reve papeis com cuidado. Role e estado impactam acesso e operacao.",
              "Bloqueio deve ser usado quando e preciso interromper acesso sem apagar o historico.",
              "Criacao manual deve ser excecao; perfis sincronizados via auth continuam a ser o fluxo principal.",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50/80 p-4 text-sm leading-7 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Lista de utilizadores</h2>
            <p className="mt-1 text-sm text-slate-600">Pesquisa rapida por nome, email, papel ou estado.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar..."
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:w-72"
          />
        </div>

        {filteredUsers.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Sem utilizadores"
              message="Os perfis sincronizados com autenticacao vao aparecer aqui."
            />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Utilizador</th>
                  <th className="py-3 pr-4 font-medium">Governanca</th>
                  <th className="py-3 pr-4 font-medium">Ultimo login</th>
                  <th className="py-3 pr-4 font-medium">Acao</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0 align-top">
                    <td className="py-4 pr-4">
                      <p className="font-medium text-slate-900">{user.full_name}</p>
                      <p className="mt-1 text-slate-600">{user.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Criado em {formatDateTime(user.created_at)}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="grid gap-3 md:max-w-[220px]">
                        <div className="space-y-2">
                          <StatusBadge label={user.role} tone={user.role === "admin" ? "info" : "neutral"} />
                          <select
                            value={user.role}
                            onChange={(event) =>
                              void updateUser.mutateAsync({ userId: user.id, role: event.target.value as AdminUserSummary["role"] })
                            }
                            className="h-10 rounded-xl border bg-slate-50 px-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                          >
                            <option value="student">Aluno</option>
                            <option value="affiliate">Afiliado</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <StatusBadge label={user.status} tone={user.status === "active" ? "success" : user.status === "blocked" ? "danger" : "warning"} />
                          <select
                            value={user.status}
                            onChange={(event) =>
                              void updateUser.mutateAsync({ userId: user.id, status: event.target.value as AdminUserSummary["status"] })
                            }
                            className="h-10 rounded-xl border bg-slate-50 px-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
                          >
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                            <option value="blocked">Bloqueado</option>
                            <option value="pending_review">Em revisao</option>
                          </select>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{formatDateTime(user.last_login_at)}</td>
                    <td className="py-4 pr-4">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          if (window.confirm(`Desativar ${user.full_name}?`)) {
                            void deleteUser.mutateAsync(user.id)
                          }
                        }}
                        disabled={deleteUser.isPending}
                      >
                        Desativar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

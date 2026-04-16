import { useMemo, useState, type FormEvent } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAdminNotifications, useAdminUsers, useCreateAdminNotification } from "@/hooks/useAdmin"
import type { AdminNotificationSummary, AdminUserSummary } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

type Audience = "single" | "role" | "all"

function AdminNotificationsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificacoes"
        description="Comunicacao operacional para alunos e segmentos especificos, sempre a partir do backend."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="h-4 w-44 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminNotifications() {
  const [audience, setAudience] = useState<Audience>("all")
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<AdminUserSummary["role"]>("student")
  const [status, setStatus] = useState<AdminUserSummary["status"]>("active")
  const [type, setType] = useState<AdminNotificationSummary["type"]>("informational")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [link, setLink] = useState("")
  const [sentViaEmail, setSentViaEmail] = useState(false)
  const [sentViaInApp, setSentViaInApp] = useState(true)

  const notificationsQuery = useAdminNotifications()
  const usersQuery = useAdminUsers()
  const createNotification = useCreateAdminNotification()

  const isLoading = notificationsQuery.isLoading || usersQuery.isLoading
  const isError = notificationsQuery.isError || usersQuery.isError

  const userMap = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await createNotification.mutateAsync({
      audience,
      userId: audience === "single" ? userId : undefined,
      role: audience === "role" ? role : undefined,
      status: audience !== "single" ? status : undefined,
      type,
      title,
      message,
      link: link.trim() || null,
      sentViaEmail,
      sentViaInApp,
    })

    setTitle("")
    setMessage("")
    setLink("")
    setSentViaEmail(false)
    setSentViaInApp(true)
  }

  if (isLoading) {
    return <AdminNotificationsSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar as notificacoes"
        message="Tenta novamente dentro de instantes."
        onRetry={() => {
          void notificationsQuery.refetch()
          void usersQuery.refetch()
        }}
      />
    )
  }

  const notifications = notificationsQuery.data ?? []
  const unreadCount = notifications.filter((notification) => notification.status === "unread").length
  const supportCount = notifications.filter((notification) => notification.type === "support").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificacoes"
        description="Comunicacao operacional para alunos e segmentos especificos, sempre validada e criada pelo backend."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total enviadas</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{notifications.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ainda por ler</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{unreadCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tipo suporte</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{supportCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Disparo controlado</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Criar notificacao</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Usa esta area para alertas operacionais, comunicacoes de suporte ou mensagens segmentadas.
          </p>

          <div className="mt-5 grid gap-4">
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as Audience)}
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="all">Todos os utilizadores ativos</option>
              <option value="role">Por papel</option>
              <option value="single">Utilizador especifico</option>
            </select>

            {audience === "single" ? (
              <select
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="">Seleciona um utilizador</option>
                {(usersQuery.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} - {user.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as AdminUserSummary["role"])}
                  disabled={audience !== "role"}
                  className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white disabled:opacity-60"
                >
                  <option value="student">Alunos</option>
                  <option value="affiliate">Afiliados</option>
                  <option value="admin">Admins</option>
                </select>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AdminUserSummary["status"])}
                  className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="active">Apenas ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="blocked">Bloqueados</option>
                  <option value="pending_review">Em revisao</option>
                </select>
              </div>
            )}

            <select
              value={type}
              onChange={(event) => setType(event.target.value as AdminNotificationSummary["type"])}
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="informational">Informativa</option>
              <option value="transactional">Transacional</option>
              <option value="support">Suporte</option>
              <option value="marketing">Marketing</option>
            </select>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titulo"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder="Mensagem"
              className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="Link interno opcional"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={sentViaInApp} onChange={(event) => setSentViaInApp(event.target.checked)} />
                Entregar no painel
              </label>
              <label className="flex items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={sentViaEmail} onChange={(event) => setSentViaEmail(event.target.checked)} />
                Marcar para email
              </label>
            </div>
          </div>

          {createNotification.error instanceof Error ? (
            <p className="mt-4 text-sm text-red-600">{createNotification.error.message}</p>
          ) : null}

          <Button type="submit" className="mt-4 rounded-full" disabled={createNotification.isPending}>
            {createNotification.isPending ? "A enviar..." : "Enviar notificacao"}
          </Button>
        </form>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Fila recente</h2>
              <p className="mt-1 text-sm text-slate-600">Historico das comunicacoes mais recentes.</p>
            </div>
            <StatusBadge label={`${notifications.length} registos`} tone="neutral" />
          </div>

          {notifications.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Sem notificacoes"
                message="As mensagens disparadas pelo admin vao aparecer aqui."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {notifications.slice(0, 10).map((notification) => {
                const user = userMap.get(notification.user_id)

                return (
                  <div key={notification.id} className="rounded-2xl border bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{notification.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {user?.full_name ?? "Utilizador"} · {user?.email ?? notification.user_id}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={notification.type} tone="info" />
                        <StatusBadge
                          label={notification.status === "unread" ? "Por ler" : "Lida"}
                          tone={notification.status === "unread" ? "warning" : "neutral"}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{notification.message}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

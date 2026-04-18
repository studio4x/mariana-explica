import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui"
import { PageHeader, StatusBadge } from "@/components/common"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import {
  useAdminCourseBuilderContext,
} from "./AdminCourseBuilderLayout"
import {
  useAdminCourseReleases,
  useAdminUsers,
  useCreateAdminCourseRelease,
  useRevokeAdminCourseRelease,
} from "@/hooks/useAdmin"

export function CourseReleasesPanel() {
  const { courseId } = useAdminCourseBuilderContext()
  const releasesQuery = useAdminCourseReleases(courseId)
  const usersQuery = useAdminUsers()
  const createRelease = useCreateAdminCourseRelease()
  const revokeRelease = useRevokeAdminCourseRelease()

  const [selectedUserId, setSelectedUserId] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [notes, setNotes] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({})

  const eligibleUsers = useMemo(
    () =>
      (usersQuery.data ?? []).filter((user) => user.status === "active"),
    [usersQuery.data],
  )

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!selectedUserId) {
      setSubmitError("Seleciona um aluno para conceder o acesso.")
      return
    }

    try {
      await createRelease.mutateAsync({
        productId: courseId,
        userId: selectedUserId,
        expiresAt: expiresAt || null,
        notes: notes.trim() || null,
      })

      setSelectedUserId("")
      setExpiresAt("")
      setNotes("")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel conceder a liberacao.")
    }
  }

  const handleRevoke = async (grantId: string) => {
    try {
      await revokeRelease.mutateAsync({
        grantId,
        reason: revokeReason[grantId]?.trim() || null,
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel revogar a liberacao.")
    }
  }

  if (releasesQuery.isLoading || usersQuery.isLoading) {
    return <LoadingState message="A carregar liberacoes do curso..." />
  }

  if (releasesQuery.isError || usersQuery.isError) {
    const error = releasesQuery.error ?? usersQuery.error
    return (
      <ErrorState
        title="Nao foi possivel carregar as liberacoes"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => {
          void releasesQuery.refetch()
          void usersQuery.refetch()
        }}
      />
    )
  }

  const releases = releasesQuery.data ?? []

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <PageHeader
          title="Alunos adicionados e liberacoes"
          description="Concessao e revogacao operacional de acesso real ao curso com trilha de auditoria no backend."
        />

        <form onSubmit={handleCreate} className="mt-6 grid gap-4 md:grid-cols-[1.1fr_0.8fr_1fr_auto]">
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="">Selecionar aluno</option>
            {eligibleUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.email})
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notas da liberacao"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <Button type="submit" className="rounded-full" disabled={createRelease.isPending}>
            {createRelease.isPending ? "A guardar..." : "Conceder acesso"}
          </Button>
        </form>

        {submitError ? (
          <p className="mt-4 text-sm text-rose-700">{submitError}</p>
        ) : null}
      </section>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        {releases.length === 0 ? (
          <EmptyState
            title="Sem liberacoes neste curso"
            message="Quando o curso for concedido por compra, fluxo gratuito ou acao manual, os registros aparecem aqui."
          />
        ) : (
          <div className="space-y-4">
            {releases.map((release) => (
              <div key={release.id} className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">
                        {release.profile_name ?? "Aluno sem nome"}
                      </p>
                      <StatusBadge
                        label={
                          release.status === "active"
                            ? "Ativa"
                            : release.status === "revoked"
                              ? "Revogada"
                              : "Expirada"
                        }
                        tone={
                          release.status === "active"
                            ? "success"
                            : release.status === "revoked"
                              ? "danger"
                              : "warning"
                        }
                      />
                      <StatusBadge label={release.source_type} tone="info" />
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {release.profile_email ?? release.user_id}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge
                        label={`Inicio ${new Date(release.granted_at).toLocaleString("pt-PT")}`}
                        tone="neutral"
                      />
                      <StatusBadge
                        label={
                          release.expires_at
                            ? `Expira ${new Date(release.expires_at).toLocaleString("pt-PT")}`
                            : "Sem expiracao"
                        }
                        tone="warning"
                      />
                      {release.source_order_id ? (
                        <StatusBadge label={`Pedido ${release.source_order_id}`} tone="neutral" />
                      ) : null}
                    </div>
                    {release.notes ? (
                      <p className="mt-3 text-sm leading-7 text-slate-600">{release.notes}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 xl:w-[320px]">
                    <input
                      value={revokeReason[release.id] ?? ""}
                      onChange={(event) =>
                        setRevokeReason((prev) => ({ ...prev, [release.id]: event.target.value }))
                      }
                      placeholder="Motivo da revogacao"
                      className="h-11 rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={revokeRelease.isPending || release.status !== "active"}
                      onClick={() => void handleRevoke(release.id)}
                    >
                      {release.status === "active" ? "Revogar acesso" : "Liberacao encerrada"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

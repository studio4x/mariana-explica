import { useState, type FormEvent } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useProfilePreferences, useUpdateProfilePreferences } from "@/hooks/useDashboard"

export function DashboardProfile() {
  const profileQuery = useProfilePreferences()
  const updateProfile = useUpdateProfilePreferences()
  const [draft, setDraft] = useState<{
    fullName: string
    phone: string
    notificationsEnabled: boolean
    marketingConsent: boolean
  } | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await updateProfile.mutateAsync({
      fullName: formState.fullName,
      phone: formState.phone,
      notificationsEnabled: formState.notificationsEnabled,
      marketingConsent: formState.marketingConsent,
    })
  }

  if (profileQuery.isLoading) {
    return <LoadingState message="A carregar perfil..." />
  }

  if (profileQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o perfil"
        message={profileQuery.error instanceof Error ? profileQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void profileQuery.refetch()}
      />
    )
  }

  const profile = profileQuery.data
  if (!profile) {
    return (
      <EmptyState
        title="Perfil indisponivel"
        message="Nao foi possivel localizar os teus dados."
      />
    )
  }

  const formState = draft ?? {
    fullName: profile.full_name,
    phone: profile.phone ?? "",
    notificationsEnabled: profile.notifications_enabled,
    marketingConsent: profile.marketing_consent,
  }

  const updateDraft = (updates: Partial<typeof formState>) => {
    setDraft({ ...formState, ...updates })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Perfil" description="Atualiza os teus dados principais e as tuas preferencias de comunicacao." />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-slate-950">Conta</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>Email: {profile.email}</p>
            <p>Tipo de conta: {profile.role}</p>
            <div className="flex items-center gap-3">
              <span>Estado:</span>
              <StatusBadge label={profile.status} tone={profile.status === "active" ? "success" : "warning"} />
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-slate-950">Preferencias</h2>
          <div className="mt-5 grid gap-4">
            <input
              value={formState.fullName}
              onChange={(event) => updateDraft({ fullName: event.target.value })}
              placeholder="Nome completo"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
            <input
              value={formState.phone}
              onChange={(event) => updateDraft({ phone: event.target.value })}
              placeholder="Telefone"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
            <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formState.notificationsEnabled}
                onChange={(event) => updateDraft({ notificationsEnabled: event.target.checked })}
              />
              Receber notificacoes da plataforma
            </label>
            <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formState.marketingConsent}
                onChange={(event) => updateDraft({ marketingConsent: event.target.checked })}
              />
              Aceitar comunicacoes sobre novos produtos e atualizacoes
            </label>
          </div>
          <Button type="submit" className="mt-6 rounded-full" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "A guardar..." : "Guardar alteracoes"}
          </Button>
        </form>
      </div>
    </div>
  )
}

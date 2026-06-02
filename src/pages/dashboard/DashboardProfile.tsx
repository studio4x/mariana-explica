import { useState, type FormEvent } from "react"
import { Camera } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { formatNif, isValidNif, stripNifDigits } from "@/lib/nif"
import {
  useProfilePreferences,
  useUpdateAccountPassword,
  useUpdateProfilePreferences,
  useUploadProfileAvatar,
} from "@/hooks/useDashboard"

export function DashboardProfile() {
  const profileQuery = useProfilePreferences()
  const updateProfile = useUpdateProfilePreferences()
  const updatePassword = useUpdateAccountPassword()
  const uploadAvatar = useUploadProfileAvatar()
  const [draft, setDraft] = useState<{
    fullName: string
    phone: string
    nif: string
    notificationsEnabled: boolean
    marketingConsent: boolean
  } | null>(null)
  const [passwordDraft, setPasswordDraft] = useState({
    password: "",
    confirmPassword: "",
  })
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileMessage(null)

    if (formState.nif && !isValidNif(formState.nif)) {
      setProfileMessage("Indica um NIF válido.")
      return
    }

    try {
      await updateProfile.mutateAsync({
        fullName: formState.fullName,
        phone: formState.phone,
        nif: formState.nif,
        notificationsEnabled: formState.notificationsEnabled,
        marketingConsent: formState.marketingConsent,
      })
      setProfileMessage("Preferências atualizadas com sucesso.")
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Não foi possível guardar as preferências.")
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordMessage(null)

    if (passwordDraft.password.length < 8) {
      setPasswordMessage("A nova senha deve ter pelo menos 8 caracteres.")
      return
    }

    if (passwordDraft.password !== passwordDraft.confirmPassword) {
      setPasswordMessage("As senhas não coincidem.")
      return
    }

    await updatePassword.mutateAsync({ password: passwordDraft.password })
    setPasswordDraft({ password: "", confirmPassword: "" })
    setPasswordMessage("Senha atualizada com sucesso.")
  }

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return
    setAvatarMessage(null)

    try {
      await uploadAvatar.mutateAsync({ file })
      setAvatarMessage("Avatar atualizado com sucesso.")
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "Não foi possível atualizar o avatar.")
    }
  }

  if (profileQuery.isLoading) {
    return <LoadingState message="A carregar perfil..." />
  }

  if (profileQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o perfil"
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
        message="Não foi possível localizar os teus dados."
      />
    )
  }

  const formState = draft ?? {
    fullName: profile.full_name,
    phone: profile.phone ?? "",
    nif: profile.nif ?? "",
    notificationsEnabled: profile.notifications_enabled,
    marketingConsent: profile.marketing_consent,
  }

  const updateDraft = (updates: Partial<typeof formState>) => {
    setDraft({ ...formState, ...updates })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Perfil" description="Atualiza os teus dados principais e as tuas preferências de comunicação." />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-slate-950">Conta</h2>
          <div className="mt-5 flex items-center gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-slate-100" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 font-display text-2xl font-black text-white">
                {(profile.full_name?.[0] || profile.email?.[0] || "A").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <Camera className="h-4 w-4" />
                {uploadAvatar.isPending ? "A enviar..." : "Trocar avatar"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  className="sr-only"
                  disabled={uploadAvatar.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    void handleAvatarChange(file)
                  }}
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-slate-500">PNG, JPG, WEBP, GIF ou AVIF ate 5 MB.</p>
              {avatarMessage ? <p className="mt-2 text-sm font-medium text-slate-700">{avatarMessage}</p> : null}
            </div>
          </div>
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
          <h2 className="font-display text-2xl font-bold text-slate-950">Preferências</h2>
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
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">NIF</span>
              <input
                value={formatNif(formState.nif)}
                onChange={(event) => updateDraft({ nif: stripNifDigits(event.target.value) })}
                placeholder="Número de Identificação Fiscal"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
              <span className="text-xs leading-5 text-slate-500">
                O mesmo NIF usado no checkout para faturação.
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formState.notificationsEnabled}
                onChange={(event) => updateDraft({ notificationsEnabled: event.target.checked })}
              />
              Receber notificações da plataforma
            </label>
            <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formState.marketingConsent}
                onChange={(event) => updateDraft({ marketingConsent: event.target.checked })}
              />
              Aceitar comunicações sobre novos materiais e atualizacoes
            </label>
          </div>
          <Button type="submit" className="mt-6 rounded-full" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "A guardar..." : "Guardar alterações"}
          </Button>
          {profileMessage ? <p className="mt-3 text-sm font-medium text-slate-700">{profileMessage}</p> : null}
        </form>
      </div>

      <form onSubmit={handlePasswordSubmit} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <h2 className="font-display text-2xl font-bold text-slate-950">Trocar senha</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
          Define uma nova senha para continuar a entrar com segurança na tua conta.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <input
            type="password"
            value={passwordDraft.password}
            onChange={(event) => setPasswordDraft((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Nova senha"
            autoComplete="new-password"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            type="password"
            value={passwordDraft.confirmPassword}
            onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        {passwordMessage ? (
          <p className="mt-4 text-sm font-medium text-slate-700">{passwordMessage}</p>
        ) : null}
        {updatePassword.isError ? (
          <p className="mt-4 text-sm font-medium text-red-700">
            {updatePassword.error instanceof Error ? updatePassword.error.message : "Não foi possível atualizar a senha."}
          </p>
        ) : null}

        <Button
          type="submit"
          className="mt-6 rounded-full"
          disabled={updatePassword.isPending}
        >
          {updatePassword.isPending ? "A atualizar..." : "Atualizar senha"}
        </Button>
      </form>
    </div>
  )
}

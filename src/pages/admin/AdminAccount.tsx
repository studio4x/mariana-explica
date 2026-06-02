import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Camera, KeyRound, ShieldCheck } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import {
  useProfilePreferences,
  useUpdateAccountPassword,
  useUpdateProfilePreferences,
  useUploadProfileAvatar,
} from "@/hooks/useDashboard"

interface ProfileDraft {
  fullName: string
  phone: string
  notificationsEnabled: boolean
  marketingConsent: boolean
}

export function AdminAccount() {
  const { refreshSession } = useAuth()
  const profileQuery = useProfilePreferences()
  const updateProfile = useUpdateProfilePreferences()
  const updatePassword = useUpdateAccountPassword()
  const uploadAvatar = useUploadProfileAvatar()
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  })
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)

  const profile = profileQuery.data

  useEffect(() => {
    if (!profile) return

    setDraft({
      fullName: profile.full_name,
      phone: profile.phone ?? "",
      notificationsEnabled: profile.notifications_enabled,
      marketingConsent: profile.marketing_consent,
    })
  }, [profile])

  const initials = useMemo(() => {
    const source = profile?.full_name?.trim() || profile?.email?.split("@")[0] || "Admin"
    const parts = source.split(/\s+/).filter(Boolean)
    return (
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "A"
    )
  }, [profile?.email, profile?.full_name])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return

    setProfileMessage(null)

    try {
      await updateProfile.mutateAsync({
        fullName: draft.fullName,
        phone: draft.phone,
        notificationsEnabled: draft.notificationsEnabled,
        marketingConsent: draft.marketingConsent,
      })
      await refreshSession()
      setProfileMessage("Dados da conta atualizados com sucesso.")
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Não foi possível guardar as alterações.")
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

    try {
      await updatePassword.mutateAsync({ password: passwordDraft.password })
      setPasswordDraft({
        currentPassword: "",
        password: "",
        confirmPassword: "",
      })
      setPasswordMessage("Senha atualizada com sucesso.")
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Não foi possível atualizar a senha.")
    }
  }

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return
    setAvatarMessage(null)

    try {
      await uploadAvatar.mutateAsync({ file })
      await refreshSession()
      setAvatarMessage("Avatar atualizado com sucesso.")
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : "Não foi possível atualizar o avatar.")
    }
  }

  if (profileQuery.isLoading) {
    return <LoadingState message="A carregar conta do admin..." />
  }

  if (profileQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar a conta"
        message={profileQuery.error instanceof Error ? profileQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void profileQuery.refetch()}
      />
    )
  }

  if (!profile || !draft) {
    return <EmptyState title="Conta indisponivel" message="Não foi possível localizar os dados do admin." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha Conta"
        description="Gerencie os dados do admin, atualize a senha e mantenha o acesso operacional sob controlo."
      />

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <article className="rounded-[30px] border border-[#D8E6EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-4 ring-[#F2F7F9]"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#15323b] text-3xl font-black text-white">
                {initials}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-semibold text-[#15323b]">{profile.full_name}</p>
              <p className="mt-1 truncate text-sm text-[#5F7077]">{profile.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={profile.role} tone="info" />
                <StatusBadge label={profile.status} tone={profile.status === "active" ? "success" : "warning"} />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#1398B7]">Conta protegida</p>
                <p className="mt-2 text-sm leading-6 text-[#5F7077]">
                  Use esta Área para trocar a senha do admin sem depender da recuperação por email.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-[#5F7077]">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D8E6EB] px-4 py-3">
              <span>Email</span>
              <span className="truncate font-semibold text-[#15323b]">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D8E6EB] px-4 py-3">
              <span>Papel</span>
              <span className="font-semibold text-[#15323b]">{profile.role}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#D8E6EB] px-4 py-3">
              <span>Estado</span>
              <span className="font-semibold text-[#15323b]">{profile.status}</span>
            </div>
          </div>

          <div className="mt-6">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-bold text-[#15323b] shadow-sm transition hover:bg-[#F2F7F9]">
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
            <p className="mt-2 text-xs leading-5 text-[#6d7a80]">PNG, JPG, WEBP, GIF ou AVIF ate 5 MB.</p>
            {avatarMessage ? <p className="mt-3 text-sm font-medium text-[#15323b]">{avatarMessage}</p> : null}
          </div>
        </article>

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="rounded-[30px] border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#D8E6EB] pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Perfil operacional</p>
              <h2 className="font-display text-2xl font-semibold text-[#15323b]">Dados e preferências</h2>
              <p className="text-sm text-[#6d7a80]">
                Atualize nome, telefone e consentimentos usados pela plataforma.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Nome completo</span>
                <input
                  value={draft.fullName}
                  onChange={(event) => setDraft((current) => (current ? { ...current, fullName: event.target.value } : current))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Nome completo"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Telefone</span>
                <input
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => (current ? { ...current, phone: event.target.value } : current))}
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Telefone"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#15323b]">
                <input
                  type="checkbox"
                  checked={draft.notificationsEnabled}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, notificationsEnabled: event.target.checked } : current))
                  }
                />
                Receber notificações operacionais da plataforma
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#15323b]">
                <input
                  type="checkbox"
                  checked={draft.marketingConsent}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, marketingConsent: event.target.checked } : current))
                  }
                />
                Aceitar comunicações de novidades e campanhas
              </label>
            </div>

            {profileMessage ? <p className="mt-4 text-sm font-medium text-[#15323b]">{profileMessage}</p> : null}

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "A guardar..." : "Guardar alterações"}
              </Button>
            </div>
          </form>

          <form onSubmit={handlePasswordSubmit} className="rounded-[30px] border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#D8E6EB] pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Segurança</p>
              <h2 className="font-display text-2xl font-semibold text-[#15323b]">Trocar senha</h2>
              <p className="text-sm text-[#6d7a80]">
                Defina uma nova senha forte para entrar em outros navegadores sem depender do fluxo de recuperação.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Senha atual</span>
                <input
                  type="password"
                  value={passwordDraft.currentPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  autoComplete="current-password"
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Preencha apenas para sua referencia"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Nova senha</span>
                <input
                  type="password"
                  value={passwordDraft.password}
                  onChange={(event) => setPasswordDraft((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Mínimo 8 caracteres"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Confirmar senha</span>
                <input
                  type="password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                  className="h-12 w-full rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm outline-none transition focus:border-[#1398B7] focus:bg-white"
                  placeholder="Repita a nova senha"
                />
              </label>
            </div>

            <div className="mt-4 rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-3 text-sm text-[#5F7077]">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-[#1398B7]" />
                <p>
                  A senha será atualizada diretamente no Supabase Auth. Depois disso, você já pode usar o novo acesso em outro navegador.
                </p>
              </div>
            </div>

            {passwordMessage ? <p className="mt-4 text-sm font-medium text-[#15323b]">{passwordMessage}</p> : null}

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                className="rounded-2xl bg-[#1398B7] font-black hover:bg-[#0A3640]"
                disabled={updatePassword.isPending}
              >
                {updatePassword.isPending ? "A atualizar..." : "Atualizar senha"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

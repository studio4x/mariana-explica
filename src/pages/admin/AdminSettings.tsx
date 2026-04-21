import { useEffect, useMemo, useState, type FormEvent } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAdminPendingInfoConfig, useUpdateAdminPendingInfoConfig } from "@/hooks/useAdmin"
import type { AdminPendingInfoConfig } from "@/types/app.types"
import { formatDateTime } from "@/utils/date"

type PendingInfoForm = AdminPendingInfoConfig["config_value"]
type PendingInfoField = {
  key: keyof PendingInfoForm
  label: string
  placeholder: string
}

const emailFields: PendingInfoField[] = [
  {
    key: "email_provider_name",
    label: "Provedor de email",
    placeholder: "Ex.: SMTP, Resend, Postmark, SendGrid",
  },
  {
    key: "email_sender_name",
    label: "Nome do remetente",
    placeholder: "Ex.: Mariana Explica",
  },
  {
    key: "email_sender_address",
    label: "Email remetente",
    placeholder: "Ex.: suporte@mariana-explica.pt",
  },
  {
    key: "email_reply_to",
    label: "Reply-to",
    placeholder: "Ex.: suporte@mariana-explica.pt",
  },
]

const emptyForm: PendingInfoForm = {
  email_provider_name: "",
  email_sender_name: "",
  email_sender_address: "",
  email_reply_to: "",
}

function countFilledFields(form: PendingInfoForm) {
  return Object.values(form).filter((value) => value.trim().length > 0).length
}

export function AdminSettings() {
  const pendingInfoQuery = useAdminPendingInfoConfig()
  const updatePendingInfo = useUpdateAdminPendingInfoConfig()
  const [form, setForm] = useState<PendingInfoForm>(emptyForm)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (!pendingInfoQuery.data) {
      return
    }

    setForm(pendingInfoQuery.data.config_value)
  }, [pendingInfoQuery.data])

  const completion = useMemo(() => {
    const filled = countFilledFields(form)
    return {
      filled,
      total: Object.keys(form).length,
    }
  }, [form])

  const missingFields = useMemo(
    () => emailFields.filter((field) => !form[field.key].trim()),
    [form],
  )

  if (pendingInfoQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Configuracoes"
          description="Configuracao operacional de email que ainda depende de dados manuais."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
              <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (pendingInfoQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar as configuracoes"
        message={
          pendingInfoQuery.error instanceof Error
            ? pendingInfoQuery.error.message
            : "Tenta novamente dentro de instantes."
        }
        onRetry={() => void pendingInfoQuery.refetch()}
      />
    )
  }

  if (!pendingInfoQuery.data) {
    return (
      <EmptyState
        title="Sem configuracoes disponiveis"
        message="Assim que houver uma configuracao operacional para guardar, esta area passa a centraliza-la."
      />
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    try {
      await updatePendingInfo.mutateAsync(form)
      setFeedback({
        tone: "success",
        message: "Configuracao operacional de email atualizada com sucesso.",
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel guardar as configuracoes.",
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracoes"
        description="Central de configuracao operacional de email. O restante do checklist ja vive em areas proprias do admin ou foi entregue pelo backend."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Campos preenchidos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">
            {completion.filled}/{completion.total}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Leitura rapida do que ja pode ser usado pelo backend.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ultima atualizacao</p>
          <p className="mt-3 text-lg font-bold text-slate-950">
            {pendingInfoQuery.data.updated_at ? formatDateTime(pendingInfoQuery.data.updated_at) : "Ainda nao registado"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Mantem esta referencia unica para o envio transacional.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Regra de seguranca</p>
          <p className="mt-3 text-lg font-bold">Nao guardar segredos aqui</p>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Tokens, API keys e secrets continuam apenas no Supabase, Vercel ou no provedor seguro correspondente.
          </p>
        </div>
      </div>

      {feedback ? (
        <div
          className={`rounded-[1.4rem] border px-5 py-4 text-sm shadow-sm ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">O que ainda preciso de voce</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Se algum destes campos estiver vazio, o envio transacional de email continua incompleto.
            </p>
          </div>
          <StatusBadge
            label={missingFields.length === 0 ? "Configuracao completa" : `${missingFields.length} pendente(s)`}
            tone={missingFields.length === 0 ? "success" : "warning"}
          />
        </div>

        <div className="mt-6 grid gap-3">
          {missingFields.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
              Nao ha informacoes em falta neste momento. A configuracao de email esta completa.
            </div>
          ) : (
            missingFields.map((field) => (
              <div
                key={field.key}
                className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-amber-950">{field.label}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Este campo ainda precisa ser fornecido para fechar a configuracao operacional.
                  </p>
                </div>
                <StatusBadge label="Falta" tone="warning" />
              </div>
            ))
          )}
        </div>
      </section>

      <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Entrega de emails transacionais</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Estes dados alimentam o backend de envio de emails. Segredos continuam fora desta tela.
              </p>
            </div>
            <StatusBadge
              label={`${completion.filled}/${completion.total} preenchidos`}
              tone={completion.filled === completion.total ? "success" : "warning"}
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {emailFields.map((field) => (
              <label key={field.key}>
                <span className="text-sm font-medium text-slate-700">{field.label}</span>
                <input
                  value={form[field.key]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                />
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" className="rounded-full" disabled={updatePendingInfo.isPending}>
            {updatePendingInfo.isPending ? "A guardar..." : "Guardar configuracao de email"}
          </Button>
        </div>
      </form>
    </div>
  )
}

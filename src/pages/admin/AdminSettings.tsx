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
  multiline?: boolean
}

const emptyForm: PendingInfoForm = {
  scheduler_provider: "",
  scheduler_reference: "",
  scheduler_notes: "",
  email_provider_name: "",
  email_sender_name: "",
  email_sender_address: "",
  email_reply_to: "",
  checkout_production_notes: "",
  production_smoke_tests_notes: "",
  pwa_mobile_validation_notes: "",
  operations_contact: "",
  general_notes: "",
}

function countFilledFields(form: PendingInfoForm) {
  return Object.values(form).filter((value) => value.trim().length > 0).length
}

type FinalChecklistItem = {
  title: string
  description: string
  status: "done" | "pending"
  detail: string
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

  const finalChecklist = useMemo<FinalChecklistItem[]>(() => {
    const schedulerConfigured = Boolean(form.scheduler_provider.trim() && form.scheduler_reference.trim())
    const emailOperationalInfoReady = Boolean(
      form.email_provider_name.trim() &&
        form.email_sender_name.trim() &&
        form.email_sender_address.trim(),
    )
    const checkoutValidated = Boolean(form.checkout_production_notes.trim())
    const smokeTestsValidated = Boolean(form.production_smoke_tests_notes.trim())
    const pwaValidated = Boolean(form.pwa_mobile_validation_notes.trim())

    return [
      {
        title: "Scheduler externo dos cron jobs",
        description: "Falta ligar um disparador real para os jobs internos com `CRON_SECRET`.",
        status: schedulerConfigured ? "done" : "pending",
        detail: schedulerConfigured
          ? "Referencia operacional registada nesta pagina. Falta apenas executar a configuracao no provedor escolhido."
          : "Ainda nao ha plataforma e referencia de scheduler registadas.",
      },
      {
        title: "Email transacional em producao",
        description: "O backend ja suporta Resend, Postmark e SendGrid, mas os segredos continuam fora da UI.",
        status: emailOperationalInfoReady ? "done" : "pending",
        detail: emailOperationalInfoReady
          ? "Os dados operacionais do remetente ja estao registados. Ainda sera preciso configurar a API key no provedor seguro."
          : "Ainda faltam provedor e remetente para fechar a entrega real de emails.",
      },
      {
        title: "Checkout real em producao",
        description: "O plano inicial pede validacao final com compra real e confirmacao de grant.",
        status: checkoutValidated ? "done" : "pending",
        detail: checkoutValidated
          ? "Ja existe registo manual nesta pagina sobre a validacao do checkout real."
          : "Ainda nao ha registo de compra real em producao nesta pagina.",
      },
      {
        title: "Smoke tests finais",
        description: "Consolida verificacoes finais de dominio, funcoes, grants, admin e fluxos principais.",
        status: smokeTestsValidated ? "done" : "pending",
        detail: smokeTestsValidated
          ? "Ja existe nota de smoke tests finais registada nesta pagina."
          : "Ainda nao ha nota consolidada de smoke tests finais nesta pagina.",
      },
      {
        title: "Teste PWA em Android e iOS",
        description: "O plano pede validacao real do modo instalado em dispositivos moveis.",
        status: pwaValidated ? "done" : "pending",
        detail: pwaValidated
          ? "Ja existe registo manual desta validacao mobile."
          : "Ainda falta validar instalacao e uso do PWA em Android/iOS reais.",
      },
    ]
  }, [form])

  if (pendingInfoQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Configuracoes"
          description="Central de pendencias operacionais e informacoes que ainda precisam ser fornecidas manualmente."
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
        message="Assim que as pendencias forem registadas, esta area passa a centralizar tudo."
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
        message: "Pendencias operacionais atualizadas com sucesso.",
      })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel guardar as configuracoes.",
      })
    }
  }

  const blocks: Array<{
    title: string
    description: string
    fields: PendingInfoField[]
  }> = [
    {
      title: "Scheduler externo",
      description:
        "Define onde os cron jobs vao ser disparados em producao. O segredo continua no provedor seguro, nao nesta pagina.",
      fields: [
        {
          key: "scheduler_provider" as const,
          label: "Plataforma do scheduler",
          placeholder: "Ex.: Supabase Scheduled Functions, GitHub Actions, cron-job.org",
        },
        {
          key: "scheduler_reference" as const,
          label: "Referencia do scheduler",
          placeholder: "URL do job, nome do workflow ou identificador operacional",
        },
        {
          key: "scheduler_notes" as const,
          label: "Notas de agendamento",
          placeholder: "Frequencia, responsavel, janela de execucao, observacoes",
          multiline: true,
        },
      ],
    },
    {
      title: "Entrega de emails",
      description:
        "Centraliza os dados operacionais que faltam para trocar o envio interno simplificado por um provedor real.",
      fields: [
        {
          key: "email_provider_name" as const,
          label: "Provedor de email",
          placeholder: "Ex.: Resend, Postmark, SendGrid",
        },
        {
          key: "email_sender_name" as const,
          label: "Nome do remetente",
          placeholder: "Ex.: Mariana Explica",
        },
        {
          key: "email_sender_address" as const,
          label: "Email remetente",
          placeholder: "Ex.: suporte@mariana-explica.pt",
        },
        {
          key: "email_reply_to" as const,
          label: "Reply-to",
          placeholder: "Ex.: suporte@mariana-explica.pt",
        },
      ],
    },
    {
      title: "Validacoes finais de producao",
      description:
        "Regista aqui o que ja foi validado manualmente no fecho do plano inicial, incluindo compra real, smoke tests e uso do PWA em dispositivo.",
      fields: [
        {
          key: "checkout_production_notes" as const,
          label: "Compra real e grant em producao",
          placeholder: "Regista data, pedido, resultado do checkout Stripe e confirmacao do grant",
          multiline: true,
        },
        {
          key: "production_smoke_tests_notes" as const,
          label: "Smoke tests finais",
          placeholder: "Anota validacoes finais de dominio, admin, funcoes, grants e downloads",
          multiline: true,
        },
        {
          key: "pwa_mobile_validation_notes" as const,
          label: "Teste PWA Android/iOS",
          placeholder: "Regista instalacao, standalone, offline fallback e observacoes por dispositivo",
          multiline: true,
        },
      ],
    },
    {
      title: "Operacao",
      description:
        "Guarda os contactos e apontamentos que ainda dependem de definicao manual para fechar a operacao sem depender de memoria dispersa.",
      fields: [
        {
          key: "operations_contact" as const,
          label: "Contato operacional",
          placeholder: "Pessoa, email ou canal responsavel por aprovar configuracoes pendentes",
        },
        {
          key: "general_notes" as const,
          label: "Notas gerais pendentes",
          placeholder: "Qualquer informacao faltante que ainda precises fornecer depois",
          multiline: true,
        },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracoes"
        description="Central de pendencias operacionais e informacoes que ainda precisas fornecer antes de fechar as configuracoes finais da plataforma."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Campos preenchidos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">
            {completion.filled}/{completion.total}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Leitura rapida do quanto da operacao ja foi documentado.</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ultima atualizacao</p>
          <p className="mt-3 text-lg font-bold text-slate-950">
            {pendingInfoQuery.data.updated_at ? formatDateTime(pendingInfoQuery.data.updated_at) : "Ainda nao registado"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sempre que houver nova informacao, regista aqui para manter contexto unico.</p>
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
            <h2 className="font-display text-2xl font-bold text-slate-950">Checklist final do plano</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Esta secao resume apenas o que ainda precisa de execucao externa, validacao manual ou dados teus para fechar o plano inicial.
            </p>
          </div>
          <StatusBadge
            label={`${finalChecklist.filter((item) => item.status === "done").length}/${finalChecklist.length} encaminhados`}
            tone={finalChecklist.every((item) => item.status === "done") ? "success" : "warning"}
          />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {finalChecklist.map((item) => (
            <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
                <StatusBadge
                  label={item.status === "done" ? "Encaminhado" : "Pendente"}
                  tone={item.status === "done" ? "success" : "warning"}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
        {blocks.map((block) => {
          const filledFields = block.fields.filter((field) => form[field.key].trim().length > 0).length

          return (
            <section key={block.title} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-950">{block.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{block.description}</p>
                </div>
                <StatusBadge
                  label={`${filledFields}/${block.fields.length} preenchidos`}
                  tone={filledFields === block.fields.length ? "success" : "warning"}
                />
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {block.fields.map((field) => (
                  <label key={field.key} className={field.multiline ? "xl:col-span-2" : ""}>
                    <span className="text-sm font-medium text-slate-700">{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        value={form[field.key]}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder={field.placeholder}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                      />
                    ) : (
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
                    )}
                  </label>
                ))}
              </div>
            </section>
          )
        })}

        <div className="flex justify-end">
          <Button type="submit" className="rounded-full" disabled={updatePendingInfo.isPending}>
            {updatePendingInfo.isPending ? "A guardar..." : "Guardar configuracoes pendentes"}
          </Button>
        </div>
      </form>
    </div>
  )
}

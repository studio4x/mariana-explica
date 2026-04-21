import { RefreshCw } from "lucide-react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAdminEmailStatus } from "@/hooks/useAdmin"

function transportLabel(transport: string | null) {
  if (transport === "smtp") {
    return "SMTP"
  }

  if (transport === "resend") {
    return "Resend"
  }

  if (transport === "postmark") {
    return "Postmark"
  }

  if (transport === "sendgrid") {
    return "SendGrid"
  }

  return "Nao definido"
}

export function AdminSettings() {
  const emailStatusQuery = useAdminEmailStatus()
  const email = emailStatusQuery.data

  if (emailStatusQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configuracoes" description="Estado operacional do email transacional do projeto." />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-8 w-40 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-3 h-4 w-52 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (emailStatusQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar as configuracoes de email"
        message={
          emailStatusQuery.error instanceof Error
            ? emailStatusQuery.error.message
            : "Tenta novamente dentro de instantes."
        }
        onRetry={() => void emailStatusQuery.refetch()}
      />
    )
  }

  if (!email) {
    return (
      <EmptyState
        title="Sem configuracoes disponiveis"
        message="O backend ainda nao devolveu estado suficiente para o email transacional."
      />
    )
  }

  const ready = email.ready
  const missingItems = email.missing

  const cards = [
    {
      label: "Transporte",
      value: transportLabel(email.transport),
      tone: ready ? "success" : "warning",
      note: email.providerName ? `Resolvido a partir de ${email.providerName}.` : "Resolver pelo ambiente do projeto.",
    },
    {
      label: "Remetente",
      value: email.senderAddressPresent ? "Configurado" : "Em falta",
      tone: email.senderAddressPresent ? "success" : "warning",
      note: email.senderNamePresent ? "Nome do remetente disponivel." : "Nome do remetente nao e obrigatorio.",
    },
    {
      label: "Reply-to",
      value: email.replyToPresent ? "Configurado" : "Opcional",
      tone: email.replyToPresent ? "success" : "neutral",
      note: email.replyToPresent ? "Resposta direcionada ao endereco correto." : "Pode ficar vazio se nao houver um destinatario de resposta dedicado.",
    },
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracoes"
        description="O email transacional usa as variaveis do projeto e o SMTP configurado no backend. Esta pagina apenas confirma o estado real."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void emailStatusQuery.refetch()}
            disabled={emailStatusQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {emailStatusQuery.isFetching ? "A validar..." : "Atualizar"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Estado geral</p>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-3xl font-bold text-slate-950">{ready ? "Pronto" : "Em falta"}</p>
            <StatusBadge label={ready ? "OK" : "Pendente"} tone={ready ? "success" : "warning"} />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {ready
              ? "O backend ja consegue enviar emails usando o ambiente do projeto."
              : "Ainda falta pelo menos uma variavel de email para fechar o envio transacional."}
          </p>
        </div>

        {cards.map((card) => (
          <div key={card.label} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <div className="mt-3 flex items-center gap-3">
              <p className="text-2xl font-bold text-slate-950">{card.value}</p>
              <StatusBadge
                label={card.tone === "success" ? "OK" : card.tone === "warning" ? "Pendente" : "Opcional"}
                tone={card.tone === "success" ? "success" : card.tone === "warning" ? "warning" : "neutral"}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.note}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Pendencias reais</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              So aparecem itens que o backend ainda nao consegue resolver sozinho a partir do ambiente do projeto.
            </p>
          </div>
          <StatusBadge label={missingItems.length === 0 ? "Sem pendencias" : `${missingItems.length} pendente(s)`} tone={missingItems.length === 0 ? "success" : "warning"} />
        </div>

        <div className="mt-6 space-y-3">
          {missingItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
              Nada manual precisa ser fornecido aqui. O SMTP do projeto ja cobre a entrega transacional.
            </div>
          ) : (
            missingItems.map((item) => (
              <div
                key={item}
                className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-amber-950">{item}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Este valor ainda precisa ser definido nas variaveis do projeto.
                  </p>
                </div>
                <StatusBadge label="Falta" tone="warning" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

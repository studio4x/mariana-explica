import { Link } from "react-router-dom"
import { CreditCard, ReceiptText } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { usePaymentHistory } from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import { formatProductPrice } from "@/utils/currency"
import { formatDate } from "@/utils/date"

function getPaymentStatusLabel(status: string) {
  if (status === "paid") return "Pago"
  if (status === "refunded") return "Reembolsado"
  if (status === "pending") return "Pendente"
  if (status === "cancelled") return "Cancelado"
  return "Falhou"
}

export function DashboardPayments() {
  const paymentsQuery = usePaymentHistory()

  if (paymentsQuery.isLoading) {
    return <LoadingState message="A carregar historico de pagamentos..." />
  }

  if (paymentsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os pagamentos"
        message={paymentsQuery.error instanceof Error ? paymentsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void paymentsQuery.refetch()}
      />
    )
  }

  const payments = paymentsQuery.data ?? []
  const totalPaidCents = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.final_price_cents, 0)
  const currency = payments[0]?.currency ?? "EUR"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="Historico dos pagamentos confirmados e reembolsos associados a tua conta."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pagamentos registados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{payments.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total pago</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{formatProductPrice(totalPaidCents, currency)}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-white/70">Fonte dos dados</p>
          <p className="mt-3 text-sm leading-7 text-white/82">
            Os pagamentos sao lidos dos pedidos confirmados no backend.
          </p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <EmptyState
            icon={<ReceiptText className="h-12 w-12 text-muted-foreground" />}
            title="Ainda sem pagamentos confirmados"
            message="Quando houver uma compra paga ou reembolsada, ela aparece aqui."
          />
          <div className="mt-2 flex justify-center">
            <Button asChild className="rounded-full">
              <Link to={ROUTES.COURSES}>Ver cursos disponiveis</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border bg-white shadow-sm">
          <div className="grid gap-3 p-4">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border bg-slate-50/80 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      <p className="font-semibold text-slate-950">{payment.product_title ?? "Curso"}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Criado em {formatDate(payment.created_at)}
                      {payment.paid_at ? ` · pago em ${formatDate(payment.paid_at)}` : ""}
                    </p>
                    {payment.payment_reference ? (
                      <p className="mt-2 break-all text-xs uppercase tracking-[0.16em] text-slate-500">
                        Ref. {payment.payment_reference}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                    <StatusBadge
                      label={getPaymentStatusLabel(payment.status)}
                      tone={payment.status === "paid" ? "success" : payment.status === "refunded" ? "warning" : "neutral"}
                    />
                    <p className="text-lg font-bold text-slate-950">
                      {formatProductPrice(payment.final_price_cents, payment.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

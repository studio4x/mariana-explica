import { useState } from "react"
import { Link } from "react-router-dom"
import { CreditCard, ExternalLink, ReceiptText } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  usePaymentHistory,
  useRequestStudentOrderRefund,
  useStudentOrderReceipt,
} from "@/hooks/useDashboard"
import { ROUTES } from "@/lib/constants"
import { formatProductPrice } from "@/utils/currency"
import { formatDate } from "@/utils/date"
import type { StudentPaymentSummary } from "@/types/app.types"

function getPaymentStatusLabel(status: string) {
  if (status === "paid") return "Pago"
  if (status === "refunded") return "Reembolsado"
  if (status === "pending") return "Pendente"
  if (status === "cancelled") return "Cancelado"
  return "Falhou"
}

function isRefundAvailable(payment: StudentPaymentSummary) {
  if (payment.status !== "paid") return false
  const referenceDate = payment.paid_at ?? payment.created_at
  const timestamp = new Date(referenceDate).getTime()
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000
}

export function DashboardPayments() {
  const paymentsQuery = usePaymentHistory()
  const receiptMutation = useStudentOrderReceipt()
  const refundMutation = useRequestStudentOrderRefund()
  const [refundPayment, setRefundPayment] = useState<StudentPaymentSummary | null>(null)
  const [confirmRefund, setConfirmRefund] = useState(false)
  const [refundMessage, setRefundMessage] = useState("")
  const [receiptLoadingOrderId, setReceiptLoadingOrderId] = useState<string | null>(null)

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

  const openReceipt = async (payment: StudentPaymentSummary) => {
    const receiptWindow = window.open("", "_blank")
    if (receiptWindow) {
      receiptWindow.opener = null
      receiptWindow.document.title = "A preparar fatura"
      receiptWindow.document.body.innerHTML = `
        <main style="font-family: Inter, Arial, sans-serif; padding: 32px; color: #0f172a; background: #ffffff; min-height: 100vh;">
          <p style="font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #64748b;">Mariana Explica</p>
          <h1 style="font-size: 24px; margin: 12px 0;">A preparar a tua fatura...</h1>
          <p style="color: #475569;">Esta janela vai abrir automaticamente dentro de instantes.</p>
        </main>
      `
    }

    setReceiptLoadingOrderId(payment.id)

    try {
      const result = await receiptMutation.mutateAsync(payment.id)
      if (receiptWindow) {
        receiptWindow.location.href = result.receipt_url
      } else {
        window.open(result.receipt_url, "_blank", "noopener,noreferrer")
      }
    } catch {
      if (receiptWindow) {
        receiptWindow.document.body.innerHTML = `
          <main style="font-family: Inter, Arial, sans-serif; padding: 32px; color: #0f172a; background: #ffffff; min-height: 100vh;">
            <p style="font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #b91c1c;">Erro</p>
            <h1 style="font-size: 24px; margin: 12px 0;">Nao foi possivel abrir a fatura</h1>
            <p style="color: #475569;">Volta a pagina anterior e tenta novamente.</p>
          </main>
        `
      }
    } finally {
      setReceiptLoadingOrderId(null)
    }
  }

  const submitRefundRequest = async () => {
    if (!refundPayment) return

    await refundMutation.mutateAsync({
      orderId: refundPayment.id,
      message: refundMessage.trim() || null,
    })
    setRefundPayment(null)
    setConfirmRefund(false)
    setRefundMessage("")
  }

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
                    <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={!payment.payment_reference || receiptLoadingOrderId === payment.id}
                        onClick={() => void openReceipt(payment)}
                      >
                        {receiptLoadingOrderId === payment.id ? "A abrir..." : "Ver fatura"}
                        <ExternalLink className="h-4 w-4" />
                      </Button>

                      {isRefundAvailable(payment) ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          onClick={() => {
                            setRefundPayment(payment)
                            setConfirmRefund(false)
                            setRefundMessage("")
                          }}
                        >
                          Solicitar reembolso
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {refundPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-2xl sm:p-8">
            {!confirmRefund ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Antes de cancelar
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold text-slate-950">
                  Podemos tentar resolver isto contigo?
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  O reembolso remove o acesso ao curso. Se o problema for acesso, pagamento, conteudo ou duvida de uso,
                  o suporte pode ajudar rapidamente sem perderes o material.
                </p>
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">{refundPayment.product_title ?? "Curso"}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Pedido {refundPayment.id.slice(0, 8)} · {formatProductPrice(refundPayment.final_price_cents, refundPayment.currency)}
                  </p>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to={`${ROUTES.DASHBOARD_SUPPORT}?openTicketModal=1&ticketStep=form`}>
                      Abrir ticket de suporte
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => setConfirmRefund(true)}
                  >
                    Reembolsar agora
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 w-full rounded-full"
                  onClick={() => setRefundPayment(null)}
                >
                  Voltar
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">
                  Confirmar reembolso
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold text-slate-950">
                  Tens certeza que queres pedir o reembolso?
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  O reembolso sera processado agora no pagamento. O acesso ao curso sera removido em seguida.
                </p>
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Mensagem opcional</span>
                  <textarea
                    value={refundMessage}
                    onChange={(event) => setRefundMessage(event.target.value)}
                    rows={4}
                    placeholder="Conta rapidamente o motivo do pedido..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setConfirmRefund(false)}
                    disabled={refundMutation.isPending}
                  >
                    Rever opcoes
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full bg-rose-700 hover:bg-rose-800"
                    onClick={() => void submitRefundRequest()}
                    disabled={refundMutation.isPending}
                  >
                    {refundMutation.isPending ? "A processar..." : "Confirmar reembolso"}
                  </Button>
                </div>
                {refundMutation.isError ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {refundMutation.error instanceof Error
                      ? refundMutation.error.message
                      : "Nao foi possivel processar o reembolso."}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

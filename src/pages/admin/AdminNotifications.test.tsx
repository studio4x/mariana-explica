import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AdminNotifications } from "./AdminNotifications"

const mockUseAdminNotificationCampaigns = vi.fn()
const mockUseAdminOperations = vi.fn()
const mockUseAdminUsers = vi.fn()
const mockUseAdminProducts = vi.fn()
const mockUseAdminProductCategories = vi.fn()
const mockUsePreviewAdminNotificationCampaign = vi.fn()
const mockUseRetryAdminEmailDelivery = vi.fn()
const mockUseSendAdminNotificationCampaign = vi.fn()

vi.mock("@/hooks/useAdmin", () => ({
  useAdminNotificationCampaigns: () => mockUseAdminNotificationCampaigns(),
  useAdminOperations: () => mockUseAdminOperations(),
  useAdminUsers: () => mockUseAdminUsers(),
  useAdminProducts: () => mockUseAdminProducts(),
  useAdminProductCategories: () => mockUseAdminProductCategories(),
  usePreviewAdminNotificationCampaign: () => mockUsePreviewAdminNotificationCampaign(),
  useRetryAdminEmailDelivery: () => mockUseRetryAdminEmailDelivery(),
  useSendAdminNotificationCampaign: () => mockUseSendAdminNotificationCampaign(),
}))

vi.mock("@/components/common", () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string
    description: string
    actions?: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{actions}</div>
    </div>
  ),
  StatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label="Mensagem da campanha"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

function buildHookState() {
  return {
    data: [],
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }
}

function renderPage() {
  const previewSpy = vi.fn().mockResolvedValue({
    totalRecipients: 2,
    sampleRecipients: [
      {
        id: "user-1",
        full_name: "Mariana Silva",
        email: "mariana@example.com",
      },
    ],
  })
  const sendSpy = vi.fn().mockResolvedValue({
    inserted_count: 2,
    email_recipient_count: 2,
    notification_count: 2,
  })
  const retrySpy = vi.fn().mockResolvedValue({
    success: true,
    emailDelivery: {
      id: "delivery-1",
      status: "queued",
    },
  })

  mockUseAdminNotificationCampaigns.mockReturnValue({
    ...buildHookState(),
    data: [
      {
        id: "campaign-1",
        actor_user_id: "admin-1",
        actor_name: "Admin Mariana",
        actor_email: "admin@example.com",
        created_at: "2026-07-07T19:00:00.000Z",
        audience: "segment",
        user_id: null,
        purchase_basis: "active_grants",
        role: "student",
        status: "active",
        type: "informational",
        title: "Campanha guardada",
        email_subject: "Assunto guardado",
        message_excerpt: "Resumo guardado",
        message_html: "<p>Mensagem guardada</p>",
        product_id: "prod-1",
        product_title: "Sebenta de Filosofia",
        product_category_id: "cat-1",
        product_category_title: "Sebentas individuais",
        cta_label: "Ver material",
        cta_url: "{{notifications_url}}",
        sent_via_email: true,
        sent_via_in_app: true,
        can_reuse: true,
        recipient_count: 2,
        email_recipient_count: 2,
        notification_count: 2,
      },
    ],
  })
  mockUseAdminOperations.mockReturnValue({
    ...buildHookState(),
    data: {
      queuedEmails: 1,
      failedEmails: 1,
      failedJobs: 0,
      deliveredEmails: 2,
      emailDeliveries: [
        {
          id: "delivery-1",
          user_id: "user-1",
          notification_id: "notification-1",
          email_to: "mariana@example.com",
          template_key: "manual_notification",
          provider: "smtp",
          provider_message_id: "provider-1",
          subject: "Assunto guardado",
          status: "failed",
          error_message: "SMTP timeout",
          sent_at: null,
          created_at: "2026-07-07T18:50:00.000Z",
        },
        {
          id: "delivery-2",
          user_id: "user-1",
          notification_id: "notification-2",
          email_to: "mariana@example.com",
          template_key: "manual_notification",
          provider: "smtp",
          provider_message_id: "provider-2",
          subject: "Outro email",
          status: "queued",
          error_message: null,
          sent_at: null,
          created_at: "2026-07-07T18:40:00.000Z",
        },
      ],
      jobRuns: [],
    },
  })
  mockUseAdminUsers.mockReturnValue({
    ...buildHookState(),
    data: [
      {
        id: "user-1",
        full_name: "Mariana Silva",
        email: "mariana@example.com",
        role: "student",
        status: "active",
      },
    ],
  })
  mockUseAdminProducts.mockReturnValue({
    ...buildHookState(),
    data: [
      {
        id: "prod-1",
        title: "Sebenta de Filosofia",
        category_id: "cat-1",
      },
      {
        id: "prod-2",
        title: "Curso Completo",
        category_id: "cat-2",
      },
    ],
  })
  mockUseAdminProductCategories.mockReturnValue({
    ...buildHookState(),
    data: [
      {
        id: "cat-1",
        title: "Sebentas individuais",
      },
      {
        id: "cat-2",
        title: "Cursos",
      },
    ],
  })
  mockUsePreviewAdminNotificationCampaign.mockReturnValue({
    isPending: false,
    mutateAsync: previewSpy,
  })
  mockUseRetryAdminEmailDelivery.mockReturnValue({
    isPending: false,
    mutateAsync: retrySpy,
  })
  mockUseSendAdminNotificationCampaign.mockReturnValue({
    isPending: false,
    mutateAsync: sendSpy,
  })

  render(<AdminNotifications />)

  return { previewSpy, retrySpy, sendSpy }
}

describe("AdminNotifications", () => {
  it("shows segment filters and inserts tags into the selected field", () => {
    renderPage()

    expect(screen.queryByText("Categoria comprada")).not.toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue("Todos os utilizadores elegiveis"), {
      target: { value: "segment" },
    })

    expect(screen.getByText("Categoria comprada")).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue("Mensagem"), {
      target: { value: "title" },
    })
    fireEvent.click(screen.getByRole("button", { name: "{{first_name}}" }))

    expect(screen.getByPlaceholderText("Ex.: Sessao extra disponivel")).toHaveValue("{{first_name}}")
  })

  it("sends the campaign payload with purchase filters and channels", async () => {
    const { sendSpy } = renderPage()

    fireEvent.change(screen.getByDisplayValue("Todos os utilizadores elegiveis"), {
      target: { value: "segment" },
    })
    fireEvent.change(screen.getByDisplayValue("Todos os papeis"), {
      target: { value: "student" },
    })
    fireEvent.change(screen.getByDisplayValue("Todos os estados"), {
      target: { value: "active" },
    })
    fireEvent.change(screen.getByDisplayValue("Todas as categorias"), {
      target: { value: "cat-1" },
    })
    fireEvent.change(screen.getByDisplayValue("Todos os materiais"), {
      target: { value: "prod-1" },
    })
    fireEvent.change(screen.getByPlaceholderText("Ex.: Sessao extra disponivel"), {
      target: { value: "Atualizacao {{product_title}}" },
    })
    fireEvent.change(screen.getByPlaceholderText("Opcional. Se vazio, o backend usa o titulo."), {
      target: { value: "Assunto {{product_title}}" },
    })
    fireEvent.change(screen.getByLabelText("Mensagem da campanha"), {
      target: { value: "<p>Nova aula disponivel</p>" },
    })
    fireEvent.change(screen.getByPlaceholderText("Ex.: Ver material"), {
      target: { value: "Ver material" },
    })
    fireEvent.change(screen.getByPlaceholderText("/aluno/notificacoes"), {
      target: { value: "{{notifications_url}}" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Enviar campanha" }))

    await waitFor(() =>
      expect(sendSpy).toHaveBeenCalledWith({
        audience: "segment",
        userId: undefined,
        role: "student",
        status: "active",
        productCategoryId: "cat-1",
        productId: "prod-1",
        purchaseBasis: "active_grants",
        type: "informational",
        title: "Atualizacao {{product_title}}",
        emailSubject: "Assunto {{product_title}}",
        messageHtml: "<p>Nova aula disponivel</p>",
        ctaLabel: "Ver material",
        ctaUrl: "{{notifications_url}}",
        sentViaEmail: true,
        sentViaInApp: true,
      }),
    )
  })

  it("fills the composer with the saved campaign when clicking reuse", async () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Reaproveitar" }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex.: Sessao extra disponivel")).toHaveValue("Campanha guardada")
      expect(screen.getByPlaceholderText("Opcional. Se vazio, o backend usa o titulo.")).toHaveValue("Assunto guardado")
      expect(screen.getByLabelText("Mensagem da campanha")).toHaveValue("<p>Mensagem guardada</p>")
      expect(screen.getByPlaceholderText("Ex.: Ver material")).toHaveValue("Ver material")
      expect(screen.getByPlaceholderText("/aluno/notificacoes")).toHaveValue("{{notifications_url}}")
    })
  })

  it("re-sends a saved campaign directly from history", async () => {
    const { sendSpy } = renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }))

    await waitFor(() =>
      expect(sendSpy).toHaveBeenCalledWith({
        audience: "segment",
        userId: undefined,
        role: "student",
        status: "active",
        productCategoryId: "cat-1",
        productId: "prod-1",
        purchaseBasis: "active_grants",
        type: "informational",
        title: "Campanha guardada",
        emailSubject: "Assunto guardado",
        messageHtml: "<p>Mensagem guardada</p>",
        ctaLabel: "Ver material",
        ctaUrl: "{{notifications_url}}",
        sentViaEmail: true,
        sentViaInApp: true,
      }),
    )
  })

  it("shows the sending queue tab with delivery statuses and retry action", async () => {
    const { retrySpy } = renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Fila de envio" }))

    expect(screen.queryByText("Criar campanha administrativa")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Fila de envio" })).toBeInTheDocument()
    expect(screen.getByText("SMTP timeout")).toBeInTheDocument()
    expect(screen.getByText("failed")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Reenfileirar email" }))

    await waitFor(() => expect(retrySpy).toHaveBeenCalledWith("delivery-1"))
  })
})

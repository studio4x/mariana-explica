import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AdminNotifications } from "./AdminNotifications"

const mockUseAdminNotificationCampaigns = vi.fn()
const mockUseAdminUsers = vi.fn()
const mockUseAdminProducts = vi.fn()
const mockUseAdminProductCategories = vi.fn()
const mockUsePreviewAdminNotificationCampaign = vi.fn()
const mockUseSendAdminNotificationCampaign = vi.fn()

vi.mock("@/hooks/useAdmin", () => ({
  useAdminNotificationCampaigns: () => mockUseAdminNotificationCampaigns(),
  useAdminUsers: () => mockUseAdminUsers(),
  useAdminProducts: () => mockUseAdminProducts(),
  useAdminProductCategories: () => mockUseAdminProductCategories(),
  usePreviewAdminNotificationCampaign: () => mockUsePreviewAdminNotificationCampaign(),
  useSendAdminNotificationCampaign: () => mockUseSendAdminNotificationCampaign(),
}))

vi.mock("@/components/common", () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
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

  mockUseAdminNotificationCampaigns.mockReturnValue(buildHookState())
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
  mockUseSendAdminNotificationCampaign.mockReturnValue({
    isPending: false,
    mutateAsync: sendSpy,
  })

  render(<AdminNotifications />)

  return { previewSpy, sendSpy }
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
})

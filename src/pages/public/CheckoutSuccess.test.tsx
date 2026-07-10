import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"
import { CheckoutSuccess } from "./CheckoutSuccess"

const mockUseAuth = vi.fn()
const mockCreateCheckoutAutologin = vi.fn()
const mockUseOptionalVisualEditorPage = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/services", () => ({
  createCheckoutAutologin: (...args: unknown[]) => mockCreateCheckoutAutologin(...args),
}))

vi.mock("@/features/site-editor/visual-editor", async () => {
  return {
    VisualEditorProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useOptionalVisualEditorPage: () => mockUseOptionalVisualEditorPage(),
    SiteContentScope: ({ children }: { children: ReactNode }) => <>{children}</>,
    EditableContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

function renderCheckoutSuccess(initialEntry = "/checkout/confirmacao?session_id=session_123&product_id=course-1&mode=stripe") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CheckoutSuccess />
    </MemoryRouter>,
  )
}

describe("CheckoutSuccess", () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockCreateCheckoutAutologin.mockReset()
    mockUseOptionalVisualEditorPage.mockReset()
    mockUseOptionalVisualEditorPage.mockReturnValue(null)
  })

  it("mostra um modal de processamento enquanto a confirmação está a ser preparada", async () => {
    mockUseAuth.mockReturnValue({
      session: null,
      profile: null,
      loading: false,
    })
    mockCreateCheckoutAutologin.mockReturnValue(new Promise(() => undefined))

    renderCheckoutSuccess()

    const dialog = await screen.findByRole("dialog", { name: /a tua compra está a ser processada/i })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/estamos a confirmar o pagamento/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(mockCreateCheckoutAutologin).toHaveBeenCalledWith(
        expect.objectContaining({
          checkoutSessionId: "session_123",
          productId: "course-1",
          nextPath: "/checkout/confirmacao?session_id=session_123&product_id=course-1&mode=stripe",
        }),
      )
    })
  })

  it("não exibe o modal quando o conteúdo final já pode ser mostrado", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } },
      profile: { status: "active" },
      loading: false,
    })

    renderCheckoutSuccess("/checkout/confirmacao?mode=stripe")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Obrigada pela confiança! <3" })).toBeInTheDocument()
  })
})

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteAiCodeEditorLauncher } from "./SiteAiCodeEditorLauncher"

const { mockUseAuth, mockUseAdminAiCodeEditorConfig, mockCreateTaskMutation } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseAdminAiCodeEditorConfig: vi.fn(),
  mockCreateTaskMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/useAdmin", () => ({
  useAdminAiCodeEditorConfig: () => mockUseAdminAiCodeEditorConfig(),
  useCreateAdminAiCodeEditorTask: () => mockCreateTaskMutation,
}))

function renderLauncher(pathname = "/sobre") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SiteAiCodeEditorLauncher />
    </MemoryRouter>,
  )
}

describe("SiteAiCodeEditorLauncher", () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseAdminAiCodeEditorConfig.mockReset()
    mockCreateTaskMutation.mutateAsync.mockReset()
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
    })
    mockUseAdminAiCodeEditorConfig.mockReturnValue({
      data: {
        config_value: {
          enabled: true,
        },
      },
      isLoading: false,
    })
    mockCreateTaskMutation.mutateAsync.mockResolvedValue({ id: "task-1" })
    mockCreateTaskMutation.isPending = false
  })

  it("renders the floating launcher and sends a task through the irrestrito chat", async () => {
    const user = userEvent.setup()
    renderLauncher()

    await user.click(screen.getByRole("button", { name: /abrir chat irrestrito/i }))
    await user.type(screen.getByRole("textbox", { name: /mensagem/i }), "altera o texto")
    await user.click(screen.getByRole("button", { name: /enviar pedido/i }))

    expect(mockCreateTaskMutation.mutateAsync).toHaveBeenCalledWith({
      prompt: "altera o texto",
    })
    expect(screen.getByText(/pedido enviado para o editor irrestrito/i)).toBeInTheDocument()
  })

  it("does not render when the editor irrestrito is disabled", () => {
    mockUseAdminAiCodeEditorConfig.mockReturnValue({
      data: {
        config_value: {
          enabled: false,
        },
      },
      isLoading: false,
    })

    renderLauncher()

    expect(screen.queryByRole("button", { name: /abrir chat irrestrito/i })).not.toBeInTheDocument()
  })
})

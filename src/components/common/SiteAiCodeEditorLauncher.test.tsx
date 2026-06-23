import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteAiCodeEditorLauncher } from "./SiteAiCodeEditorLauncher"

const { mockUseAuth, mockUseAdminAiCodeEditorConfig } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseAdminAiCodeEditorConfig: vi.fn(),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/useAdmin", () => ({
  useAdminAiCodeEditorConfig: () => mockUseAdminAiCodeEditorConfig(),
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
  })

  it("renders the floating launcher and opens the irrestrito chat iframe", async () => {
    const user = userEvent.setup()
    renderLauncher()

    await user.click(screen.getByRole("button", { name: /abrir chat irrestrito/i }))

    const iframe = screen.getByTitle("Editor IA irrestrito")
    expect(iframe).toHaveAttribute("src", "/admin/editor-ia-irrestrito/chat")
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

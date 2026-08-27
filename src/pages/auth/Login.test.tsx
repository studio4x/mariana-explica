import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Login } from "./Login"

const mockUseAuth = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockResend = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/integrations/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

describe("Login", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isAdmin: false })
    mockSignInWithPassword.mockReset()
    mockResend.mockReset()
  })

  it("allows resending the activation email after an unconfirmed-account login error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("Email not confirmed"),
    })
    mockResend.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText("Email"), "aluna@example.com")
    await user.type(screen.getByLabelText("Palavra-passe"), "segredo123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    const resendButton = await screen.findByRole("button", { name: "Reenviar email de ativação" })
    await user.click(resendButton)

    await waitFor(() => expect(mockResend).toHaveBeenCalledTimes(1))
    const resendInput = mockResend.mock.calls[0][0]
    const callbackUrl = new URL(resendInput.options.emailRedirectTo)

    expect(resendInput.type).toBe("signup")
    expect(resendInput.email).toBe("aluna@example.com")
    expect(callbackUrl.pathname).toBe("/auth/callback")
    expect(callbackUrl.searchParams.get("next")).toBe("/aluno/dashboard")
    expect(await screen.findByText("Enviamos um novo email de ativação. Confirma também a pasta de spam.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Email reenviado" })).toBeDisabled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AuthCallback } from "./AuthCallback"

const mockUseAuth = vi.fn()
const mockGetSession = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/integrations/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      setSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe("AuthCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseAuth.mockReturnValue({ session: null, profile: null, loading: false })
    mockGetSession.mockReset()
    mockGetSession.mockImplementation(() => new Promise(() => undefined))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows changing progress messages while account verification is running", () => {
    render(
      <MemoryRouter initialEntries={["/auth/callback?next=%2Faluno%2Fdashboard"]}>
        <AuthCallback />
      </MemoryRouter>,
    )

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-busy", "true")
    expect(screen.getByText("A validar o link de confirmação...")).toBeInTheDocument()
    expect(screen.getByText("Este processo pode demorar alguns segundos. Mantém esta página aberta.")).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_800))
    expect(screen.getByText("A confirmar o teu email...")).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_800))
    expect(screen.getByText("A criar uma sessão segura...")).toBeInTheDocument()
  })
})

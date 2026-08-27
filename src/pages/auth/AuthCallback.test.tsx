import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { AuthCallback } from "./AuthCallback"

const mockUseAuth = vi.fn()
const mockGetSession = vi.fn()
const mockRefreshProfile = vi.fn()

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
    mockUseAuth.mockReturnValue({
      session: null,
      profile: null,
      loading: false,
      refreshProfile: mockRefreshProfile,
    })
    mockGetSession.mockReset()
    mockGetSession.mockImplementation(() => new Promise(() => undefined))
    mockRefreshProfile.mockReset()
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

  it("refreshes a stale inactive profile before redirecting to the dashboard", async () => {
    vi.useRealTimers()
    const session = { user: { id: "student-1" } }

    mockUseAuth.mockReturnValue({
      session,
      profile: {
        id: "student-1",
        role: "student",
        is_admin: false,
        status: "inactive",
      },
      loading: false,
      refreshProfile: mockRefreshProfile,
    })
    mockGetSession.mockResolvedValue({ data: { session } })
    mockRefreshProfile.mockResolvedValue({
      id: "student-1",
      full_name: "Aluno Teste",
      email: "aluno@example.com",
      nif: null,
      avatar_url: null,
      role: "student",
      is_admin: false,
      status: "active",
      content_updates_consent: false,
    })

    render(
      <MemoryRouter initialEntries={["/auth/callback?next=%2Faluno%2Fdashboard"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/aluno/dashboard" element={<div>Painel do aluno</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("Painel do aluno")).toBeInTheDocument()
    expect(mockRefreshProfile).toHaveBeenCalled()
    expect(screen.queryByText("Não foi possível concluir a verificação")).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem("mariana-explica:auth-flash")).toBe(
      "Email confirmado com sucesso. Já tens acesso ativo ao teu painel.",
    )
  })

  it("keeps a remotely blocked profile out of the private area", async () => {
    vi.useRealTimers()
    const session = { user: { id: "student-blocked" } }

    mockUseAuth.mockReturnValue({
      session,
      profile: null,
      loading: false,
      refreshProfile: mockRefreshProfile,
    })
    mockGetSession.mockResolvedValue({ data: { session } })
    mockRefreshProfile.mockResolvedValue({
      id: "student-blocked",
      full_name: "Aluno Bloqueado",
      email: "bloqueado@example.com",
      nif: null,
      avatar_url: null,
      role: "student",
      is_admin: false,
      status: "blocked",
      content_updates_consent: false,
    })

    render(
      <MemoryRouter initialEntries={["/auth/callback?next=%2Faluno%2Fdashboard"]}>
        <AuthCallback />
      </MemoryRouter>,
    )

    expect(await screen.findByText("Não foi possível concluir a verificação")).toBeInTheDocument()
    expect(
      screen.getByText("A tua conta foi validada, mas ainda não está com acesso ativo. Se precisares, fala com o suporte."),
    ).toBeInTheDocument()
  })

  it("keeps showing progress while an inactive profile becomes active", async () => {
    vi.useRealTimers()
    const session = { user: { id: "student-pending" } }
    const baseProfile = {
      id: "student-pending",
      full_name: "Aluno Pendente",
      email: "pendente@example.com",
      nif: null,
      avatar_url: null,
      role: "student" as const,
      is_admin: false,
      content_updates_consent: false,
    }

    mockUseAuth.mockReturnValue({
      session,
      profile: { ...baseProfile, status: "inactive" },
      loading: false,
      refreshProfile: mockRefreshProfile,
    })
    mockGetSession.mockResolvedValue({ data: { session } })
    mockRefreshProfile
      .mockResolvedValueOnce({ ...baseProfile, status: "inactive" })
      .mockResolvedValue({ ...baseProfile, status: "active" })

    render(
      <MemoryRouter initialEntries={["/auth/callback?next=%2Faluno%2Fdashboard"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/aluno/dashboard" element={<div>Acesso sincronizado</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true")
    expect(screen.queryByText("Não foi possível concluir a verificação")).not.toBeInTheDocument()
    expect(await screen.findByText("Acesso sincronizado", {}, { timeout: 2_000 })).toBeInTheDocument()
    expect(mockRefreshProfile).toHaveBeenCalledTimes(2)
  })
})

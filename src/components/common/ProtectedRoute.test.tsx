import { describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import { ProtectedRoute } from "./ProtectedRoute"

const mockUseAuth = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

describe("ProtectedRoute", () => {
  it("renders children for an active authenticated user", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active" },
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Área protegida</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Área protegida")).toBeInTheDocument()
  })

  it("allows an authenticated admin to open the student area", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active", role: "admin", is_admin: true },
      loading: false,
      isAdmin: true,
    })

    render(
      <MemoryRouter initialEntries={["/aluno/dashboard"]}>
        <Routes>
          <Route
            path="/aluno/dashboard"
            element={
              <ProtectedRoute>
                <div>Preview do aluno</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Preview do aluno")).toBeInTheDocument()
  })

  it("redirects unauthenticated users to login", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      profile: null,
      loading: false,
    })

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Área protegida</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Login")).toBeInTheDocument()
  })

  it("redirects to login when session exists but profile is not ready", async () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: null,
      loading: false,
      isAdmin: false,
      refreshSession: vi.fn(() => new Promise(() => undefined)),
    })

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Área protegida</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("Login")).toBeInTheDocument()
  })

  it("keeps rendering when session and profile are valid during a background refresh", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active" },
      loading: true,
      isAdmin: false,
    })

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Área protegida</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Área protegida")).toBeInTheDocument()
  })
})

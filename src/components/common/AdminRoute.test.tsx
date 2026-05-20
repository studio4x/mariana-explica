import { describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { render, screen, waitFor } from "@testing-library/react"
import { AdminRoute } from "./AdminRoute"

const mockUseAuth = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

describe("AdminRoute", () => {
  it("renders children for an active admin", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active", is_admin: true, role: "admin" },
      loading: false,
      isAdmin: true,
      refreshSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Painel admin</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Painel admin")).toBeInTheDocument()
  })

  it("redirects non-admin users to home", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active", is_admin: false, role: "student" },
      loading: false,
      isAdmin: false,
      refreshSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Painel admin</div>
              </AdminRoute>
            }
          />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Home")).toBeInTheDocument()
  })

  it("redirects inconsistent admin flags to home", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active", is_admin: true, role: "student" },
      loading: false,
      isAdmin: false,
      refreshSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Painel admin</div>
              </AdminRoute>
            }
          />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Home")).toBeInTheDocument()
  })

  it("shows recovery state while trying to restore a missing profile", () => {
    const refreshSession = vi.fn().mockResolvedValue(false)

    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: null,
      loading: false,
      refreshSession,
      isAdmin: false,
    })

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Painel admin</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("A validar acesso administrativo...")).toBeInTheDocument()
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it("redirects to login when profile cannot be recovered", async () => {
    const refreshSession = vi.fn().mockResolvedValue(false)

    mockUseAuth
      .mockReturnValueOnce({
        session: { access_token: "token" },
        profile: null,
        loading: false,
        refreshSession,
        isAdmin: false,
      })
      .mockReturnValue({
        session: null,
        profile: null,
        loading: false,
        refreshSession,
        isAdmin: false,
      })

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Painel admin</div>
              </AdminRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText("Login")).toBeInTheDocument()
    })
  })

  it("keeps rendering admin while session refreshes in the background", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: { status: "active", is_admin: true, role: "admin" },
      loading: true,
      isAdmin: true,
      refreshSession: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Painel admin</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Painel admin")).toBeInTheDocument()
  })
})

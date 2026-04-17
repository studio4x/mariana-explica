import { describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { render, screen } from "@testing-library/react"
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

  it("shows session recovery when profile is missing", () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: "token" },
      profile: null,
      loading: false,
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

    expect(screen.getByText("Sessao do admin precisa ser recarregada")).toBeInTheDocument()
  })
})

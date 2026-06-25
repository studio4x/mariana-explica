import { describe, expect, it } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import { AdminAiCodeEditorDisabled } from "./AdminAiCodeEditorDisabled"

describe("AdminAiCodeEditorDisabled", () => {
  it("renders a disabled state for the unrestricted AI editor route", () => {
    render(
      <MemoryRouter>
        <AdminAiCodeEditorDisabled />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "Editor desativado" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Fluxo novo desativado" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Abrir editor legado" })).toHaveAttribute("href", "/admin/editor-paginas")
    expect(screen.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/admin")
  })
})

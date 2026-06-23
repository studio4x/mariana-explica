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

    expect(screen.getByRole("heading", { name: "Editor IA Irrestrito" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Acesso desativado" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Abrir Editor Visual" })).toHaveAttribute("href", "/admin/editor-visual")
    expect(screen.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/admin")
  })
})

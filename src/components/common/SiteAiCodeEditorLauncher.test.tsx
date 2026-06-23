import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteAiCodeEditorLauncher } from "./SiteAiCodeEditorLauncher"

function renderLauncher(pathname = "/sobre") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SiteAiCodeEditorLauncher />
    </MemoryRouter>,
  )
}

describe("SiteAiCodeEditorLauncher", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("does not render the irrestrito launcher", () => {
    renderLauncher()

    expect(screen.queryByRole("button", { name: /abrir chat irrestrito/i })).not.toBeInTheDocument()
  })
})

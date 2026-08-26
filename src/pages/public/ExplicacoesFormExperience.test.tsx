import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExplicacoesFormExperience } from "./ExplicacoesFormExperience"

vi.mock("@/services", () => ({
  submitPublicForm: vi.fn(),
}))

describe("ExplicacoesFormExperience", () => {
  it("mostra as instrucoes atualizadas para pedidos de explicacoes", () => {
    render(<ExplicacoesFormExperience />)

    expect(
      screen.getByText("Se o teu pedido for para Explicações, indica obrigatoriamente nesta caixa:"),
    ).toBeInTheDocument()
    expect(screen.getByText("O ano escolar do aluno (10°, 11.º, 12.º ano)")).toBeInTheDocument()
    expect(screen.getByText("A disciplina pretendida (Filosofia ou Português)")).toBeInTheDocument()
  })
})

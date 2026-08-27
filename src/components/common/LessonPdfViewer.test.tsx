import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LessonPdfViewer } from "./LessonPdfViewer"

const { mockUseLessonFileAccess } = vi.hoisted(() => ({
  mockUseLessonFileAccess: vi.fn(),
}))

vi.mock("@/hooks/useDashboard", () => ({
  useLessonFileAccess: (...args: unknown[]) => mockUseLessonFileAccess(...args),
}))

describe("LessonPdfViewer", () => {
  beforeEach(() => {
    mockUseLessonFileAccess.mockReset()
  })

  it("does not request or render an inline PDF outside the file lesson mode", () => {
    mockUseLessonFileAccess.mockReturnValue({})

    const { container } = render(
      <LessonPdfViewer
        lessonId="lesson-1"
        lessonType="video"
        storagePath="lessons/lesson-1/material.pdf"
        fileName="Material.pdf"
      />,
    )

    expect(mockUseLessonFileAccess).toHaveBeenCalledWith(undefined)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the protected loading state while preparing a file lesson", () => {
    mockUseLessonFileAccess.mockReturnValue({ isLoading: true })

    render(
      <LessonPdfViewer
        lessonId="lesson-1"
        lessonType="file"
        storagePath="lessons/lesson-1/material.pdf"
        fileName="Material.pdf"
      />,
    )

    expect(mockUseLessonFileAccess).toHaveBeenCalledWith("lesson-1")
    expect(screen.getByText("A preparar o visualizador protegido...")).toBeInTheDocument()
  })

  it("renders the signed PDF inline and keeps an external viewer fallback", () => {
    mockUseLessonFileAccess.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { url: "https://files.test/material.pdf?token=signed" },
    })

    render(
      <LessonPdfViewer
        lessonId="lesson-1"
        lessonType="file"
        storagePath="lessons/lesson-1/material.pdf"
        fileName="Material.pdf"
      />,
    )

    expect(screen.getByTitle("Visualizador do PDF — Material.pdf")).toHaveAttribute(
      "src",
      "https://files.test/material.pdf?token=signed#toolbar=1&navpanes=0&view=FitH",
    )
    expect(screen.getByRole("link", { name: "Abrir em nova janela" })).toHaveAttribute(
      "href",
      "https://files.test/material.pdf?token=signed",
    )
  })

  it("shows the access error and retries the signed URL request", () => {
    const refetch = vi.fn()
    mockUseLessonFileAccess.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("Acesso temporário indisponível."),
      refetch,
    })

    render(
      <LessonPdfViewer
        lessonId="lesson-1"
        lessonType="file"
        storagePath="lessons/lesson-1/material.pdf"
        fileName="Material.pdf"
      />,
    )

    expect(screen.getByText("Acesso temporário indisponível.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})

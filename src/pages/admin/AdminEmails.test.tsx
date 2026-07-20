import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AdminEmails } from "./AdminEmails"
import type {
  AdminPlatformEmailTemplateContent,
  AdminPlatformEmailTemplatePreview,
  AdminPlatformEmailTemplatesConfig,
} from "@/types/app.types"

const mockUseAdminEmailTemplates = vi.fn()
const mockUsePreviewAdminEmailTemplate = vi.fn()
const mockUseUpdateAdminEmailTemplate = vi.fn()
const mockUseResetAdminEmailTemplate = vi.fn()

vi.mock("@/hooks/useAdmin", () => ({
  useAdminEmailTemplates: () => mockUseAdminEmailTemplates(),
  usePreviewAdminEmailTemplate: () => mockUsePreviewAdminEmailTemplate(),
  useUpdateAdminEmailTemplate: () => mockUseUpdateAdminEmailTemplate(),
  useResetAdminEmailTemplate: () => mockUseResetAdminEmailTemplate(),
}))

function createPreview(
  templateKey: AdminPlatformEmailTemplatePreview["templateKey"],
): AdminPlatformEmailTemplatePreview {
  return {
    templateKey,
    subject: "Assunto de preview",
    html: "<p>Preview</p>",
    text: "Preview",
    sampleData: {},
  }
}

function buildContent(subject: string): AdminPlatformEmailTemplateContent {
  return {
    subject,
    eyebrow: "Eyebrow",
    title: "Titulo",
    greeting: "Ola,",
    intro: "Intro",
    bullets: ["Primeiro bullet"],
    ctaLabel: "Abrir",
    ctaUrl: "/aluno/dashboard",
    footer: "Rodape",
  }
}

function buildConfig(): AdminPlatformEmailTemplatesConfig {
  return {
    config_key: "platform_email_templates",
    description: "Templates",
    is_public: false,
    updated_at: "2026-07-07T12:00:00.000Z",
    templates: [
      {
        key: "purchase_confirmed",
        label: "Compra confirmada",
        description: "Primeiro template",
        category: "Comercial",
        availableVariables: ["product_title"],
        sampleData: { product_title: "Pack" },
        content: buildContent("Assunto compra"),
        isCustomized: false,
      },
      {
        key: "support_ticket_created",
        label: "Ticket criado",
        description: "Segundo template",
        category: "Suporte",
        availableVariables: ["ticket_subject"],
        sampleData: { ticket_subject: "Ajuda" },
        content: buildContent("Assunto suporte"),
        isCustomized: true,
      },
      {
        key: "course_chat_message_created",
        label: "Mensagem no chat de materiais",
        description: "Template do chat de materiais",
        category: "Chat de materiais",
        availableVariables: ["product_title", "message_preview"],
        sampleData: { product_title: "Pack", message_preview: "Duvida" },
        content: buildContent("Assunto chat"),
        isCustomized: false,
      },
    ],
  }
}

describe("AdminEmails", () => {
  it("switches the editor fields when another template is selected", async () => {
    mockUseAdminEmailTemplates.mockReturnValue({
      data: buildConfig(),
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUsePreviewAdminEmailTemplate.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockImplementation(async ({ templateKey }) => createPreview(templateKey)),
    })
    mockUseUpdateAdminEmailTemplate.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    })
    mockUseResetAdminEmailTemplate.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    })

    render(<AdminEmails />)

    expect(screen.getByDisplayValue("Assunto compra")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Ticket criado/i }))

    expect(await screen.findByDisplayValue("Assunto suporte")).toBeInTheDocument()
  })

  it("keeps the material chat template available in the editor", async () => {
    mockUseAdminEmailTemplates.mockReturnValue({
      data: buildConfig(),
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUsePreviewAdminEmailTemplate.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockImplementation(async ({ templateKey }) => createPreview(templateKey)),
    })
    mockUseUpdateAdminEmailTemplate.mockReturnValue({ isPending: false, mutateAsync: vi.fn() })
    mockUseResetAdminEmailTemplate.mockReturnValue({ isPending: false, mutateAsync: vi.fn() })

    render(<AdminEmails />)

    fireEvent.click(screen.getByRole("button", { name: /Mensagem no chat de materiais/i }))

    expect(await screen.findByDisplayValue("Assunto chat")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Titulo")).toBeInTheDocument()
  })

  it("keeps the save action enabled while the template list refreshes", async () => {
    mockUseAdminEmailTemplates.mockReturnValue({
      data: buildConfig(),
      isLoading: false,
      isError: false,
      isFetching: true,
      error: null,
      refetch: vi.fn(),
    })
    mockUsePreviewAdminEmailTemplate.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockImplementation(async ({ templateKey }) => createPreview(templateKey)),
    })
    mockUseUpdateAdminEmailTemplate.mockReturnValue({ isPending: false, mutateAsync: vi.fn() })
    mockUseResetAdminEmailTemplate.mockReturnValue({ isPending: false, mutateAsync: vi.fn() })

    render(<AdminEmails />)

    expect(screen.getByRole("button", { name: "Guardar template" })).toBeEnabled()
  })
})

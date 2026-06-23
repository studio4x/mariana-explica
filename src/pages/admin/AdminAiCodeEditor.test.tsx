import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminAiCodeEditor } from "./AdminAiCodeEditor"
import { ROUTES } from "@/lib/constants"
import type { AdminAiCodeEditorTask } from "@/types/app.types"

const mockUseAdminAiCodeEditorConfig = vi.fn()
const mockUseAdminAiCodeEditorTasks = vi.fn()
const mockUseAdminAiCodeEditorTask = vi.fn()
const mockUseUpdateAdminAiCodeEditorConfig = vi.fn()
const mockUseCreateAdminAiCodeEditorTask = vi.fn()
const mockUseStartAdminAiCodeEditorTaskExecution = vi.fn()
const mockUseRefreshAdminAiCodeEditorTaskStatus = vi.fn()
const mockUseRefreshAdminAiCodeEditorTaskPreview = vi.fn()
const mockUseApproveAdminAiCodeEditorTask = vi.fn()
const mockUseRejectAdminAiCodeEditorTask = vi.fn()
const mockUseRequestAdjustmentAdminAiCodeEditorTask = vi.fn()
const mockUseRollbackAdminAiCodeEditorTask = vi.fn()

vi.mock("@/hooks/useAdmin", () => ({
  useAdminAiCodeEditorConfig: () => mockUseAdminAiCodeEditorConfig(),
  useAdminAiCodeEditorTasks: () => mockUseAdminAiCodeEditorTasks(),
  useAdminAiCodeEditorTask: () => mockUseAdminAiCodeEditorTask(),
  useUpdateAdminAiCodeEditorConfig: () => mockUseUpdateAdminAiCodeEditorConfig(),
  useCreateAdminAiCodeEditorTask: () => mockUseCreateAdminAiCodeEditorTask(),
  useStartAdminAiCodeEditorTaskExecution: () => mockUseStartAdminAiCodeEditorTaskExecution(),
  useRefreshAdminAiCodeEditorTaskStatus: () => mockUseRefreshAdminAiCodeEditorTaskStatus(),
  useRefreshAdminAiCodeEditorTaskPreview: () => mockUseRefreshAdminAiCodeEditorTaskPreview(),
  useApproveAdminAiCodeEditorTask: () => mockUseApproveAdminAiCodeEditorTask(),
  useRejectAdminAiCodeEditorTask: () => mockUseRejectAdminAiCodeEditorTask(),
  useRequestAdjustmentAdminAiCodeEditorTask: () => mockUseRequestAdjustmentAdminAiCodeEditorTask(),
  useRollbackAdminAiCodeEditorTask: () => mockUseRollbackAdminAiCodeEditorTask(),
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function createMutation<T>(result: T) {
  return {
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue(result),
  }
}

const configValue = {
  enabled: true,
  make_default: true,
  legacy_editor_fallback_enabled: false,
  worker_mode: "github_worker",
  github_repository: "studio4x/mariana-explica",
  vercel_project_name: "mariana-explica",
  primary_provider: "openai",
  secondary_provider: "gemini",
  primary_model: "gpt-4.1-mini",
  secondary_model: "gemini-2.0-flash",
  auto_run_tests: true,
  auto_run_build: true,
  request_preview_deploy: true,
  require_explicit_publish_confirmation: true,
  generation_mode: "ai_enabled",
  provider_statuses: {
    openai: {
      configured: true,
      model: "gpt-4.1-mini",
      status: "ready",
      last_error: null,
      last_error_at: null,
    },
    gemini: {
      configured: false,
      model: "gemini-2.0-flash",
      status: "not_configured",
      last_error: null,
      last_error_at: null,
    },
  },
  github_configured: true,
  vercel_configured: true,
} as const

const configResponse = {
  data: { config_value: configValue },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

const tasksResponse = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

const taskResponse = {
  data: null,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

const sampleTask: AdminAiCodeEditorTask = {
  id: "task-1",
  requested_by: "user-1",
  approved_by: null,
  prompt: "Alterar a cor do texto",
  normalized_prompt: "Alterar a cor do texto",
  title: "Atualizar destaque visual",
  summary: "Ajustar a cor do texto principal para melhorar contraste.",
  status: "ready_for_review",
  scope_classification: "text",
  risk_level: "medium",
  worker_mode: "github_worker",
  branch_name: "ai/update-text-color",
  default_branch: "main",
  commit_message: "Update important text color",
  commit_sha: "abc123def456",
  pull_request_number: 12,
  pull_request_url: "https://github.com/studio4x/mariana-explica/pull/12",
  pull_request_status: "open",
  preview_url: "https://preview.example.com/task-1",
  preview_status: "ready",
  test_status: "passed",
  build_status: "passed",
  files_analyzed: ["src/pages/Home.tsx"],
  files_planned: ["src/pages/Home.tsx"],
  plan_json: { steps: ["Encontrar o bloco", "Atualizar a cor"] },
  result_summary: "Patch aplicado e pronto para revisao.",
  sensitive_change: false,
  sensitive_reasons: [],
  requires_explicit_publish_confirmation: true,
  published_at: null,
  rolled_back_at: null,
  approved_at: null,
  execution_error: null,
  last_execution_at: "2026-06-22T10:00:00Z",
  merged_at: null,
  metadata: {
    rollback_pull_request_url: "https://github.com/studio4x/mariana-explica/pull/99",
    rollback_pull_request_number: 99,
    rollback_pull_request_status: "open",
    rollback_branch_name: "ai/rollback-task-1",
    provider_attempts: [
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        failureType: "none",
        message: "ok",
      },
    ],
  },
  created_at: "2026-06-22T09:00:00Z",
  updated_at: "2026-06-22T10:00:00Z",
  file_changes: [
    {
      id: "change-1",
      task_id: "task-1",
      file_path: "src/pages/Home.tsx",
      change_type: "modify",
      status: "applied",
      rationale: "Atualizacao visual pontual.",
      summary: "Cor do texto atualizada.",
      diff_preview: "+ color: #fff",
      diff_patch: "+ color: #fff",
      before_sha: "1111111",
      after_sha: "2222222",
      language: "tsx",
      risk_level: "low",
      metadata: {},
      created_at: "2026-06-22T09:00:00Z",
      updated_at: "2026-06-22T10:00:00Z",
    },
  ],
  events: [
    {
      id: "event-1",
      task_id: "task-1",
      actor_user_id: null,
      event_type: "created",
      message: "Task criada",
      metadata: {},
      created_at: "2026-06-22T09:00:00Z",
    },
    {
      id: "event-2",
      task_id: "task-1",
      actor_user_id: null,
      event_type: "planned",
      message: "Plano gerado",
      metadata: {},
      created_at: "2026-06-22T09:10:00Z",
    },
    {
      id: "event-3",
      task_id: "task-1",
      actor_user_id: null,
      event_type: "preview_ready",
      message: "Preview pronto",
      metadata: {},
      created_at: "2026-06-22T09:20:00Z",
    },
    {
      id: "event-4",
      task_id: "task-1",
      actor_user_id: null,
      event_type: "checks_passed",
      message: "Checks concluidos",
      metadata: {},
      created_at: "2026-06-22T09:30:00Z",
    },
  ],
  deploys: [],
}

const secondTask: AdminAiCodeEditorTask = {
  ...sampleTask,
  id: "task-2",
  prompt: "Refinar cards antigos",
  normalized_prompt: "Refinar cards antigos",
  title: "Refinar cards antigos",
  summary: "Task secundaria para validar a inbox compacta.",
  status: "failed",
  risk_level: "low",
  preview_status: "failed",
  test_status: "failed",
  build_status: "failed",
  pull_request_number: 18,
  pull_request_url: "https://github.com/studio4x/mariana-explica/pull/18",
  created_at: "2026-06-21T09:00:00Z",
  updated_at: "2026-06-21T10:00:00Z",
}

beforeEach(() => {
  mockUseAdminAiCodeEditorConfig.mockReturnValue(configResponse)
  mockUseAdminAiCodeEditorTasks.mockReturnValue(tasksResponse)
  mockUseAdminAiCodeEditorTask.mockReturnValue(taskResponse)
  mockUseUpdateAdminAiCodeEditorConfig.mockReturnValue(createMutation({ config_value: configValue }))
  mockUseCreateAdminAiCodeEditorTask.mockReturnValue(createMutation({ id: "task-1", worker_mode: "github_worker" }))
  mockUseStartAdminAiCodeEditorTaskExecution.mockReturnValue(createMutation({ id: "task-1" }))
  mockUseRefreshAdminAiCodeEditorTaskStatus.mockReturnValue(createMutation({ id: "task-1" }))
  mockUseRefreshAdminAiCodeEditorTaskPreview.mockReturnValue(createMutation({ id: "task-1" }))
  mockUseApproveAdminAiCodeEditorTask.mockReturnValue(createMutation({ id: "task-1" }))
  mockUseRejectAdminAiCodeEditorTask.mockReturnValue(createMutation({ id: "task-1" }))
  mockUseRequestAdjustmentAdminAiCodeEditorTask.mockReturnValue(createMutation({ id: "task-1" }))
  mockUseRollbackAdminAiCodeEditorTask.mockReturnValue(createMutation({ id: "task-1" }))
})

function renderEditor(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/editor-ia-irrestrito" element={<Navigate to={ROUTES.ADMIN_AI_CODE_EDITOR_CHAT} replace />} />
        <Route
          path="/admin/editor-ia-irrestrito/:tab"
          element={
            <>
              <AdminAiCodeEditor />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe("AdminAiCodeEditor", () => {
  it("redirects the base route to the chat tab", async () => {
    renderEditor("/admin/editor-ia-irrestrito")

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/editor-ia-irrestrito/chat")
    })
    expect(screen.getByRole("tab", { name: /Chat/ })).toHaveAttribute("aria-selected", "true")
  })

  it.each([
    ["/admin/editor-ia-irrestrito/chat", "Chat"],
    ["/admin/editor-ia-irrestrito/tasks", "Tasks"],
    ["/admin/editor-ia-irrestrito/configuracao", "Configura"],
  ] as const)("opens the %s slug on load", async (path, tabLabel) => {
    renderEditor(path)

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(path)
    })
    expect(screen.getByRole("tab", { name: new RegExp(tabLabel) })).toHaveAttribute("aria-selected", "true")
  })

  it("redirects an invalid slug back to chat", async () => {
    renderEditor("/admin/editor-ia-irrestrito/slug-invalida")

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/editor-ia-irrestrito/chat")
    })
    expect(screen.getByRole("tab", { name: /Chat/ })).toHaveAttribute("aria-selected", "true")
  })

  it("switches slugs when the admin changes tabs", async () => {
    const user = userEvent.setup()
    renderEditor("/admin/editor-ia-irrestrito/chat")

    await user.click(screen.getByRole("tab", { name: /Tasks/ }))

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/admin/editor-ia-irrestrito/tasks")
    })
  })

  it("renders the chat panel at full width", async () => {
    renderEditor("/admin/editor-ia-irrestrito/chat")

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/altere o layout dos cards da pagina de materiais/i)).toBeInTheDocument()
    })

    expect(screen.getByTestId("ai-editor-chat-panel")).toHaveClass("w-full")
  })

  it("renders the redesigned tasks inbox with collapsed heavy sections by default", async () => {
    const user = userEvent.setup()
    mockUseAdminAiCodeEditorTasks.mockReturnValue({
      ...tasksResponse,
      data: [sampleTask, secondTask],
    })
    mockUseAdminAiCodeEditorTask.mockReturnValue({
      data: sampleTask,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderEditor("/admin/editor-ia-irrestrito/tasks")

    await waitFor(() => {
      expect(screen.getByTestId("ai-editor-tasks-panel")).toBeInTheDocument()
    })

    expect(screen.getByText("Tarefas do Editor IA")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText(/Prontas p\/ revis/i)).toBeInTheDocument()
    expect(screen.getByText("Com rollback")).toBeInTheDocument()
    expect(screen.getByText("Inbox de tasks")).toBeInTheDocument()
    expect(screen.getByTestId("ai-editor-task-list")).toHaveClass("overflow-y-auto")
    expect(screen.getByText(secondTask.title)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: sampleTask.title })).toBeInTheDocument()
    expect(screen.getByText("Arquivos analisados")).toBeInTheDocument()
    expect(screen.getByText("Acoes principais")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Arquivos e diff/i }))

    expect(screen.getByRole("button", { name: "Ver diff" })).toBeInTheDocument()
    expect(screen.queryByText("+ color: #fff")).not.toBeInTheDocument()
    expect(screen.queryByText("Task criada")).not.toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: /Mostra so os eventos recentes/i })[0])

    expect(screen.getByRole("button", { name: /Ver auditoria completa/i })).toBeInTheDocument()
    expect(screen.getByText("Task criada")).toBeInTheDocument()
  })

  it("keeps configuration save working", async () => {
    const user = userEvent.setup()
    renderEditor("/admin/editor-ia-irrestrito/configuracao")

    await user.click(screen.getByRole("button", { name: /Guardar configuracao/i }))

    await waitFor(() => {
      expect(screen.getByText(/salvas com sucesso/i)).toBeInTheDocument()
    })
  })
})

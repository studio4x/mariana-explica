import { describe, expect, it, vi, beforeEach } from "vitest"
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdminAiCodeEditor } from "./AdminAiCodeEditor"
import { ROUTES } from "@/lib/constants"

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
        <Route
          path="/admin/editor-ia-irrestrito"
          element={<Navigate to={ROUTES.ADMIN_AI_CODE_EDITOR_CHAT} replace />}
        />
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
    ["/admin/editor-ia-irrestrito/configuracao", "Configuração"],
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
})

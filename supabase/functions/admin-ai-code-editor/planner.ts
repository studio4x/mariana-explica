export type AiCodeEditorRiskLevel = "low" | "medium" | "high"
export type AiCodeEditorWorkerMode = "simulated" | "github_worker"

export interface AiCodeEditorPlannedFile {
  file_path: string
  change_type: "create" | "modify" | "delete"
  rationale: string
  diff_preview: string
}

export interface AiCodeEditorPlan {
  normalizedPrompt: string
  title: string
  summary: string
  scopeClassification: string
  riskLevel: AiCodeEditorRiskLevel
  workerMode: AiCodeEditorWorkerMode
  sensitiveChange: boolean
  sensitiveReasons: string[]
  branchName: string
  commitMessage: string
  filesAnalyzed: string[]
  filesPlanned: string[]
  fileChanges: AiCodeEditorPlannedFile[]
  steps: string[]
  resultSummary: string
  requiresExplicitPublishConfirmation: boolean
}

interface KeywordRule {
  pattern: RegExp
  reason: string
}

const SENSITIVE_RULES: KeywordRule[] = [
  { pattern: /\b(auth|autentic|login|senha|sessao|session)\b/i, reason: "authentication" },
  { pattern: /\b(pagamento|stripe|checkout|pedido|order)\b/i, reason: "payments" },
  { pattern: /\b(rls|policy|policies|migration|sql|banco|database)\b/i, reason: "database_or_rls" },
  { pattern: /\b(secret|token|chave|env|variavel de ambiente|service role)\b/i, reason: "secrets_or_env" },
  { pattern: /\b(aluno|dashboard|curso|player)\b/i, reason: "student_area" },
  { pattern: /\b(edge function|supabase function|webhook)\b/i, reason: "critical_backend" },
]

function normalizePrompt(prompt: string) {
  return String(prompt ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function slugify(value: string) {
  return normalizePrompt(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
}

function buildTitle(prompt: string) {
  const trimmed = String(prompt ?? "").trim().replace(/[.!?]+$/, "")
  return trimmed.length > 100 ? `${trimmed.slice(0, 97).trim()}...` : trimmed || "Nova tarefa do editor"
}

function buildSummary(prompt: string) {
  const compact = normalizePrompt(prompt)
  if (!compact) return "Preparar ajuste solicitado pelo admin."
  const shortened = compact.length > 110 ? `${compact.slice(0, 107).trim()}...` : compact
  return `Preparar branch, diff e revisão para: ${shortened}.`
}

function inferScopeClassification(prompt: string) {
  const normalized = normalizePrompt(prompt).toLowerCase()

  if (/\b(suporte|formulario|form)\b/.test(normalized)) return "frontend_and_backend_form"
  if (/\b(auth|autentic|login|senha|sessao|checkout|pagamento|stripe|rls|migration|sql|secret|env)\b/.test(normalized)) {
    return "sensitive_system"
  }
  if (/\b(admin|configurac|painel)\b/.test(normalized)) return "admin_surface"
  if (/\b(edge function|supabase function|api|backend|webhook)\b/.test(normalized)) return "backend_logic"
  if (/\b(component|componente|layout|cards|tipografia|css|tailwind|pagina|publica|explicacoes|materiais|sobre)\b/.test(normalized)) {
    return "frontend_public_experience"
  }
  return "cross_cutting_project_change"
}

function inferSensitiveReasons(prompt: string) {
  return Array.from(
    new Set(
      SENSITIVE_RULES
        .filter((rule) => rule.pattern.test(prompt))
        .map((rule) => rule.reason),
    ),
  )
}

function inferRiskLevel(scopeClassification: string, sensitiveReasons: string[], filesCount: number): AiCodeEditorRiskLevel {
  if (sensitiveReasons.length > 0 || scopeClassification === "sensitive_system") return "high"
  if (scopeClassification === "backend_logic" || scopeClassification === "frontend_and_backend_form" || filesCount >= 4) return "medium"
  return "low"
}

function buildBranchName(prompt: string, timestamp: string) {
  const slug = slugify(prompt) || "task"
  return `ai-editor/${slug}-${timestamp}`
}

function buildCommitMessage(prompt: string) {
  const slug = slugify(prompt).replace(/-/g, " ").trim()
  const message = slug ? slug.slice(0, 52) : "update requested flow"
  return `feat(ai-editor): ${message}`
}

function buildPlannedDiff(filePath: string, rationale: string, prompt: string) {
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    "@@ planned change @@",
    `- manter implementacao atual`,
    `+ ${rationale}`,
    `+ pedido admin: ${buildTitle(prompt)}`,
  ].join("\n")
}

function buildFilePlan(prompt: string): Array<Omit<AiCodeEditorPlannedFile, "diff_preview">> {
  const normalized = normalizePrompt(prompt).toLowerCase()

  if (/\b(cards?|materiais|catalogo)\b/.test(normalized)) {
    return [
      {
        file_path: "src/pages/public/ProductsCatalogExperience.tsx",
        change_type: "modify",
        rationale: "Ajustar a experiência pública do catálogo e o arranjo dos cards na página de materiais.",
      },
      {
        file_path: "src/components/product/ProductCard.tsx",
        change_type: "modify",
        rationale: "Refinar a estrutura visual e o conteúdo do card reutilizado no catálogo.",
      },
      {
        file_path: "src/styles/globals.css",
        change_type: "modify",
        rationale: "Aplicar suporte visual global necessário ao novo layout dos cards.",
      },
    ]
  }

  if (/\bexplicacoes\b/.test(normalized)) {
    return [
      {
        file_path: "src/pages/public/Explicacoes.tsx",
        change_type: "modify",
        rationale: "Preparar ou atualizar a seção solicitada na rota de explicações quando o fallback em código for necessário.",
      },
      {
        file_path: "src/pages/public/PublicManagedPage.tsx",
        change_type: "modify",
        rationale: "Verificar o encaixe entre conteúdo gerido e extensão visual da rota pública.",
      },
      {
        file_path: "src/services/site-page.service.ts",
        change_type: "modify",
        rationale: "Ajustar o carregamento da página caso a alteração precise decidir entre conteúdo gerido e código.",
      },
    ]
  }

  if (/\b(suporte|formulario|form)\b/.test(normalized)) {
    if (/\b(texto|titulo|título|heading|copy)\b/.test(normalized)) {
      return [
        {
          file_path: "src/pages/public/Support.tsx",
          change_type: "modify",
          rationale: "Ajustar apenas o texto solicitado na pagina publica de suporte, sem tocar no backend do formulario.",
        },
      ]
    }

    return [
      {
        file_path: "src/pages/public/Support.tsx",
        change_type: "modify",
        rationale: "Alterar a interface e a lógica visual do formulário de suporte.",
      },
      {
        file_path: "src/services/admin.service.ts",
        change_type: "modify",
        rationale: "Atualizar contratos do frontend se a nova lógica exigir payload diferente.",
      },
      {
        file_path: "supabase/functions/create-support-ticket/index.ts",
        change_type: "modify",
        rationale: "Revalidar e ajustar a regra backend do envio de suporte por se tratar de área sensível.",
      },
    ]
  }

  if (/\b(auth|autentic|login|senha|sessao)\b/.test(normalized)) {
    return [
      {
        file_path: "src/layouts/AuthLayout.tsx",
        change_type: "modify",
        rationale: "Ajustar a experiência de autenticação solicitada pelo admin.",
      },
      {
        file_path: "src/hooks/useAuth.ts",
        change_type: "modify",
        rationale: "Atualizar o comportamento do frontend em torno da sessão.",
      },
      {
        file_path: "supabase/functions/admin-users/index.ts",
        change_type: "modify",
        rationale: "Garantir revalidação backend extra por se tratar de fluxo sensível.",
      },
    ]
  }

  if (/\b(edge function|supabase function|webhook|backend|api)\b/.test(normalized)) {
    return [
      {
        file_path: "supabase/functions/_shared/mod.ts",
        change_type: "modify",
        rationale: "Ajustar helpers compartilhados que afetam o fluxo backend pedido.",
      },
      {
        file_path: "supabase/functions/admin-ai-code-editor/index.ts",
        change_type: "modify",
        rationale: "Atualizar a orquestração administrativa do novo editor irrestrito.",
      },
    ]
  }

  return [
    {
      file_path: "src/pages/public/ProductsCatalogExperience.tsx",
      change_type: "modify",
      rationale: "Ponto provável de experiência pública e composição visual.",
    },
    {
      file_path: "src/components/common/SiteAiPageEditorLauncher.tsx",
      change_type: "modify",
      rationale: "Verificar impacto do fluxo atual do editor e possíveis pontos de transição.",
    },
    {
      file_path: "src/layouts/PublicLayout.tsx",
      change_type: "modify",
      rationale: "Avaliar encaixe do comportamento em layout público quando o pedido for transversal.",
    },
  ]
}

export function buildAiCodeEditorPlan(input: {
  prompt: string
  workerMode?: AiCodeEditorWorkerMode
  timestampToken?: string
}) {
  const normalizedPrompt = normalizePrompt(input.prompt)
  const title = buildTitle(input.prompt)
  const summary = buildSummary(input.prompt)
  const timestampToken = input.timestampToken ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
  const workerMode = input.workerMode ?? "simulated"
  const scopeClassification = inferScopeClassification(normalizedPrompt)
  const baseFilePlan = buildFilePlan(normalizedPrompt)
  const sensitiveReasons = inferSensitiveReasons(normalizedPrompt)
  const riskLevel = inferRiskLevel(scopeClassification, sensitiveReasons, baseFilePlan.length)
  const filesAnalyzed = Array.from(new Set(baseFilePlan.map((item) => item.file_path)))
  const fileChanges: AiCodeEditorPlannedFile[] = baseFilePlan.map((item) => ({
    ...item,
    diff_preview: buildPlannedDiff(item.file_path, item.rationale, normalizedPrompt),
  }))
  const filesPlanned = Array.from(new Set(fileChanges.map((item) => item.file_path)))
  const branchName = buildBranchName(normalizedPrompt, timestampToken)
  const commitMessage = buildCommitMessage(normalizedPrompt)
  const requiresExplicitPublishConfirmation = true
  const steps = [
    "Entender pedido e classificar risco operacional.",
    "Localizar arquivos prováveis no repositório.",
    "Preparar branch dedicada para a tarefa.",
    "Aplicar alteração em arquivos reais com diff rastreável.",
    "Executar testes e build quando a integração estiver disponível.",
    "Solicitar preview deploy antes de qualquer publicação.",
    "Exibir arquivos analisados, alterados e status operacional ao admin.",
    "Exigir aprovação explícita antes de publicar.",
    "Registrar auditoria completa da execução.",
    "Permitir rollback via Git e histórico do task.",
  ]
  const sensitiveChange = sensitiveReasons.length > 0
  const resultSummary =
    workerMode === "simulated"
      ? "Plano gerado em modo simulado. Branch, commit, diff e preview estão preparados como contrato operacional para a futura integração GitHub/Vercel."
      : "Plano gerado para execução via worker integrado ao repositório."

  return {
    normalizedPrompt,
    title,
    summary,
    scopeClassification,
    riskLevel,
    workerMode,
    sensitiveChange,
    sensitiveReasons,
    branchName,
    commitMessage,
    filesAnalyzed,
    filesPlanned,
    fileChanges,
    steps,
    resultSummary,
    requiresExplicitPublishConfirmation,
  } satisfies AiCodeEditorPlan
}

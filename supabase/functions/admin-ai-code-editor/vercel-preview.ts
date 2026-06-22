export interface VercelSecrets {
  token: string
  projectId: string
}

export interface VercelPreviewDeployment {
  deploymentId: string | null
  deploymentUrl: string | null
  status: "not_requested" | "pending" | "ready" | "failed"
  readyAt: string | null
  errorMessage: string | null
  metadata: Record<string, unknown>
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

export function readVercelSecrets() {
  const token = normalizeText(Deno.env.get("VERCEL_TOKEN"))
  const projectId = normalizeText(Deno.env.get("VERCEL_PROJECT_ID"))

  if (!token || !projectId) {
    throw new Error(
      "Integracao Vercel nao configurada. Configure VERCEL_TOKEN e VERCEL_PROJECT_ID nos secrets da funcao.",
    )
  }

  return {
    token,
    projectId,
  } satisfies VercelSecrets
}

function normalizeDeploymentStatus(state: string, readyState: string) {
  const normalizedState = state.toUpperCase()
  const normalizedReadyState = readyState.toUpperCase()

  if (normalizedState === "READY" || normalizedReadyState === "READY") return "ready"
  if (normalizedState === "ERROR" || normalizedReadyState === "ERROR" || normalizedReadyState === "CANCELED") {
    return "failed"
  }
  if (!normalizedState && !normalizedReadyState) return "not_requested"
  return "pending"
}

export async function fetchVercelPreviewDeployment(input: {
  commitSha: string
  branchName: string
  teamId?: string | null
}) {
  const secrets = readVercelSecrets()
  const query = new URLSearchParams({
    projectId: secrets.projectId,
    "meta-githubCommitSha": input.commitSha,
    limit: "10",
  })

  if (input.teamId) {
    query.set("teamId", input.teamId)
  }

  const response = await fetch(`https://api.vercel.com/v6/deployments?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${secrets.token}`,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "object"
        ? normalizeText(((payload as Record<string, unknown>).error as Record<string, unknown>).message)
        : `Vercel retornou ${response.status}`
    throw new Error(message || `Vercel retornou ${response.status}`)
  }

  const deployments =
    payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).deployments)
      ? (payload as { deployments: Array<Record<string, unknown>> }).deployments
      : []

  const match =
    deployments.find((deployment) => normalizeText(deployment.meta && typeof deployment.meta === "object"
      ? (deployment.meta as Record<string, unknown>).githubCommitSha
      : "") === input.commitSha) ??
    deployments.find((deployment) => normalizeText(deployment.meta && typeof deployment.meta === "object"
      ? (deployment.meta as Record<string, unknown>).githubCommitRef
      : "") === input.branchName) ??
    null

  if (!match) {
    return {
      deploymentId: null,
      deploymentUrl: null,
      status: "pending",
      readyAt: null,
      errorMessage: null,
      metadata: {
        branch_name: input.branchName,
        commit_sha: input.commitSha,
        source: "vercel_deployment_not_found_yet",
      },
    } satisfies VercelPreviewDeployment
  }

  const readyState = normalizeText(match.readyState || match.state)
  const deploymentUrl = normalizeText(match.url)

  return {
    deploymentId: normalizeText(match.uid) || null,
    deploymentUrl: deploymentUrl ? `https://${deploymentUrl}` : null,
    status: normalizeDeploymentStatus(normalizeText(match.state), readyState),
    readyAt: match.ready && typeof match.ready === "number" ? new Date(Number(match.ready)).toISOString() : null,
    errorMessage: normalizeText(match.errorMessage) || null,
    metadata: {
      branch_name: input.branchName,
      commit_sha: input.commitSha,
      ready_state: readyState || null,
      inspector_url: normalizeText(match.inspectorUrl) || null,
    },
  } satisfies VercelPreviewDeployment
}

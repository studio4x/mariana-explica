import { requireActiveUser } from "../_shared/auth.ts"
import { badRequest, forbidden, notFound } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse, readJsonBody } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"

interface NavigationInput {
  productId: string
}

interface ProgressRow {
  lesson_id: string
  status: "not_started" | "in_progress" | "completed"
  progress_percent: number
}

interface AttemptRow {
  assessment_id: string
  status: "in_progress" | "submitted" | "passed" | "failed" | "pending_review"
  created_at: string
}

function requireText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest(`${label} e obrigatorio`)
  }

  return value.trim()
}

function isGrantActive(grantedAt: string, expiresAt: string | null) {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now()
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireActiveUser(req)
    const body = await readJsonBody<NavigationInput>(req)
    const productId = requireText(body.productId, "productId")

    const { data: product, error: productError } = await context.serviceClient
      .from("products")
      .select(
        "id,slug,title,short_description,description,product_type,status,price_cents,currency,cover_image_url,launch_date,is_public,creator_id,creator_commission_percent,workload_minutes,has_linear_progression,quiz_type_settings,sales_page_enabled,requires_auth,is_featured,allow_affiliate,sort_order,published_at",
      )
      .eq("id", productId)
      .eq("status", "published")
      .maybeSingle()

    if (productError) throw productError
    if (!product) throw notFound("Curso nao encontrado")

    const { data: grant, error: grantError } = await context.serviceClient
      .from("access_grants")
      .select("id,granted_at,expires_at,status,revoked_at")
      .eq("product_id", productId)
      .eq("user_id", context.user.id)
      .eq("status", "active")
      .is("revoked_at", null)
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (grantError) throw grantError
    if (!grant || !isGrantActive(grant.granted_at, grant.expires_at)) {
      throw forbidden("Curso indisponivel para este usuario")
    }

    const { data: modules, error: modulesError } = await context.serviceClient
      .from("product_modules")
      .select(
        "id,product_id,title,description,module_type,access_type,sort_order,position,is_preview,is_required,starts_at,ends_at,release_days_after_enrollment,module_pdf_storage_path,module_pdf_file_name,module_pdf_uploaded_at,status",
      )
      .eq("product_id", productId)
      .eq("status", "published")
      .order("position", { ascending: true })
      .order("sort_order", { ascending: true })

    if (modulesError) throw modulesError

    const moduleIds = (modules ?? []).map((module) => module.id)

    const [{ data: lessons, error: lessonsError }, { data: assessments, error: assessmentsError }, { data: progress, error: progressError }, { data: attempts, error: attemptsError }] =
      await Promise.all([
        context.serviceClient
          .from("product_lessons")
          .select("id,module_id,title,description,position,is_required,lesson_type,estimated_minutes,starts_at,ends_at,status")
          .in("module_id", moduleIds.length > 0 ? moduleIds : ["00000000-0000-0000-0000-000000000000"])
          .eq("status", "published")
          .order("position", { ascending: true }),
        context.serviceClient
          .from("product_assessments")
          .select("id,product_id,module_id,assessment_type,title,description,is_required,passing_score,max_attempts,estimated_minutes,is_active,created_at,updated_at")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        context.serviceClient
          .from("lesson_progress")
          .select("lesson_id,status,progress_percent")
          .eq("user_id", context.user.id)
          .eq("product_id", productId),
        context.serviceClient
          .from("assessment_attempts")
          .select("assessment_id,status,created_at")
          .eq("user_id", context.user.id)
          .eq("product_id", productId)
          .order("created_at", { ascending: false }),
      ])

    if (lessonsError) throw lessonsError
    if (assessmentsError) throw assessmentsError
    if (progressError) throw progressError
    if (attemptsError) throw attemptsError

    const progressMap = new Map<string, ProgressRow>(
      ((progress ?? []) as ProgressRow[]).map((item) => [item.lesson_id, item]),
    )
    const latestAttemptByAssessment = new Map<string, AttemptRow>()

    for (const attempt of (attempts ?? []) as AttemptRow[]) {
      if (!latestAttemptByAssessment.has(attempt.assessment_id)) {
        latestAttemptByAssessment.set(attempt.assessment_id, attempt)
      }
    }

    const orderedModules = modules ?? []
    const orderedLessons = lessons ?? []
    const orderedAssessments = assessments ?? []

    const moduleStates = new Map<string, { locked: boolean; reason: string | null }>()
    const lessonStates = new Map<string, { locked: boolean; reason: string | null }>()

    const completedLessonIds = new Set(
      ((progress ?? []) as ProgressRow[])
        .filter((item) => item.status === "completed")
        .map((item) => item.lesson_id),
    )

    const grantReleaseAt = new Date(grant.granted_at).getTime()

    for (const module of orderedModules) {
      let locked = false
      let reason: string | null = null

      if (module.starts_at && new Date(module.starts_at).getTime() > Date.now()) {
        locked = true
        reason = "Liberacao agendada"
      } else if (module.ends_at && new Date(module.ends_at).getTime() <= Date.now()) {
        locked = true
        reason = "Modulo expirado"
      } else if (
        module.release_days_after_enrollment !== null &&
        module.release_days_after_enrollment !== undefined &&
        Date.now() < grantReleaseAt + module.release_days_after_enrollment * 24 * 60 * 60 * 1000
      ) {
        locked = true
        reason = "Disponivel apos o prazo de liberacao"
      } else if (product.has_linear_progression) {
        const blockingLesson = orderedLessons.find((lesson) => {
          const previousModule = orderedModules.find((item) => item.id === lesson.module_id)
          if (!previousModule) return false
          if (lesson.is_required !== true) return false
          if (previousModule.position >= module.position) return false
          return !completedLessonIds.has(lesson.id)
        })

        if (blockingLesson) {
          locked = true
          reason = "Conclua os modulos anteriores para desbloquear"
        }
      }

      moduleStates.set(module.id, { locked, reason })
    }

    for (const lesson of orderedLessons) {
      const module = orderedModules.find((item) => item.id === lesson.module_id)
      const moduleState = module ? moduleStates.get(module.id) : null
      let locked = moduleState?.locked ?? false
      let reason = moduleState?.reason ?? null

      if (!locked && lesson.starts_at && new Date(lesson.starts_at).getTime() > Date.now()) {
        locked = true
        reason = "Aula com liberacao agendada"
      } else if (!locked && lesson.ends_at && new Date(lesson.ends_at).getTime() <= Date.now()) {
        locked = true
        reason = "Aula expirada"
      } else if (!locked && product.has_linear_progression && module) {
        const blockingLesson = orderedLessons.find((candidate) => {
          const candidateModule = orderedModules.find((item) => item.id === candidate.module_id)
          if (!candidateModule) return false
          if (candidate.is_required !== true) return false
          const comesBefore =
            candidateModule.position < module.position ||
            (candidateModule.position === module.position && candidate.position < lesson.position)
          return comesBefore && !completedLessonIds.has(candidate.id)
        })

        if (blockingLesson) {
          locked = true
          reason = "Conclua as aulas anteriores para continuar"
        }
      }

      lessonStates.set(lesson.id, { locked, reason })
    }

    const moduleAssessmentsByModule = new Map(
      orderedModules.map((module) => [
        module.id,
        orderedAssessments.filter(
          (assessment) => assessment.module_id === module.id && assessment.assessment_type === "module",
        ),
      ]),
    )

    const assessmentsWithState = orderedAssessments.map((assessment) => {
      let locked = false
      let reason: string | null = null

      if (assessment.assessment_type === "module" && assessment.module_id) {
        const moduleState = moduleStates.get(assessment.module_id)
        if (moduleState?.locked) {
          locked = true
          reason = moduleState.reason
        } else if (product.has_linear_progression) {
          const requiredModuleLessons = orderedLessons.filter(
            (lesson) => lesson.module_id === assessment.module_id && lesson.is_required,
          )
          const hasPendingRequiredLesson = requiredModuleLessons.some((lesson) => !completedLessonIds.has(lesson.id))
          if (hasPendingRequiredLesson) {
            locked = true
            reason = "Conclua as aulas obrigatorias do modulo antes do quiz"
          }
        }
      }

      if (assessment.assessment_type === "final" && product.has_linear_progression) {
        const hasPendingRequiredLesson = orderedLessons.some(
          (lesson) => lesson.is_required && !completedLessonIds.has(lesson.id),
        )
        const hasPendingRequiredModuleAssessment = orderedAssessments.some((candidate) => {
          if (
            candidate.assessment_type !== "module" ||
            candidate.is_required !== true ||
            candidate.is_active !== true
          ) {
            return false
          }

          const latestAttempt = latestAttemptByAssessment.get(candidate.id)
          return !latestAttempt || !["passed", "pending_review"].includes(latestAttempt.status)
        })

        if (hasPendingRequiredLesson) {
          locked = true
          reason = "Conclua as aulas obrigatorias antes da avaliacao final"
        } else if (hasPendingRequiredModuleAssessment) {
          locked = true
          reason = "Finalize os quizzes obrigatorios dos modulos antes da avaliacao final"
        }
      }

      const latestAttempt = latestAttemptByAssessment.get(assessment.id)
      const progressState = locked
        ? "locked"
        : latestAttempt?.status === "passed"
          ? "passed"
          : latestAttempt?.status === "pending_review"
            ? "pending_review"
            : latestAttempt?.status === "failed"
              ? "failed"
              : "available"

      return {
        ...assessment,
        is_locked: locked,
        lock_reason: reason,
        progress_state: progressState,
      }
    })

    const lessonsWithState = orderedLessons.map((lesson) => ({
      ...lesson,
      is_locked: lessonStates.get(lesson.id)?.locked ?? false,
      lock_reason: lessonStates.get(lesson.id)?.reason ?? null,
      progress_state: progressMap.get(lesson.id)?.status ?? "not_started",
      progress_percent: progressMap.get(lesson.id)?.progress_percent ?? 0,
    }))

    const modulesWithState = orderedModules.map((module) => ({
      ...module,
      is_locked: moduleStates.get(module.id)?.locked ?? false,
      lock_reason: moduleStates.get(module.id)?.reason ?? null,
      lesson_count: lessonsWithState.filter((lesson) => lesson.module_id === module.id).length,
      assessment_count: (moduleAssessmentsByModule.get(module.id) ?? []).length,
    }))

    return jsonResponse({
      success: true,
      request_id: requestId,
      product,
      modules: modulesWithState,
      lessons: lessonsWithState,
      assessments: assessmentsWithState,
      progress: progress ?? [],
    })
  } catch (error) {
    logError("Student course navigation failed", {
      request_id: requestId,
      error: String(error),
    })
    return errorResponse(error, requestId)
  }
})

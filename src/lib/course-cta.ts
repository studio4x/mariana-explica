import { studentCoursePath } from "@/lib/routes"
import type { DashboardProductSummary } from "@/types/app.types"

type EnrolledCourseState = Pick<DashboardProductSummary, "id" | "completed_lessons" | "progress_percent">

export function getLearningActionLabel(course: EnrolledCourseState) {
  return course.completed_lessons > 0 || course.progress_percent > 0
    ? "Continuar aprendizado"
    : "Aceder"
}

export function getStudentProductAccessLabel(
  productType: DashboardProductSummary["product_type"],
  categorySlug?: string | null,
) {
  if (productType === "external_service") {
    return "Ver curso"
  }

  if (categorySlug === "sebentas-individuais") {
    return "Ver material"
  }

  return "Ver material"
}

export function getEnrolledCourseAction(course: EnrolledCourseState | null | undefined) {
  if (!course) return null

  return {
    label: getLearningActionLabel(course),
    to: studentCoursePath(course.id),
  }
}

export function findEnrolledCourse(
  courseId: string,
  enrolledCourses: EnrolledCourseState[] | null | undefined,
) {
  return enrolledCourses?.find((course) => course.id === courseId) ?? null
}

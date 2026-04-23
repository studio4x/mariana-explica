import { studentCoursePath } from "@/lib/routes"
import type { DashboardProductSummary } from "@/types/app.types"

type EnrolledCourseState = Pick<DashboardProductSummary, "id" | "completed_lessons" | "progress_percent">

export function getLearningActionLabel(course: EnrolledCourseState) {
  return course.completed_lessons > 0 || course.progress_percent > 0
    ? "Continuar aprendizado"
    : "Iniciar aprendizado"
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

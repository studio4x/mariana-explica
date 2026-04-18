import { ROUTES } from "@/lib/constants"

export function publicCoursePath(slug: string) {
  return `${ROUTES.COURSE}/${slug}`
}

export function studentCoursePath(courseId: string) {
  return `${ROUTES.STUDENT_COURSE}/${courseId}`
}

export function studentCoursePlayerPath(courseId: string) {
  return `${studentCoursePath(courseId)}/player`
}

export function studentCourseLessonPath(courseId: string, lessonId: string) {
  return `${studentCoursePlayerPath(courseId)}/aulas/${lessonId}`
}

export function studentCourseAssessmentPath(courseId: string, assessmentId: string) {
  return `${studentCoursePlayerPath(courseId)}/avaliacoes/${assessmentId}`
}

export function adminCourseBuilderPath(courseId: string) {
  return `${ROUTES.ADMIN_COURSES}/${courseId}/builder`
}

export function adminCourseSettingsPath(courseId: string) {
  return `${adminCourseBuilderPath(courseId)}/settings`
}

export function adminCourseReleasesPath(courseId: string) {
  return `${adminCourseBuilderPath(courseId)}/releases`
}

export function adminCourseAssessmentsPath(courseId: string) {
  return `${adminCourseBuilderPath(courseId)}/assessments`
}

export function adminCourseFinalAssessmentPath(courseId: string) {
  return `${adminCourseAssessmentsPath(courseId)}/final`
}

export function adminCourseModulePath(courseId: string, moduleId: string) {
  return `${adminCourseBuilderPath(courseId)}/modulos/${moduleId}`
}

export function adminCourseLessonPath(courseId: string, moduleId: string, lessonId: string) {
  return `${adminCourseModulePath(courseId, moduleId)}/aulas/${lessonId}`
}

export function adminCourseLessonMaterialsPath(courseId: string, moduleId: string, lessonId: string) {
  return `${adminCourseLessonPath(courseId, moduleId, lessonId)}/materiais`
}

export function adminCourseModuleAssessmentPath(courseId: string, moduleId: string, assessmentId: string) {
  return `${adminCourseModulePath(courseId, moduleId)}/avaliacoes/${assessmentId}`
}

export function adminProductContentPath(productId: string) {
  return adminCourseBuilderPath(productId)
}

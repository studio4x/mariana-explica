import { useOutletContext } from "react-router-dom"
import type {
  ProductAssessmentSummary,
  ProductLessonSummary,
  ProductModuleSummary,
} from "@/types/app.types"
import type { ProductSummary } from "@/types/product.types"

export interface AdminCourseBuilderContext {
  courseId: string
  product: ProductSummary
  modules: ProductModuleSummary[]
  assessments: ProductAssessmentSummary[]
  lessonsByModule: Record<string, ProductLessonSummary[]>
  totalLessons: number
}

export function useAdminCourseBuilderContext() {
  return useOutletContext<AdminCourseBuilderContext>()
}

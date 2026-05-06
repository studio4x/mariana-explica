export interface FaqCategorySummary {
  id: string
  slug: string
  title: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FaqSummary {
  id: string
  category_id: string
  question: string
  answer: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

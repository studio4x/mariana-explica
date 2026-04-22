export type ProductType = "paid" | "free" | "hybrid" | "external_service"
export type ProductStatus = "draft" | "published" | "archived"

export interface CoursePublicPageFeature {
  title: string
  description: string
}

export interface CoursePublicPageCurriculumItem {
  label: string
  title: string
  lessons: string
  description: string
}

export interface CoursePublicPageContent {
  eyebrow?: string
  headline?: string
  intro?: string
  aboutTitle?: string
  aboutParagraphs?: string[]
  learnTitle?: string
  learnItems?: CoursePublicPageFeature[]
  curriculumTitle?: string
  curriculumItems?: CoursePublicPageCurriculumItem[]
  instructorName?: string
  instructorRole?: string
  instructorInitials?: string
  priceNote?: string
  ctaLabel?: string
  sidebarFeatures?: string[]
  previewTitle?: string
  previewText?: string
}

export interface ProductSummary {
  id: string
  slug: string
  title: string
  short_description: string | null
  description: string | null
  product_type: ProductType
  status: ProductStatus
  price_cents: number
  currency: string
  cover_image_url: string | null
  launch_date: string | null
  is_public: boolean
  creator_id: string | null
  creator_commission_percent: number | null
  workload_minutes: number
  has_linear_progression: boolean
  quiz_type_settings: Record<string, boolean>
  public_page_content: CoursePublicPageContent | null
  sales_page_enabled: boolean
  requires_auth: boolean
  is_featured: boolean
  allow_affiliate: boolean
  sort_order: number
  published_at: string | null
}

export type ProductDetails = ProductSummary

export interface CreateCheckoutResponse {
  success: true
  request_id: string
  mode: "free" | "stripe"
  order_id: string
  grant_id?: string
  checkout_session_id?: string
  checkout_url?: string | null
  payment_environment?: "test" | "live"
  stripe_livemode?: boolean
  final_price_cents: number
  currency: string
}

export interface ClaimFreeProductResponse {
  success: true
  request_id: string
  order_id: string
  grant_id: string
  mode: "free_claim"
}

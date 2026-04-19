import type { ProductSummary } from "./product.types"

export type UserRole = "student" | "affiliate" | "admin"
export type UserStatus = "active" | "inactive" | "blocked" | "pending_review"

export interface AccessGrantSummary {
  id: string
  product_id: string
  source_order_id: string | null
  granted_at: string
  expires_at: string | null
  status: "active" | "revoked" | "expired"
}

export interface DashboardProductSummary extends ProductSummary {
  grant_id: string
  granted_at: string
  expires_at: string | null
  module_count: number
  lesson_count: number
  asset_count: number
  preview_count: number
  download_count: number
  completed_lessons: number
  progress_percent: number
}

export interface ProductModuleSummary {
  id: string
  product_id: string
  title: string
  description: string | null
  module_type: "pdf" | "video" | "external_link" | "mixed"
  access_type: "public" | "registered" | "paid_only"
  sort_order: number
  position: number
  is_preview: boolean
  is_required: boolean
  starts_at: string | null
  ends_at: string | null
  release_days_after_enrollment: number | null
  module_pdf_storage_path: string | null
  module_pdf_file_name: string | null
  module_pdf_uploaded_at: string | null
  status: "draft" | "published" | "archived"
}

export interface CourseModuleNavigationSummary extends ProductModuleSummary {
  is_locked: boolean
  lock_reason: string | null
  lesson_count: number
  assessment_count: number
}

export interface ModuleAssetSummary {
  id: string
  module_id: string
  asset_type: "pdf" | "video_file" | "video_embed" | "external_link"
  title: string
  sort_order: number
  storage_bucket: string | null
  storage_path: string | null
  external_url: string | null
  mime_type: string | null
  file_size_bytes: number | null
  allow_download: boolean
  allow_stream: boolean
  watermark_enabled: boolean
  status: "active" | "inactive"
}

export interface AdminStorageUploadResult {
  bucket: string
  path: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
}

export interface AdminModulePdfWatermarkConfig {
  config_key: string
  config_value: {
    site_name: string
    logo_bucket: string | null
    logo_path: string | null
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface ProductLessonSummary {
  id: string
  module_id: string
  title: string
  description: string | null
  position: number
  is_required: boolean
  lesson_type: "video" | "text" | "hybrid"
  youtube_url: string | null
  text_content: string | null
  estimated_minutes: number
  starts_at: string | null
  ends_at: string | null
  status: "draft" | "published" | "archived"
}

export interface CourseLessonNavigationSummary {
  id: string
  module_id: string
  title: string
  description: string | null
  position: number
  is_required: boolean
  lesson_type: "video" | "text" | "hybrid"
  estimated_minutes: number
  starts_at: string | null
  ends_at: string | null
  status: "draft" | "published" | "archived"
  is_locked: boolean
  lock_reason: string | null
  progress_state: LessonProgressSummary["status"]
  progress_percent: number
}

export interface ProductAssessmentSummary {
  id: string
  product_id: string
  module_id: string | null
  assessment_type: "module" | "final"
  title: string
  description: string | null
  is_required: boolean
  passing_score: number
  max_attempts: number | null
  estimated_minutes: number
  is_active: boolean
  builder_payload: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CourseAssessmentNavigationSummary {
  id: string
  product_id: string
  module_id: string | null
  assessment_type: "module" | "final"
  title: string
  description: string | null
  is_required: boolean
  passing_score: number
  max_attempts: number | null
  estimated_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
  is_locked: boolean
  lock_reason: string | null
  progress_state: "locked" | "available" | "passed" | "pending_review" | "failed"
}

export interface AdminAssessmentMutationInput {
  productId: string
  moduleId?: string | null
  assessmentType: ProductAssessmentSummary["assessment_type"]
  title: string
  description?: string | null
  isRequired?: boolean
  passingScore?: number
  maxAttempts?: number | null
  estimatedMinutes?: number
  isActive?: boolean
  builderPayload?: Record<string, unknown>
}

export interface AdminAssessmentUpdateInput extends Partial<AdminAssessmentMutationInput> {
  assessmentId: string
}

export interface AssessmentAttemptSummary {
  id: string
  user_id: string
  assessment_id: string
  product_id: string
  module_id: string | null
  attempt_number: number
  status: "in_progress" | "submitted" | "passed" | "failed" | "pending_review"
  answers_payload: Record<string, unknown>
  result_payload: Record<string, unknown>
  auto_score_percent: number | null
  final_score_percent: number | null
  requires_manual_review: boolean
  passed: boolean | null
  started_at: string
  last_saved_at: string
  submitted_at: string | null
  evaluated_at: string | null
  created_at: string
  updated_at: string
}

export interface AssessmentAttemptState {
  assessment: Pick<
    ProductAssessmentSummary,
    "id" | "title" | "assessment_type" | "passing_score" | "max_attempts"
  >
  attempt: AssessmentAttemptSummary | null
  attempts_used: number
  remaining_attempts: number | null
  can_start_new_attempt: boolean
}

export interface LessonProgressSummary {
  id: string
  user_id: string
  lesson_id: string
  product_id: string
  module_id: string
  status: "not_started" | "in_progress" | "completed"
  progress_percent: number
  started_at: string | null
  completed_at: string | null
  last_accessed_at: string | null
}

export interface LessonNoteSummary {
  id: string
  user_id: string
  lesson_id: string
  note_text: string
  created_at: string
  updated_at: string
}

export interface NotificationItem {
  id: string
  type: "transactional" | "informational" | "marketing" | "support"
  title: string
  message: string
  link: string | null
  status: "unread" | "read" | "archived"
  sent_via_email: boolean
  sent_via_in_app: boolean
  read_at: string | null
  created_at: string
}

export interface SupportTicketSummary {
  id: string
  subject: string
  message: string
  status: "open" | "in_progress" | "answered" | "closed"
  priority: "low" | "normal" | "high"
  assigned_admin_id: string | null
  last_reply_at: string | null
  created_at: string
  updated_at: string
}

export interface SupportTicketMessage {
  id: string
  ticket_id: string
  sender_user_id: string
  sender_role: "student" | "admin"
  message: string
  created_at: string
}

export interface DashboardOverviewData {
  products: DashboardProductSummary[]
  recentNotifications: NotificationItem[]
  unreadNotificationsCount: number
  supportTickets: SupportTicketSummary[]
}

export interface StudentCourseNavigationData {
  product: DashboardProductSummary | null
  modules: CourseModuleNavigationSummary[]
  lessons: CourseLessonNavigationSummary[]
  assessments: CourseAssessmentNavigationSummary[]
  progress: LessonProgressSummary[]
}

export type DownloadableItem =
  | {
      kind: "asset"
      asset: ModuleAssetSummary
      module: ProductModuleSummary
      product: DashboardProductSummary
    }
  | {
      kind: "module_pdf"
      module: ProductModuleSummary
      product: DashboardProductSummary
    }

export interface ProfilePreferences {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  notifications_enabled: boolean
  marketing_consent: boolean
  role: UserRole
  status: UserStatus
}

export interface AdminUserSummary {
  id: string
  full_name: string
  email: string
  email_verified: boolean
  email_verified_at: string | null
  role: UserRole
  is_admin: boolean
  status: UserStatus
  phone: string | null
  last_login_at: string | null
  created_at: string
  notifications_enabled: boolean
  marketing_consent: boolean
}

export interface AdminOrderSummary {
  id: string
  user_id: string
  product_id: string
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
  currency: string
  base_price_cents: number
  discount_cents: number
  final_price_cents: number
  payment_reference: string | null
  checkout_session_id: string | null
  paid_at: string | null
  refunded_at: string | null
  created_at: string
}

export interface AdminOrderViewSummary extends AdminOrderSummary {
  user_name: string | null
  user_email: string | null
  product_title: string | null
}

export interface AdminDashboardMetrics {
  totalUsers: number
  totalPublishedProducts: number
  totalPaidOrders: number
  revenueCents: number
}

export interface AdminDashboardOverview {
  metrics: AdminDashboardMetrics
  recentOrders: Array<
    Pick<AdminOrderSummary, "id" | "status" | "currency" | "final_price_cents" | "created_at">
  >
  alerts: {
    openSupportTickets: number
    highPrioritySupportTickets: number
    unreadNotifications: number
    failedEmails: number
    failedJobs: number
  }
}

export interface AdminEmailDeliverySummary {
  id: string
  user_id: string | null
  notification_id: string | null
  email_to: string
  template_key: string
  provider: string | null
  provider_message_id: string | null
  subject: string | null
  status: "queued" | "sent" | "failed" | "delivered" | "bounced"
  error_message: string | null
  sent_at: string | null
  created_at: string
}

export interface AdminJobRunSummary {
  id: string
  job_name: string
  status: "running" | "success" | "failed"
  started_at: string
  finished_at: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown>
  error_message: string | null
  idempotency_key: string | null
  created_at: string
}

export interface AdminOperationsOverview {
  queuedEmails: number
  failedEmails: number
  failedJobs: number
  deliveredEmails: number
  emailDeliveries: AdminEmailDeliverySummary[]
  jobRuns: AdminJobRunSummary[]
}

export interface AdminSupportTicketSummary extends SupportTicketSummary {
  user_id: string
}

export interface AdminNotificationSummary extends NotificationItem {
  user_id: string
}

export interface AdminAffiliateSummary {
  id: string
  user_id: string
  affiliate_code: string
  status: "active" | "inactive" | "blocked"
  commission_type: "percentage" | "fixed"
  commission_value: number
  created_at: string
  updated_at: string
}

export interface AdminAffiliateReferralSummary {
  id: string
  affiliate_id: string
  user_id: string | null
  product_id: string | null
  order_id: string | null
  referral_code: string
  status: "tracked" | "converted" | "cancelled" | "invalid"
  commission_cents: number
  tracked_at: string
  converted_at: string | null
  created_at: string
}

export interface AdminCouponSummary {
  id: string
  code: string
  title: string | null
  discount_type: "percentage" | "fixed"
  discount_value: number
  status: "active" | "inactive" | "expired"
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  max_uses_per_user: number | null
  current_uses: number
  minimum_order_cents: number | null
  created_at: string
  updated_at: string
}

export interface AdminCouponUsageSummary {
  id: string
  coupon_id: string
  user_id: string
  order_id: string
  discount_cents: number
  used_at: string
}

export interface AdminCourseReleaseSummary {
  id: string
  user_id: string
  product_id: string
  source_type: "purchase" | "free_claim" | "admin_grant" | "manual_adjustment"
  source_order_id: string | null
  status: "active" | "revoked" | "expired"
  granted_at: string
  revoked_at: string | null
  expires_at: string | null
  notes: string | null
  profile_name: string | null
  profile_email: string | null
}

export interface AdminPaymentsStatus {
  stripe: {
    mode: "test" | "live"
    test: {
      secret_present: boolean
      secret_valid: boolean
      webhook_present: boolean
    }
    live: {
      secret_present: boolean
      secret_valid: boolean
      webhook_present: boolean
    }
  }
}

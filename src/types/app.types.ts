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
  asset_count: number
  preview_count: number
  download_count: number
}

export interface ProductModuleSummary {
  id: string
  product_id: string
  title: string
  description: string | null
  module_type: "pdf" | "video" | "external_link" | "mixed"
  access_type: "public" | "registered" | "paid_only"
  sort_order: number
  is_preview: boolean
  status: "draft" | "published" | "archived"
}

export interface ModuleAssetSummary {
  id: string
  module_id: string
  asset_type: "pdf" | "video_file" | "video_embed" | "external_link"
  title: string
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

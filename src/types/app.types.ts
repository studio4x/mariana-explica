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

export interface AdminDashboardMetrics {
  totalUsers: number
  totalPublishedProducts: number
  totalPaidOrders: number
  revenueCents: number
}

export interface AdminSupportTicketSummary extends SupportTicketSummary {
  user_id: string
}

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
  module_pdf_storage_provider?: "supabase" | "r2" | null
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
  asset_type: "pdf" | "image" | "video_file" | "video_embed" | "external_link"
  title: string
  sort_order: number
  storage_bucket: string | null
  storage_path: string | null
  storage_provider?: "supabase" | "r2" | null
  storage_managed?: boolean
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
  storage_provider?: "supabase" | "r2" | null
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
  public_url?: string | null
}

export interface AdminModulePdfWatermarkConfig {
  config_key: string
  config_value: {
    site_name: string
    logo_bucket: string | null
    logo_path: string | null
    logo_storage_provider?: "supabase" | "r2" | null
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminBrandingAsset {
  bucket: string | null
  path: string | null
  storage_provider?: "supabase" | "r2" | null
  public_url: string | null
  file_name: string | null
  uploaded_at: string | null
}

export interface AdminBrandingConfig {
  config_key: string
  config_value: {
    logo_light: AdminBrandingAsset
    logo_dark: AdminBrandingAsset
    favicon: AdminBrandingAsset
    header_announcement: string
    footer_description: string
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminPendingInfoConfig {
  config_key: string
  config_value: {
    email_provider_name: string
    email_sender_name: string
    email_sender_address: string
    email_reply_to: string
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminCheckoutModeConfig {
  config_key: string
  config_value: {
    mode: "test" | "live"
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminTrackingConfig {
  config_key: string
  config_value: {
    google_tag_manager_id: string
    meta_pixel_id: string
    custom_head_code: string
    custom_body_code: string
    custom_footer_code: string
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export type SiteThemeTextTransform = "none" | "uppercase" | "lowercase" | "capitalize" | "inherit"

export interface AdminSiteThemeTextStyle {
  font_family: string
  font_size: string
  font_weight: string
  line_height: string
  letter_spacing: string
  text_transform: SiteThemeTextTransform
  color: string
}

export interface AdminSiteThemeConfig {
  config_key: string
  config_value: {
    palette: {
      page_background: string
      surface_background: string
      border_color: string
      heading_color: string
      body_color: string
      muted_color: string
      link_color: string
      link_hover_color: string
      selection_background: string
      selection_foreground: string
    }
    typography: {
      headline_xl: AdminSiteThemeTextStyle
      headline_lg: AdminSiteThemeTextStyle
      headline_md: AdminSiteThemeTextStyle
      headline_sm: AdminSiteThemeTextStyle
      headline_xs: AdminSiteThemeTextStyle
      headline_2xs: AdminSiteThemeTextStyle
      body_lg: AdminSiteThemeTextStyle
      body_md: AdminSiteThemeTextStyle
      body_sm: AdminSiteThemeTextStyle
      label_md: AdminSiteThemeTextStyle
      h1: AdminSiteThemeTextStyle
      h2: AdminSiteThemeTextStyle
      h3: AdminSiteThemeTextStyle
      h4: AdminSiteThemeTextStyle
      h5: AdminSiteThemeTextStyle
      h6: AdminSiteThemeTextStyle
      paragraph: AdminSiteThemeTextStyle
      list_item: AdminSiteThemeTextStyle
      link: AdminSiteThemeTextStyle
      label: AdminSiteThemeTextStyle
      small: AdminSiteThemeTextStyle
    }
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminPublicFormNotificationsConfig {
  config_key: string
  config_value: {
    notification_email: string
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminSiteMaintenanceConfig {
  config_key: string
  config_value: {
    enabled: boolean
    message: string
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminLegacyPageEditorConfig {
  config_key: string
  config_value: {
    enabled: boolean
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export type AdminAiCodeEditorWorkerMode = "simulated" | "github_worker"
export type AdminAiCodeEditorProvider = "openai" | "gemini"
export type AdminAiCodeEditorGenerationMode = "ai_enabled" | "deterministic_only" | "blocked_provider_quota"
export type AdminAiCodeEditorProviderHealthStatus = "ready" | "quota_exceeded" | "error" | "not_configured"
export type AdminAiCodeEditorTaskStatus =
  | "queued"
  | "planning"
  | "ready_for_review"
  | "approved"
  | "blocked_provider_quota"
  | "ai_generation_unavailable"
  | "rejected"
  | "needs_adjustment"
  | "published"
  | "rollback_ready_for_review"
  | "rolled_back"
  | "failed"
export type AdminAiCodeEditorRiskLevel = "low" | "medium" | "high"
export type AdminAiCodeEditorPreviewStatus = "not_requested" | "pending" | "ready" | "failed"
export type AdminAiCodeEditorExecutionStatus = "not_requested" | "pending" | "passed" | "failed"
export type AdminAiCodeEditorFileChangeType =
  | "create"
  | "modify"
  | "delete"
  | "created"
  | "modified"
  | "deleted"
  | "renamed"
export type AdminAiCodeEditorFileChangeStatus = "planned" | "generated" | "applied" | "reverted"
export type AdminAiCodeEditorDeployProvider = "vercel" | "github" | "manual"
export type AdminAiCodeEditorDeployStatus = "not_requested" | "pending" | "ready" | "failed" | "rolled_back"

export interface AdminAiCodeEditorProviderHealth {
  configured: boolean
  model: string
  status: AdminAiCodeEditorProviderHealthStatus
  last_error: string | null
  last_error_at: string | null
}

export interface AdminAiCodeEditorConfig {
  config_key: string
  config_value: {
    enabled: boolean
    make_default: boolean
    legacy_editor_fallback_enabled: boolean
    worker_mode: AdminAiCodeEditorWorkerMode
    github_repository: string
    vercel_project_name: string
    primary_provider: AdminAiCodeEditorProvider
    secondary_provider: AdminAiCodeEditorProvider
    primary_model: string
    secondary_model: string
    auto_run_tests: boolean
    auto_run_build: boolean
    request_preview_deploy: boolean
    require_explicit_publish_confirmation: boolean
    generation_mode: AdminAiCodeEditorGenerationMode
    provider_statuses: Record<AdminAiCodeEditorProvider, AdminAiCodeEditorProviderHealth>
    github_configured: boolean
    vercel_configured: boolean
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminAiCodeEditorFileChange {
  id: string
  task_id: string
  file_path: string
  previous_file_path?: string | null
  change_type: AdminAiCodeEditorFileChangeType
  status: AdminAiCodeEditorFileChangeStatus
  rationale: string | null
  summary?: string | null
  diff_preview: string | null
  diff_patch?: string | null
  before_sha?: string | null
  after_sha?: string | null
  language?: string | null
  risk_level?: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AdminAiCodeEditorEvent {
  id: string
  task_id: string
  actor_user_id: string | null
  event_type: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AdminAiCodeEditorDeploy {
  id: string
  task_id: string
  provider: AdminAiCodeEditorDeployProvider
  environment: string
  deployment_id: string | null
  deployment_url: string | null
  status: AdminAiCodeEditorDeployStatus
  git_branch?: string | null
  commit_sha?: string | null
  ready_at?: string | null
  error_message?: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AdminAiCodeEditorTask {
  id: string
  requested_by: string
  approved_by: string | null
  prompt: string
  normalized_prompt: string
  title: string
  summary: string
  status: AdminAiCodeEditorTaskStatus
  scope_classification: string
  risk_level: AdminAiCodeEditorRiskLevel
  worker_mode: AdminAiCodeEditorWorkerMode
  branch_name: string
  default_branch?: string | null
  commit_message: string
  commit_sha: string | null
  pull_request_number?: number | null
  pull_request_url: string | null
  pull_request_status?: string | null
  preview_url: string | null
  preview_status: AdminAiCodeEditorPreviewStatus
  test_status: AdminAiCodeEditorExecutionStatus
  build_status: AdminAiCodeEditorExecutionStatus
  files_analyzed: string[]
  files_planned: string[]
  plan_json: Record<string, unknown>
  result_summary: string | null
  sensitive_change: boolean
  sensitive_reasons: string[]
  requires_explicit_publish_confirmation: boolean
  published_at: string | null
  rolled_back_at: string | null
  approved_at: string | null
  execution_error?: string | null
  last_execution_at?: string | null
  merged_at?: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  file_changes?: AdminAiCodeEditorFileChange[]
  events?: AdminAiCodeEditorEvent[]
  deploys?: AdminAiCodeEditorDeploy[]
}

export type AiPageEditorProvider = "gemini" | "openai"
export type AdminAiPageEditorModelStage =
  | "conversation"
  | "planner"
  | "complex_proposal"
  | "fallback"

export interface AdminAiPageEditorConfig {
  config_key: string
  config_value: {
    enabled: boolean
    launcher_label: string
    allowed_paths: string[]
    primary_provider: AiPageEditorProvider
    fallback_provider: AiPageEditorProvider
    gemini_model: string
    openai_model: string
    conversation_provider?: AiPageEditorProvider
    conversation_model?: string
    planner_provider?: AiPageEditorProvider
    planner_model?: string
    complex_provider?: AiPageEditorProvider
    complex_model?: string
    fallback_model?: string
    max_attachments: number
    max_attachment_size_mb: number
    base_prompt: string
    require_confirmation: boolean
    panel_width: "compact" | "wide"
  }
  description: string | null
  is_public: boolean
  updated_at: string | null
}

export interface AdminAiPageEditorSecretStatus {
  gemini_api_key_present: boolean
  openai_api_key_present: boolean
}

export interface AdminAiPageEditorProviderTestResult {
  provider: AiPageEditorProvider
  model?: string
  stage?: AdminAiPageEditorModelStage
  ok: boolean
  status: "ok" | "missing_key" | "quota_exceeded" | "error"
  message: string
}

export type AdminAiPageEditorScope = "text" | "block" | "section" | "page" | "header" | "footer"
export type AdminAiPageEditorMode =
  | "text_patch"
  | "style_patch"
  | "spacing_patch"
  | "section_layout_patch"
  | "image_patch"
  | "section_replace"
export type AdminAiPageEditorRiskLevel = "low" | "medium" | "high"
export type AdminAiPageEditorOperationType =
  | "set_style"
  | "remove_style"
  | "update_text"
  | "set_asset"
  | "move_node"
  | "replace_section"
  | "set_responsive_rule"
  | "wrap_children"
  | "unwrap_children"
  | "change_columns"
export type AdminAiPageEditorBreakpoint = "mobile" | "tablet" | "desktop" | "all"
export type AdminAiPageEditorFinalStatus =
  | "needs_clarification"
  | "awaiting_intent_confirmation"
  | "proposal_ready"
  | "draft_saved"
  | "no_visible_change"
  | "blocked"
  | "error"

export type AdminAiPageEditorConversationPhase =
  | "understanding"
  | "needs_clarification"
  | "awaiting_intent_confirmation"
  | "ready_for_proposal"

export type AiPageEditorAttachmentRole =
  | "target_capture"
  | "insert_image_asset"
  | "reference_image"
  | "unknown"

export interface AdminAiPageEditorCaptureViewport {
  width: number
  height: number
  scrollX: number
  scrollY: number
  devicePixelRatio: number
}

export interface AdminAiPageEditorCaptureSelectionRect {
  x: number
  y: number
  width: number
  height: number
  pageX: number
  pageY: number
}

export interface AdminAiPageEditorDomCandidateRect {
  x: number
  y: number
  width: number
  height: number
  top: number
  left: number
  right: number
  bottom: number
}

export interface AdminAiPageEditorDomCandidateParentContext {
  tagName?: string
  classNames?: string[]
  textSnippet?: string
  managedNodeId?: string
  blockId?: string
}

export interface AdminAiPageEditorDomCandidateStyleSnapshot {
  color?: string
  backgroundColor?: string
  fontSize?: string
  fontWeight?: string
  textAlign?: string
  display?: string
}

export interface AdminAiPageEditorDomCandidate {
  candidateId: string
  tagName: string
  safeSelector?: string
  domPath?: string
  managedNodeId?: string
  blockId?: string
  componentId?: string
  role?: string
  classNames: string[]
  idAttribute?: string
  textContent?: string
  normalizedText?: string
  textFingerprint?: string
  rect: AdminAiPageEditorDomCandidateRect
  intersectsSelection: boolean
  intersectionRatio: number
  isTextBearing: boolean
  isHeading: boolean
  isButton: boolean
  isImage: boolean
  isEditableManagedContent: boolean
  computedStyle?: AdminAiPageEditorDomCandidateStyleSnapshot
  parentContext?: AdminAiPageEditorDomCandidateParentContext
  confidence: number
  source: "elementsFromPoint" | "rect_intersection" | "text_node"
}

export interface AdminAiPageEditorTargetCapture {
  id: string
  role: "target_capture"
  pathname: string
  capturedAt: string
  viewport: AdminAiPageEditorCaptureViewport
  selectionRect: AdminAiPageEditorCaptureSelectionRect
  screenshot?: {
    attachmentId?: string
    mimeType?: string
    width?: number
    height?: number
  }
  domCandidates: AdminAiPageEditorDomCandidate[]
  primaryCandidate?: AdminAiPageEditorDomCandidate
  textFragments: string[]
  captureDiagnostics: {
    elementCount: number
    textCandidateCount: number
    primaryCandidateConfidence: number
    source: "live_dom_selection"
  }
}

export interface AdminAiPageEditorResolvedTargetEvidence {
  captureProvided: boolean
  primaryCandidateProvided: boolean
  textAnchorProvided: boolean
  exactTextMatch: boolean
  normalizedTextMatch: boolean
  candidateIntersectsCapture: boolean
  candidateMatchesManagedContent: boolean
}

export interface AdminAiPageEditorResolvedTarget {
  found: boolean
  confidence: number
  resolutionSource:
    | "managed_node_id"
    | "block_id"
    | "dom_primary_candidate"
    | "capture_text_exact"
    | "capture_text_normalized"
    | "baseline_text_exact"
    | "baseline_text_normalized"
    | "combined_evidence"
    | "not_found"
  selectedTarget?: {
    targetId: string
    selector?: string
    managedNodeId?: string
    blockId?: string
    tagName?: string
    text?: string
    normalizedText?: string
    source?: string
  }
  candidateCount: number
  evidence: AdminAiPageEditorResolvedTargetEvidence
  rejectionReasons: string[]
  sourceBaseVersion?: {
    id?: string | null
    version_number?: number | null
    status?: string | null
    source?: string | null
  } | null
  capture?: AdminAiPageEditorTargetCapture | null
}

export interface AdminAiPageEditorPendingTargetClarification {
  requestedAt: string
  intent: "set_text_color" | "set_style" | "replace_image" | "other"
  textAnchor?: string | null
  requestedProperty?: string | null
  requestedValue?: string | null
  awaiting: "capture" | "context_text" | "selection_confirmation"
  capturedTarget?: AdminAiPageEditorTargetCapture | null
  resolvedTarget?: AdminAiPageEditorResolvedTarget | null
}

export interface AdminAiPageEditorAttachmentMetadata {
  source?: "capture" | "upload" | "paste" | "link" | "unknown"
  target_path?: string | null
  target_slug?: string | null
  capture_rect?: {
    left: number
    top: number
    width: number
    height: number
  } | null
  viewport?: {
    width: number
    height: number
  } | null
  target_capture?: AdminAiPageEditorTargetCapture | null
}

export interface AdminAiPageEditorAttachmentInput {
  id: string
  name: string
  mime_type: string
  data_url: string
  size_bytes: number
  role?: AiPageEditorAttachmentRole
  metadata?: AdminAiPageEditorAttachmentMetadata | null
}

export interface AdminAiPageEditorPendingImageInsert {
  target_source: "capture"
  target_page: string
  target_slug: string | null
  target_hint: "selected_area"
  capture_attachment_id: string
  capture_attachment_name?: string | null
  image_asset_attachment_id?: string | null
  image_asset_url?: string | null
  status: "waiting_for_image_asset" | "awaiting_confirmation"
}

export interface AdminAiPageEditorOperation {
  type: AdminAiPageEditorOperationType
  target_id: string
  path?: string
  value?: unknown
  breakpoint: AdminAiPageEditorBreakpoint
}

export interface AdminAiPageEditorTargetResolutionSignals {
  id_structural: number
  internal_path: number
  data_attributes: number
  nearest_heading: number
  anchor_text: number
  visual_order: number
  textual_similarity: number
  capture_attachment: number
}

export interface AdminAiPageEditorTargetResolution {
  requested_target_id: string
  resolved_target_id: string
  candidate_path: string
  confidence: number
  section_index: number
  block_type: string
  selector: string
  signals: AdminAiPageEditorTargetResolutionSignals
}

export interface AdminAiPageEditorSpacingDiagnosis {
  source: "page_wrapper_spacing" | "first_section_spacing" | "section_internal_spacing"
  target_id: string
  selector: string
  detected_value: number | null
  reason: string
}

export interface AdminAiPageEditorBaseVersionInfo {
  id: string
  version_number: number
  status: string
}

export interface AdminAiPageEditorEditPlan {
  scope: AdminAiPageEditorScope
  mode: AdminAiPageEditorMode
  target_ids: string[]
  risk_level: AdminAiPageEditorRiskLevel
  requires_strict_confirmation: boolean
  operations: AdminAiPageEditorOperation[]
}

export interface AdminAiPageEditorChangeSummary {
  layout_changed: boolean
  style_changed: boolean
  html_changed: boolean
  text_changed?: boolean
}

export interface AdminAiPageEditorOperationalState {
  final_status: AdminAiPageEditorFinalStatus
  change_detected: boolean
  draft_saved: boolean
  preview_available: boolean
  change_summary: AdminAiPageEditorChangeSummary
}

export type AdminAiPageEditorProposalMetadata = Record<string, unknown> & {
  ai_contract_version?: string
  ai_edit_plan?: AdminAiPageEditorEditPlan
  ai_invariants?: Record<string, unknown> & {
    target_resolutions?: AdminAiPageEditorTargetResolution[]
    spacing_diagnosis?: AdminAiPageEditorSpacingDiagnosis[]
    supports_persistible_flow?: boolean
    scoped_patch?: boolean
    preview_renderable?: boolean
    desktop_renderable?: boolean
    mobile_renderable?: boolean
    context_source?: "latest_draft" | "published_version" | "none"
    degraded_draft_bypassed?: boolean
    context_selection_reason?: string
    published_version_id?: string | null
    latest_draft_id?: string | null
    plan_source?: string
    patch_engine_version?: string
  }
  base_version?: AdminAiPageEditorBaseVersionInfo | null
}

export interface AdminAiPageEditorDraftProposal {
  slug: string
  title: string
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  metadata: AdminAiPageEditorProposalMetadata
}

export interface AdminAiPageEditorProposal extends AdminAiPageEditorOperationalState {
  provider_used: AiPageEditorProvider
  summary: string
  explanation: string
  warnings: string[]
  edit_plan: AdminAiPageEditorEditPlan
  proposal: AdminAiPageEditorDraftProposal
}

export interface AdminAiPageEditorConversationContextMessage {
  role: "user" | "assistant"
  text: string
}

export interface AdminAiPageEditorConversationContext {
  phase?: AdminAiPageEditorConversationPhase | null
  understanding_summary?: string | null
  clarification_questions_count?: number
  quick_reply_selected?: string | null
  confirmation_token?: string | null
  recent_messages?: AdminAiPageEditorConversationContextMessage[]
  pending_image_insert?: AdminAiPageEditorPendingImageInsert | null
  pending_target_clarification?: AdminAiPageEditorPendingTargetClarification | null
}

export interface AdminAiPageEditorConversationResponse extends AdminAiPageEditorOperationalState {
  request_id?: string
  client_request_id?: string | null
  provider_used: AiPageEditorProvider
  conversation_phase: AdminAiPageEditorConversationPhase
  assistant_message: string
  quick_replies: string[]
  understanding_summary: string | null
  confirmation_token?: string | null
  confirmation_consumed?: boolean
  requires_user_confirmation: boolean
  can_generate_proposal: boolean
  warnings: string[]
  edit_plan?: AdminAiPageEditorEditPlan
  proposal?: AdminAiPageEditorDraftProposal
  summary?: string
  explanation?: string
  pending_image_insert?: AdminAiPageEditorPendingImageInsert | null
  pending_target_clarification?: AdminAiPageEditorPendingTargetClarification | null
}

export interface AdminAiFooterCopyProposal extends AdminAiPageEditorOperationalState {
  provider_used: AiPageEditorProvider
  summary: string
  explanation: string
  warnings: string[]
  footer_description: string
}

export interface AdminAiHeaderCopyProposal extends AdminAiPageEditorOperationalState {
  provider_used: AiPageEditorProvider
  summary: string
  explanation: string
  warnings: string[]
  header_announcement: string
}

export type AdminAiPageEditorUsageAction = "generate_proposal" | "test_providers"

export interface AdminAiPageEditorUsageSummary {
  period_days: number
  currency: "USD"
  total_requests: number
  total_generate_requests: number
  total_test_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_estimated_cost_usd: number
  priced_requests: number
  unpriced_requests: number
  last_event_at: string | null
  by_mode: Record<string, number>
  by_scope: Record<string, number>
  by_risk_level: Record<string, number>
}

export interface AdminAiPageEditorUsageBreakdownItem {
  provider: AiPageEditorProvider
  model: string
  action: AdminAiPageEditorUsageAction
  requests: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number
  priced_requests: number
  unpriced_requests: number
  last_event_at: string | null
}

export interface AdminAiPageEditorUsageRecentItem {
  id: string
  created_at: string
  action: AdminAiPageEditorUsageAction
  provider: AiPageEditorProvider
  model: string
  slug: string | null
  path: string | null
  mode: AdminAiPageEditorMode | string | null
  scope: AdminAiPageEditorScope | string | null
  risk_level: AdminAiPageEditorRiskLevel | string | null
  target_ids: string[]
  requires_strict_confirmation: boolean
  contract_version: string | null
  invariants: Record<string, unknown>
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number | null
  currency: string
  request_id: string | null
  metadata: Record<string, unknown>
}

export interface AdminAiPageEditorUsageMetrics {
  summary: AdminAiPageEditorUsageSummary
  breakdown: AdminAiPageEditorUsageBreakdownItem[]
  recent_events: AdminAiPageEditorUsageRecentItem[]
  pricing_reference: {
    currency: "USD"
    source: string
  }
}

export type SitePageSlug =
  | "home"
  | "sobre"
  | "explicacoes"
  | "materiais"
  | "suporte"
  | "privacidade"
  | "cookies"
  | "termos"
  | "checkout"
  | "checkout-success"

export interface AdminSitePageSummary {
  id: string
  slug: SitePageSlug | string
  title: string
  status: "draft" | "published" | "archived"
  published_version_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AdminSitePageVersion {
  id: string
  page_id: string
  version_number: number
  status: "draft" | "published" | "archived"
  layout_json: Record<string, unknown>
  style_json: Record<string, unknown>
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface AdminSitePageAsset {
  id: string
  page_id: string
  bucket: string
  path: string
  storage_provider?: "supabase" | "r2" | null
  public_url: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export interface AdminSitePageDetail {
  page: AdminSitePageSummary
  versions: AdminSitePageVersion[]
  published_version: AdminSitePageVersion | null
  latest_draft: AdminSitePageVersion | null
  assets: AdminSitePageAsset[]
}

export interface PublicSitePagePayload {
  page: Pick<AdminSitePageSummary, "id" | "slug" | "title" | "updated_at" | "published_version_id">
  version: Pick<
    AdminSitePageVersion,
    "id" | "page_id" | "version_number" | "layout_json" | "style_json" | "metadata" | "created_at"
  >
}

export type AdminPlatformEmailTemplateKey =
  | "purchase_confirmed"
  | "free_product_claimed"
  | "support_ticket_created"
  | "support_ticket_replied"
  | "manual_notification"
  | "public_form_submission_admin"
  | "public_form_reply"

export interface AdminPlatformEmailTemplateContent {
  subject: string
  eyebrow: string
  title: string
  greeting: string
  intro: string
  bullets: string[]
  ctaLabel: string
  ctaUrl: string
  footer: string
}

export interface AdminPlatformEmailTemplateSummary {
  key: AdminPlatformEmailTemplateKey
  label: string
  description: string
  category: string
  availableVariables: string[]
  sampleData: Record<string, string>
  content: AdminPlatformEmailTemplateContent
  isCustomized: boolean
}

export interface AdminPlatformEmailTemplatesConfig {
  config_key: string
  description: string | null
  is_public: boolean
  updated_at: string | null
  templates: AdminPlatformEmailTemplateSummary[]
}

export type AdminNotificationCampaignAudience = "single" | "segment" | "all"
export type AdminNotificationCampaignPurchaseBasis = "active_grants"

export interface AdminNotificationCampaignRecipientPreview {
  id: string
  full_name: string | null
  email: string | null
}

export interface AdminNotificationCampaignInput {
  action: "preview" | "send"
  audience: AdminNotificationCampaignAudience
  userId?: string
  role?: AdminUserSummary["role"]
  status?: AdminUserSummary["status"]
  productCategoryId?: string | null
  productId?: string | null
  purchaseBasis: AdminNotificationCampaignPurchaseBasis
  type: NotificationItem["type"]
  title: string
  emailSubject?: string | null
  messageHtml: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  sentViaEmail: boolean
  sentViaInApp: boolean
}

export interface AdminNotificationCampaignPreview {
  totalRecipients: number
  sampleRecipients: AdminNotificationCampaignRecipientPreview[]
  emailPreview: {
    subject: string
    html: string
    text: string
  } | null
}

export interface AdminNotificationEmailPreview {
  subject: string
  html: string
  text: string
  sampleRecipient: AdminNotificationCampaignRecipientPreview | null
}

export interface AdminNotificationTestEmailResult {
  emailTo: string
  processedNow: boolean
}

export interface AdminNotificationCampaignSummary {
  id: string
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  created_at: string
  audience: AdminNotificationCampaignAudience
  user_id: string | null
  purchase_basis: AdminNotificationCampaignPurchaseBasis
  role: AdminUserSummary["role"] | null
  status: AdminUserSummary["status"] | null
  type: NotificationItem["type"]
  title: string
  email_subject: string | null
  message_excerpt: string | null
  message_html: string | null
  product_id: string | null
  product_title: string | null
  product_category_id: string | null
  product_category_title: string | null
  cta_label: string | null
  cta_url: string | null
  sent_via_email: boolean
  sent_via_in_app: boolean
  can_reuse: boolean
  recipient_count: number
  email_recipient_count: number
  notification_count: number
}

export interface AdminNotificationCampaignTagOption {
  key: string
  token: string
  description: string
  category: "identity" | "navigation" | "product"
}

export interface AdminPlatformEmailTemplatePreview {
  templateKey: AdminPlatformEmailTemplateKey
  subject: string
  html: string
  text: string
  sampleData: Record<string, string>
}

export interface AdminEmailStatus {
  providerName: string | null
  transport: "smtp" | "resend" | "postmark" | "sendgrid" | null
  senderNamePresent: boolean
  senderAddressPresent: boolean
  replyToPresent: boolean
  smtpHostPresent: boolean
  smtpPortPresent: boolean
  smtpUserPresent: boolean
  smtpPasswordPresent: boolean
  ready: boolean
  missing: string[]
}

export interface ProductLessonSummary {
  id: string
  module_id: string
  title: string
  description: string | null
  position: number
  is_required: boolean
  lesson_type: "video" | "text" | "hybrid" | "file"
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
  lesson_type: "video" | "text" | "hybrid" | "file"
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
  product_id: string | null
  subject: string
  message: string
  status: "open" | "in_progress" | "answered" | "closed"
  priority: "low" | "normal" | "medium" | "high" | "urgent"
  category: "payment" | "technical" | "account" | "general"
  assigned_admin_id: string | null
  last_reply_at: string | null
  first_response_due_at: string | null
  first_response_at: string | null
  sla_status: "on_time" | "at_risk" | "overdue" | "answered"
  attachment_bucket: string | null
  attachment_path: string | null
  attachment_storage_provider?: "supabase" | "r2" | null
  attachment_name: string | null
  attachment_mime_type: string | null
  attachment_size_bytes: number | null
  created_at: string
  updated_at: string
}

export interface SupportTicketMessage {
  id: string
  ticket_id: string
  sender_user_id: string
  sender_role: "student" | "admin"
  message: string
  attachment_bucket: string | null
  attachment_path: string | null
  attachment_storage_provider?: "supabase" | "r2" | null
  attachment_name: string | null
  attachment_mime_type: string | null
  attachment_size_bytes: number | null
  created_at: string
}

export interface SupportAttachmentUploadResult {
  bucket: string
  path: string
  storage_provider?: "supabase" | "r2" | null
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
}

export interface ProfileAvatarUploadResult {
  bucket: string
  path: string
  storage_provider?: "supabase" | "r2" | null
  public_url: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
}

export interface CourseReviewAuthor {
  full_name: string | null
  avatar_url: string | null
}

export interface CourseReviewSummary {
  id: string
  author_id: string
  author_name: string | null
  target_id: string
  target_type: "course" | "product"
  target_resource_id: string | null
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_moderated: boolean
  moderation_status: "pending" | "approved" | "rejected"
  moderation_reason: string | null
  helpful_count: number
  unhelpful_count: number
  created_at: string
  updated_at: string
  profiles?: CourseReviewAuthor | null
}

export interface CourseReviewStats {
  target_id: string
  target_type: "course" | "product"
  total_reviews: number
  avg_rating: number
  rating_distribution: Record<"1" | "2" | "3" | "4" | "5", number>
  updated_at: string
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
  nif: string | null
  avatar_url: string | null
  notifications_enabled: boolean
  marketing_consent: boolean
  content_updates_consent: boolean
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
  nif: string | null
  last_login_at: string | null
  created_at: string
  notifications_enabled: boolean
  marketing_consent: boolean
  content_updates_consent: boolean
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
  payment_provider?: string | null
  payment_reference: string | null
  checkout_session_id: string | null
  payment_environment?: "test" | "live" | null
  paid_at: string | null
  refunded_at: string | null
  created_at: string
}

export interface StudentPaymentSummary {
  id: string
  product_id: string
  product_title: string | null
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
  currency: string
  base_price_cents: number
  discount_cents: number
  final_price_cents: number
  payment_provider: string | null
  payment_reference: string | null
  checkout_session_id: string | null
  payment_environment?: "test" | "live" | null
  paid_at: string | null
  refunded_at: string | null
  created_at: string
}

export interface AdminOrderViewSummary extends AdminOrderSummary {
  user_name: string | null
  user_email: string | null
  product_title: string | null
  product_type: ProductSummary["product_type"] | null
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

export type AdminCronKey =
  | "process_email_deliveries"
  | "retry_email_deliveries"
  | "reconcile_orders"
  | "audit_access_consistency"
  | "clean_expired_links"

export interface AdminCronScheduleSummary {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
}

export interface AdminCronInvokeResult {
  cron: AdminCronKey
  slug: string
  ok: boolean
  status: number
  result: unknown
}

export interface AdminCronStatusOverview {
  scheduledJobs: AdminCronScheduleSummary[]
  jobRuns: AdminJobRunSummary[]
}

export interface AdminSupportTicketSummary extends SupportTicketSummary {
  user_id: string
}

export interface PublicFormSubmissionSummary {
  id: string
  form_type: string
  source_page: string
  full_name: string
  email: string
  subject: string
  message: string
  metadata: Record<string, unknown>
  notified_email_to: string | null
  notified_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminNotificationSummary extends NotificationItem {
  user_id: string | null
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

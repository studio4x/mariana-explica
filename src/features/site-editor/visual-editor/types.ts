export type VisualEditorPageKey = "support" | "materials"

export type VisualEditorFieldKind = "text" | "textarea" | "link" | "image" | "list" | "json"

export interface VisualEditorDocument extends Record<string, unknown> {}

export interface VisualEditorLinkValue {
  label: string
  href: string
}

export interface VisualEditorImageValue {
  src: string
  alt: string
}

export interface VisualEditorPageSummary {
  id: string
  page_key: VisualEditorPageKey | string
  title: string
  status: "draft" | "published" | "archived"
  published_version_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VisualEditorPageVersion {
  id: string
  page_id: string
  version_number: number
  status: "draft" | "published" | "archived"
  entries_json: VisualEditorDocument
  style_json: Record<string, unknown>
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface VisualEditorPageAsset {
  id: string
  page_id: string
  bucket: string
  path: string
  public_url: string
  file_name: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export interface VisualEditorPageDetail {
  page: VisualEditorPageSummary
  versions: VisualEditorPageVersion[]
  publishedVersion: VisualEditorPageVersion | null
  latestDraft: VisualEditorPageVersion | null
  assets: VisualEditorPageAsset[]
}

export interface VisualEditorPublicPagePayload {
  page: Pick<VisualEditorPageSummary, "id" | "page_key" | "title" | "updated_at" | "published_version_id">
  version: Pick<
    VisualEditorPageVersion,
    "id" | "page_id" | "version_number" | "entries_json" | "style_json" | "metadata" | "created_at"
  >
}

export interface VisualEditorFieldDefinition {
  key: string
  label: string
  kind: VisualEditorFieldKind
  description?: string
  placeholder?: string
}

export interface VisualEditorSelectedEditable {
  pageKey: VisualEditorPageKey | string
  entryKey: string
  entryType: VisualEditorFieldKind
  label: string
  fallback: unknown
  currentValue: unknown
  schema: VisualEditorFieldDefinition
}

export interface VisualEditorPageDefinition {
  pageKey: VisualEditorPageKey
  title: string
  publicPath: string
  description: string
  defaultDocument: VisualEditorDocument
  fields: VisualEditorFieldDefinition[]
}

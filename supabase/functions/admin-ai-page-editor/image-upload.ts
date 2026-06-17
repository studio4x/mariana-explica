const ASSET_BUCKET = "site-pages-public"
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
])

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function sanitizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
}

function sanitizeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
  return normalized || "asset"
}

function decodeBase64DataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i)
  if (!match?.[2]) {
    throw new Error("A imagem enviada nao esta num data URL base64 valido.")
  }

  const mimeType = normalizeText(match[1]).toLowerCase()
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))
  return { mimeType, bytes }
}

function ensureAllowedMimeType(mimeType: string) {
  const normalized = normalizeText(mimeType).toLowerCase().split(";")[0]?.trim() ?? ""
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    throw new Error("A imagem precisa de estar em PNG, JPG, WebP, GIF, AVIF ou SVG.")
  }
  return normalized
}

async function ensureBucket(serviceClient: {
  storage: {
    getBucket: (bucket: string) => Promise<{ data: unknown }>
    createBucket: (bucket: string, options: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>
  }
}) {
  const { data: bucket } = await serviceClient.storage.getBucket(ASSET_BUCKET)
  if (bucket) return
  const { error } = await serviceClient.storage.createBucket(ASSET_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_IMAGE_BYTES}`,
  })
  if (error && !String(error.message ?? "").toLowerCase().includes("already exists")) {
    throw error
  }
}

function extensionFromMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    case "image/avif":
      return "avif"
    case "image/svg+xml":
      return "svg"
    default:
      return "bin"
  }
}

function extractFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const last = pathname.split("/").filter(Boolean).at(-1) ?? "imagem"
    return decodeURIComponent(last)
  } catch {
    return "imagem"
  }
}

async function uploadPersistedImage(input: {
  serviceClient: {
    storage: {
      getBucket: (bucket: string) => Promise<{ data: unknown }>
      createBucket: (bucket: string, options: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>
      from: (bucket: string) => {
        upload: (
          path: string,
          body: Uint8Array,
          options: { contentType: string; cacheControl: string; upsert: boolean },
        ) => Promise<{ error: unknown }>
        getPublicUrl: (path: string) => { data: { publicUrl?: string | null } }
      }
    }
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => {
          single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
        }
      }
    }
  }
  slug: string
  pageId: string
  userId: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}) {
  if (input.bytes.byteLength <= 0) {
    throw new Error("A imagem enviada esta vazia.")
  }
  if (input.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("A imagem excede o limite de 12MB.")
  }

  await ensureBucket(input.serviceClient)
  const safeMimeType = ensureAllowedMimeType(input.mimeType)
  const slug = sanitizeSlug(input.slug)
  const baseName = sanitizeFileName(input.fileName.replace(/\.[^.]+$/, ""))
  const extension = extensionFromMimeType(safeMimeType)
  const storagePath = `pages/${slug}/${Date.now()}-${crypto.randomUUID()}-${baseName}.${extension}`

  const { error: uploadError } = await input.serviceClient.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: safeMimeType,
      cacheControl: "3600",
      upsert: false,
    })
  if (uploadError) throw uploadError

  const publicUrl = normalizeText(input.serviceClient.storage.from(ASSET_BUCKET).getPublicUrl(storagePath).data.publicUrl)
  if (!publicUrl) {
    throw new Error("Nao foi possivel gerar a URL publica da imagem.")
  }

  const { data: asset, error: assetError } = await input.serviceClient
    .from("site_page_assets")
    .insert({
      page_id: input.pageId,
      bucket: ASSET_BUCKET,
      path: storagePath,
      public_url: publicUrl,
      file_name: input.fileName,
      mime_type: safeMimeType,
      file_size_bytes: input.bytes.byteLength,
      uploaded_by: input.userId,
    })
    .select("id,page_id,bucket,path,public_url,file_name,mime_type,file_size_bytes,uploaded_by,created_at")
    .single()
  if (assetError) throw assetError

  return {
    publicUrl,
    asset,
    mimeType: safeMimeType,
    fileName: input.fileName,
    sizeBytes: input.bytes.byteLength,
  }
}

export async function persistAiEditorImageAssetFromDataUrl(input: {
  serviceClient: Parameters<typeof uploadPersistedImage>[0]["serviceClient"]
  slug: string
  pageId: string
  userId: string
  fileName: string
  dataUrl: string
}) {
  const decoded = decodeBase64DataUrl(input.dataUrl)
  return await uploadPersistedImage({
    serviceClient: input.serviceClient,
    slug: input.slug,
    pageId: input.pageId,
    userId: input.userId,
    fileName: input.fileName,
    mimeType: decoded.mimeType,
    bytes: decoded.bytes,
  })
}

export async function persistAiEditorImageAssetFromUrl(input: {
  serviceClient: Parameters<typeof uploadPersistedImage>[0]["serviceClient"]
  slug: string
  pageId: string
  userId: string
  imageUrl: string
}) {
  const trimmedUrl = normalizeText(input.imageUrl)
  if (!/^https:\/\//i.test(trimmedUrl)) {
    throw new Error("O link da imagem precisa de usar HTTPS.")
  }
  if (/^(javascript:|data:)/i.test(trimmedUrl)) {
    throw new Error("O link enviado nao e seguro para uso como imagem.")
  }

  const response = await fetch(trimmedUrl)
  if (!response.ok) {
    throw new Error("Nao foi possivel descarregar a imagem enviada por link.")
  }

  const mimeType = ensureAllowedMimeType(response.headers.get("content-type") ?? "")
  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const fileName = extractFileNameFromUrl(trimmedUrl) || `imagem.${extensionFromMimeType(mimeType)}`

  return await uploadPersistedImage({
    serviceClient: input.serviceClient,
    slug: input.slug,
    pageId: input.pageId,
    userId: input.userId,
    fileName,
    mimeType,
    bytes,
  })
}

export function getLessonVideoAssetId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  if (!trimmed.toLowerCase().startsWith("asset:")) {
    return null
  }

  const assetId = trimmed.slice("asset:".length).trim()
  return assetId || null
}

export function makeLessonVideoAssetValue(assetId: string) {
  return `asset:${assetId}`
}

const YOUTUBE_EMBED_BASE_URL = "https://www.youtube-nocookie.com/embed"

function parseYoutubeTimestamp(rawValue: string | null) {
  if (!rawValue) return null

  const trimmed = rawValue.trim().toLowerCase()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    const totalSeconds = Number.parseInt(trimmed, 10)
    return Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : null
  }

  const parts = [...trimmed.matchAll(/(\d+)(h|m|s)/g)]
  if (parts.length === 0) {
    return null
  }

  const totalSeconds = parts.reduce((sum, part) => {
    const value = Number.parseInt(part[1] ?? "0", 10)
    const unit = part[2]

    if (!Number.isFinite(value)) {
      return sum
    }

    if (unit === "h") return sum + value * 3600
    if (unit === "m") return sum + value * 60
    return sum + value
  }, 0)

  return totalSeconds > 0 ? totalSeconds : null
}

function getYoutubeStartSeconds(url: URL) {
  const directValue =
    url.searchParams.get("start")
    ?? url.searchParams.get("t")
    ?? url.searchParams.get("time_continue")

  const directSeconds = parseYoutubeTimestamp(directValue)
  if (directSeconds) {
    return directSeconds
  }

  const hashValue = url.hash.replace(/^#/, "")
  if (!hashValue) {
    return null
  }

  const hashParams = new URLSearchParams(hashValue)
  return parseYoutubeTimestamp(hashParams.get("t") ?? hashParams.get("start"))
}

function buildYoutubeEmbedUrl(videoId: string, startSeconds?: number | null) {
  const params = new URLSearchParams({
    controls: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    cc_load_policy: "0",
    playsinline: "1",
    fs: "1",
  })

  if (startSeconds && startSeconds > 0) {
    params.set("start", String(startSeconds))
  }

  return `${YOUTUBE_EMBED_BASE_URL}/${encodeURIComponent(videoId)}?${params.toString()}`
}

export function getYoutubeEmbedUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  if (!trimmed || getLessonVideoAssetId(trimmed)) {
    return null
  }

  try {
    const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    const startSeconds = getYoutubeStartSeconds(url)

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0]
      return videoId ? buildYoutubeEmbedUrl(videoId, startSeconds) : null
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v")?.trim()
        return videoId ? buildYoutubeEmbedUrl(videoId, startSeconds) : null
      }

      if (url.pathname.startsWith("/embed/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1]
        return videoId ? buildYoutubeEmbedUrl(videoId, startSeconds) : null
      }

      if (url.pathname.startsWith("/shorts/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1]
        return videoId ? buildYoutubeEmbedUrl(videoId, startSeconds) : null
      }
    }

    return null
  } catch {
    return null
  }
}

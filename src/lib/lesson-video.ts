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

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v")?.trim()
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null
      }

      if (url.pathname.startsWith("/embed/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1]
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null
      }

      if (url.pathname.startsWith("/shorts/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1]
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null
      }
    }

    return null
  } catch {
    return null
  }
}

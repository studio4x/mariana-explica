import { useEffect, useState } from "react"
import { AlertCircle, Loader2, PlayCircle } from "lucide-react"
import { requestAssetAccess } from "@/services"
import { getLessonVideoAssetId, getYoutubeEmbedUrl } from "@/lib/lesson-video"

interface LessonPrimaryMediaProps {
  source: string | null | undefined
  title?: string
}

export function LessonPrimaryMedia({
  source,
  title = "Video principal",
}: LessonPrimaryMediaProps) {
  const assetId = getLessonVideoAssetId(source)
  const youtubeEmbedUrl = getYoutubeEmbedUrl(source)
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [isLoadingAsset, setIsLoadingAsset] = useState(false)

  useEffect(() => {
    if (!assetId) {
      setAssetUrl(null)
      setAssetError(null)
      setIsLoadingAsset(false)
      return
    }

    let active = true
    setAssetUrl(null)
    setAssetError(null)
    setIsLoadingAsset(true)

    void requestAssetAccess(assetId)
      .then((result) => {
        if (!active) return
        setAssetUrl(result.url)
      })
      .catch((error: unknown) => {
        if (!active) return
        setAssetError(error instanceof Error ? error.message : "Nao foi possivel preparar o video.")
      })
      .finally(() => {
        if (!active) return
        setIsLoadingAsset(false)
      })

    return () => {
      active = false
    }
  }, [assetId])

  if (!source?.trim()) {
    return null
  }

  return (
    <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
      <div className="flex items-center gap-2 text-slate-900">
        <PlayCircle className="h-4 w-4" />
        <p className="font-medium">{title}</p>
      </div>

      {youtubeEmbedUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-sm">
          <div className="aspect-video w-full">
            <iframe
              src={youtubeEmbedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}

      {assetId ? (
        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-sm">
          <div className="aspect-video w-full">
            {isLoadingAsset ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" />
                A preparar o video...
              </div>
            ) : assetError ? (
              <div className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm font-semibold text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {assetError}
              </div>
            ) : assetUrl ? (
              <video
                src={assetUrl}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                className="h-full w-full bg-black"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {!youtubeEmbedUrl && !assetId ? (
        <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-950">URL configurada</p>
          <p className="mt-2 break-all leading-7">{source}</p>
        </div>
      ) : null}
    </div>
  )
}

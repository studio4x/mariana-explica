import { PlayCircle } from "lucide-react"
import { getExternalVideoUrl, getLessonVideoAssetId, getYoutubeEmbedUrl } from "@/lib/lesson-video"
import { ProtectedVideoPlayer } from "./ProtectedVideoPlayer"

interface LessonPrimaryMediaProps {
  source: string | null | undefined
  title?: string
}

export function LessonPrimaryMedia({
  source,
  title = "Vídeo principal",
}: LessonPrimaryMediaProps) {
  const assetId = getLessonVideoAssetId(source)
  const youtubeEmbedUrl = getYoutubeEmbedUrl(source)
  const externalVideoUrl = getExternalVideoUrl(source)
  const localVideoUrl = source?.trim().startsWith("blob:") || source?.trim().startsWith("data:") ? source.trim() : null
  if (!source?.trim()) {
    return null
  }

  return (
    <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
      <div className="flex items-center gap-2 text-slate-900">
        <PlayCircle className="h-4 w-4" />
        <p className="font-semibold text-slate-950">{title}</p>
      </div>

      {youtubeEmbedUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-sm">
          <div className="aspect-video w-full">
            <iframe
              src={youtubeEmbedUrl}
              title={title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full bg-black"
            />
          </div>
        </div>
      ) : null}

      {externalVideoUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-sm">
          <div className="aspect-video w-full">
            <video
              src={externalVideoUrl}
              controls
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              playsInline
              className="h-full w-full bg-black"
            />
          </div>
        </div>
      ) : null}

      {localVideoUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-sm">
          <div className="aspect-video w-full">
            <video
              src={localVideoUrl}
              controls
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              playsInline
              className="h-full w-full bg-black"
            />
          </div>
        </div>
      ) : null}

      {assetId ? (
        <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-950 shadow-sm">
          <div className="aspect-video w-full">
            <ProtectedVideoPlayer assetId={assetId} title={title} className="h-full w-full bg-black object-contain" />
          </div>
        </div>
      ) : null}

      {!youtubeEmbedUrl && !externalVideoUrl && !assetId ? (
        <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-950">URL configurada</p>
          <p className="mt-2 break-all leading-7">{source}</p>
        </div>
      ) : null}
    </div>
  )
}

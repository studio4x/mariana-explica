import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase"
import { cn } from "@/lib/cn"
import type { LessonContentBlock } from "@/lib/lesson-content-blocks"
import {
  normalizeLessonVideoBlockContent,
  sanitizeTableHtml,
  splitLessonContent,
} from "@/lib/lesson-content-blocks"
import {
  LESSON_PRIVATE_MEDIA_BUCKET,
  LESSON_PUBLIC_IMAGE_BUCKET,
  isRenderableLessonMediaUrl,
} from "@/lib/lesson-media"
import { getExternalVideoUrl, getYoutubeEmbedUrl } from "@/lib/lesson-video"
import { RichTextContent } from "./RichTextContent"

function isPublicLessonMediaBucket(bucket: string | null | undefined) {
  return bucket?.trim() === LESSON_PUBLIC_IMAGE_BUCKET
}

async function resolveLessonStorageUrl(bucket: string | null | undefined, path: string) {
  const trimmedBucket = bucket?.trim() || LESSON_PRIVATE_MEDIA_BUCKET
  const trimmedPath = path.trim()

  if (!trimmedPath) {
    return null
  }

  if (isPublicLessonMediaBucket(trimmedBucket)) {
    return supabase.storage.from(trimmedBucket).getPublicUrl(trimmedPath).data.publicUrl
  }

  const { data } = await supabase.storage.from(trimmedBucket).createSignedUrl(trimmedPath, 300)
  return data?.signedUrl ?? null
}

interface LessonContentBlocksRendererProps {
  value: string | null | undefined
  className?: string
}

function BlockTable({ html }: { html: string }) {
  const safeHtml = useMemo(() => sanitizeTableHtml(html), [html])
  if (!safeHtml.trim()) return null

  return (
    <div className="lesson-content-blocks-table overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  )
}

function BlockImage({ block }: { block: Extract<LessonContentBlock, { type: "image" }> }) {
  const normalized = block.content
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)
  const [resolvingImageUrl, setResolvingImageUrl] = useState(false)
  const directSource = normalized.public_url?.trim() || normalized.storage_path.trim()
  const imageUrl = isRenderableLessonMediaUrl(directSource) ? directSource : resolvedImageUrl
  const captionAlignClass =
    normalized.caption_align === "center"
      ? "text-center"
      : normalized.caption_align === "right"
        ? "text-right"
        : "text-left"

  useEffect(() => {
    if (!directSource) {
      setResolvedImageUrl(null)
      setResolvingImageUrl(false)
      return
    }

    if (isRenderableLessonMediaUrl(directSource)) {
      setResolvedImageUrl(directSource)
      setResolvingImageUrl(false)
      return
    }

    let active = true
    setResolvingImageUrl(true)
    setResolvedImageUrl(null)

    void resolveLessonStorageUrl(normalized.storage_bucket, directSource)
      .then((url) => {
        if (!active) return
        setResolvedImageUrl(url)
        setResolvingImageUrl(false)
      })
      .catch(() => {
        if (!active) return
        setResolvedImageUrl(null)
        setResolvingImageUrl(false)
      })

    return () => {
      active = false
    }
  }, [directSource, normalized.storage_bucket])

  if (!directSource) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
        Imagem sem ficheiro associado.
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
      {imageUrl ? (
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="w-full max-w-full" style={{ width: `${normalized.width_percent}%` }}>
              {normalized.link_url?.trim() ? (
                <a href={normalized.link_url.trim()} target="_blank" rel="noopener noreferrer">
                  <img
                    src={imageUrl}
                    alt={normalized.alt || "Imagem da aula"}
                    className="block w-full rounded-lg object-contain"
                    loading="lazy"
                  />
                </a>
              ) : (
                <img
                  src={imageUrl}
                  alt={normalized.alt || "Imagem da aula"}
                  className="block w-full rounded-lg object-contain"
                  loading="lazy"
                />
              )}
            </div>
          </div>
          {normalized.caption.trim() ? (
            <figcaption className={`px-1 text-sm leading-6 text-slate-600 ${captionAlignClass}`}>
              {normalized.caption}
            </figcaption>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {resolvingImageUrl ? "A carregar pré-visualização da imagem..." : "Imagem sem pré-visualização disponível."}
        </div>
      )}
    </figure>
  )
}

function BlockVideo({ block }: { block: Extract<LessonContentBlock, { type: "video" }> }) {
  const normalized = normalizeLessonVideoBlockContent(block.content)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  const [resolvingVideoUrl, setResolvingVideoUrl] = useState(false)
  const directSource = normalized.public_url?.trim() || normalized.storage_path.trim()
  const videoSource = isRenderableLessonMediaUrl(directSource) ? directSource : resolvedVideoUrl
  const embedUrl = getYoutubeEmbedUrl(videoSource)
  const externalVideoUrl = getExternalVideoUrl(videoSource)

  useEffect(() => {
    if (!directSource) {
      setResolvedVideoUrl(null)
      setResolvingVideoUrl(false)
      return
    }

    if (isRenderableLessonMediaUrl(directSource)) {
      setResolvedVideoUrl(directSource)
      setResolvingVideoUrl(false)
      return
    }

    let active = true
    setResolvingVideoUrl(true)
    setResolvedVideoUrl(null)

    void resolveLessonStorageUrl(normalized.storage_bucket, directSource)
      .then((url) => {
        if (!active) return
        setResolvedVideoUrl(url)
        setResolvingVideoUrl(false)
      })
      .catch(() => {
        if (!active) return
        setResolvedVideoUrl(null)
        setResolvingVideoUrl(false)
      })

    return () => {
      active = false
    }
  }, [directSource, normalized.storage_bucket])

  if (!directSource) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
        Vídeo sem ficheiro ou URL associado.
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-3">
      {videoSource ? (
        embedUrl ? (
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={embedUrl}
              title={normalized.title || "Vídeo da aula"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : externalVideoUrl ? (
          <video
            src={externalVideoUrl}
            controls
            preload="metadata"
            className="block aspect-video w-full rounded-lg bg-black object-contain"
          />
        ) : (
          <video
            src={videoSource}
            controls
            preload="metadata"
            className="block aspect-video w-full rounded-lg bg-black object-contain"
          />
        )
      ) : (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 px-4 py-6 text-center text-sm text-slate-300">
          {resolvingVideoUrl ? "A carregar pré-visualização do vídeo..." : "Vídeo sem pré-visualização disponível."}
        </div>
      )}
      <figcaption className="mt-3 px-1 text-sm font-medium text-slate-100">
        {normalized.title || "Vídeo da aula"}
      </figcaption>
    </figure>
  )
}

export function LessonContentBlocksRenderer({ value, className }: LessonContentBlocksRendererProps) {
  const blocks = useMemo(() => splitLessonContent(value), [value])

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, index) => {
        if (block.type === "table") {
          return <BlockTable key={`table-${index}`} html={block.content} />
        }
        if (block.type === "image") {
          return <BlockImage key={`image-${index}`} block={block} />
        }
        if (block.type === "video") {
          return <BlockVideo key={`video-${index}`} block={block} />
        }
        return <RichTextContent key={`rich-${index}`} value={block.content} className="text-sm leading-7 text-slate-600" />
      })}
    </div>
  )
}

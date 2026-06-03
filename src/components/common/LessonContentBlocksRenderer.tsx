import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase"
import { cn } from "@/lib/cn"
import type { LessonContentBlock } from "@/lib/lesson-content-blocks"
import {
  buildLessonVideoEmbedUrl,
  normalizeLessonVideoBlockContent,
  sanitizeTableHtml,
  splitLessonContent,
} from "@/lib/lesson-content-blocks"
import { RichTextContent } from "./RichTextContent"

const LESSON_IMAGE_STORAGE_BUCKET = "course-assets-private"

function isRenderableUrl(value: string) {
  return /^(https?:|blob:|data:)/i.test(value.trim())
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
  const imageUrl = isRenderableUrl(directSource) ? directSource : resolvedImageUrl

  useEffect(() => {
    if (!directSource) {
      setResolvedImageUrl(null)
      setResolvingImageUrl(false)
      return
    }

    if (isRenderableUrl(directSource)) {
      setResolvedImageUrl(directSource)
      setResolvingImageUrl(false)
      return
    }

    let active = true
    setResolvingImageUrl(true)
    setResolvedImageUrl(null)

    void supabase.storage
      .from(LESSON_IMAGE_STORAGE_BUCKET)
      .createSignedUrl(directSource, 300)
      .then(({ data }) => {
        if (!active) return
        setResolvedImageUrl(data?.signedUrl ?? null)
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
  }, [directSource])

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
            <figcaption className="px-1 text-sm leading-6 text-slate-600">{normalized.caption}</figcaption>
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
  const videoUrl = normalized.public_url?.trim() || normalized.storage_path.trim()
  const embedUrl = buildLessonVideoEmbedUrl(videoUrl)

  if (!videoUrl) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
        Vídeo sem ficheiro ou URL associado.
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-3">
      {embedUrl ? (
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
      ) : (
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className="block aspect-video w-full rounded-lg bg-black object-contain"
        />
      )}
      <figcaption className="mt-3 px-1 text-sm font-medium text-slate-100">{normalized.title || "Vídeo da aula"}</figcaption>
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

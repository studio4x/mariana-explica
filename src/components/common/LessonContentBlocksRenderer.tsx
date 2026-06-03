import { useMemo } from "react"
import { cn } from "@/lib/cn"
import type { LessonContentBlock } from "@/lib/lesson-content-blocks"
import {
  buildLessonVideoEmbedUrl,
  normalizeLessonVideoBlockContent,
  sanitizeTableHtml,
  splitLessonContent,
} from "@/lib/lesson-content-blocks"
import { RichTextContent } from "./RichTextContent"

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
  const imageUrl = block.content.public_url?.trim() || block.content.storage_path.trim()

  if (!imageUrl) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
        Imagem sem ficheiro associado.
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
      <img src={imageUrl} alt={block.content.alt || "Imagem da aula"} className="block w-full rounded-lg object-cover" loading="lazy" />
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

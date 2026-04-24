import { useMemo, useState } from "react"
import { cn } from "@/lib/cn"
import type { LessonContentBlock } from "@/lib/lesson-content-blocks"
import {
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

function ImageHotspotsBlock({ block }: { block: Extract<LessonContentBlock, { type: "image-hotspots" }> }) {
  const [selectedId, setSelectedId] = useState<string | null>(block.content.hotspots[0]?.id ?? null)
  const selectedHotspot = block.content.hotspots.find((item) => item.id === selectedId) ?? block.content.hotspots[0] ?? null
  const imageUrl = block.content.asset.signed_url || block.content.asset.storage_path

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img src={imageUrl} alt={block.content.asset.alt} className="w-full object-cover" />
          {block.content.hotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              onClick={() => setSelectedId(hotspot.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1398B7] px-2 py-1 text-[11px] font-bold text-white shadow"
              style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            >
              {hotspot.title}
            </button>
          ))}
        </div>
      ) : null}

      {selectedHotspot ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="font-semibold text-slate-900">{selectedHotspot.title}</p>
          <RichTextContent value={selectedHotspot.body_html} className="mt-2 text-sm leading-7 text-slate-600" />
        </div>
      ) : null}
    </div>
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
        if (block.type === "image-hotspots") {
          return <ImageHotspotsBlock key={`hotspots-${index}`} block={block} />
        }
        return <RichTextContent key={`rich-${index}`} value={block.content} className="text-sm leading-7 text-slate-600" />
      })}
    </div>
  )
}


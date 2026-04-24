import { ArrowDown, ArrowUp, ImagePlus, Plus, Table2, Trash2, Type } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/cn"
import type {
  LessonContentBlock,
  LessonImageHotspotsBlockContent,
  LessonImageHotspot,
} from "@/lib/lesson-content-blocks"
import {
  mergeLessonContent,
  normalizeLessonImageHotspotsBlockContent,
  splitLessonContent,
} from "@/lib/lesson-content-blocks"
import { RichTextEditor } from "./RichTextEditor"

interface LessonContentBlocksEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`
}

function emptyHotspotsContent(): LessonImageHotspotsBlockContent {
  return {
    asset: {
      storage_path: "",
      signed_url: null,
      alt: "Imagem interativa da aula",
      width: 1600,
      height: 900,
    },
    hotspots: [],
  }
}

function blockLabel(block: LessonContentBlock) {
  if (block.type === "table") return "Tabela"
  if (block.type === "image-hotspots") return "Imagem Interativa"
  return "Texto Rico"
}

export function LessonContentBlocksEditor({
  value,
  onChange,
  className,
  placeholder = "Escreva aqui...",
  disabled = false,
}: LessonContentBlocksEditorProps) {
  const [blocks, setBlocks] = useState<LessonContentBlock[]>(() => splitLessonContent(value))
  const serializedBlocks = useMemo(() => JSON.stringify(blocks), [blocks])

  useEffect(() => {
    const nextBlocks = splitLessonContent(value)
    const nextSerialized = JSON.stringify(nextBlocks)
    if (nextSerialized !== serializedBlocks) {
      setBlocks(nextBlocks)
    }
  }, [serializedBlocks, value])

  const commitBlocks = (nextBlocks: LessonContentBlock[]) => {
    setBlocks(nextBlocks)
    onChange(mergeLessonContent(nextBlocks))
  }

  const updateBlock = (index: number, updater: (block: LessonContentBlock) => LessonContentBlock) => {
    commitBlocks(
      blocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
    )
  }

  const removeBlock = (index: number) => {
    const next = blocks.filter((_, blockIndex) => blockIndex !== index)
    commitBlocks(next.length > 0 ? next : [{ type: "rich-text", content: "" }])
  }

  const moveBlock = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const current = next[index]
    next[index] = next[target]
    next[target] = current
    commitBlocks(next)
  }

  const addBlock = (type: LessonContentBlock["type"]) => {
    if (type === "table") {
      commitBlocks([...blocks, { type: "table", content: "<table><tbody><tr><td></td></tr></tbody></table>" }])
      return
    }
    if (type === "image-hotspots") {
      commitBlocks([...blocks, { type: "image-hotspots", content: emptyHotspotsContent() }])
      return
    }
    commitBlocks([...blocks, { type: "rich-text", content: "" }])
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => addBlock("rich-text")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          <Type className="h-3.5 w-3.5" />
          Texto
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => addBlock("table")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          <Table2 className="h-3.5 w-3.5" />
          Tabela
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => addBlock("image-hotspots")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          <ImagePlus className="h-3.5 w-3.5" />
          Imagem Interativa
        </button>
      </div>

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <section key={`${block.type}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                {blockLabel(block)} #{index + 1}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => moveBlock(index, "up")}
                  title="Mover para cima"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === blocks.length - 1}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => moveBlock(index, "down")}
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  onClick={() => removeBlock(index)}
                  title="Remover bloco"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {block.type === "rich-text" ? (
              <RichTextEditor
                value={block.content}
                onChange={(next) =>
                  updateBlock(index, (current) =>
                    current.type === "rich-text" ? { ...current, content: next } : current,
                  )
                }
                placeholder={placeholder}
                minHeightClassName="min-h-[220px]"
                disabled={disabled}
              />
            ) : null}

            {block.type === "table" ? (
              <textarea
                value={block.content}
                onChange={(event) =>
                  updateBlock(index, (current) =>
                    current.type === "table" ? { ...current, content: event.target.value } : current,
                  )
                }
                rows={10}
                disabled={disabled}
                placeholder="<table><tbody><tr><td></td></tr></tbody></table>"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs outline-none transition focus:border-slate-400 focus:bg-white"
              />
            ) : null}

            {block.type === "image-hotspots" ? (
              <ImageHotspotsBlockEditor
                value={block.content}
                onChange={(content) =>
                  updateBlock(index, (current) =>
                    current.type === "image-hotspots" ? { ...current, content } : current,
                  )
                }
                disabled={disabled}
              />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}

function ImageHotspotsBlockEditor({
  value,
  onChange,
  disabled,
}: {
  value: LessonImageHotspotsBlockContent
  onChange: (value: LessonImageHotspotsBlockContent) => void
  disabled: boolean
}) {
  const normalized = normalizeLessonImageHotspotsBlockContent(value)

  const updateAsset = (field: keyof LessonImageHotspotsBlockContent["asset"], next: string | number | null) => {
    onChange(
      normalizeLessonImageHotspotsBlockContent({
        ...normalized,
        asset: { ...normalized.asset, [field]: next },
      }),
    )
  }

  const updateHotspot = (hotspotId: string, updater: (item: LessonImageHotspot) => LessonImageHotspot) => {
    onChange(
      normalizeLessonImageHotspotsBlockContent({
        ...normalized,
        hotspots: normalized.hotspots.map((hotspot) =>
          hotspot.id === hotspotId ? updater(hotspot) : hotspot,
        ),
      }),
    )
  }

  const addHotspot = () => {
    onChange(
      normalizeLessonImageHotspotsBlockContent({
        ...normalized,
        hotspots: [
          ...normalized.hotspots,
          { id: randomId(), x: 50, y: 50, title: `Hotspot ${normalized.hotspots.length + 1}`, body_html: "" },
        ],
      }),
    )
  }

  const removeHotspot = (hotspotId: string) => {
    onChange(
      normalizeLessonImageHotspotsBlockContent({
        ...normalized,
        hotspots: normalized.hotspots.filter((hotspot) => hotspot.id !== hotspotId),
      }),
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          disabled={disabled}
          value={normalized.asset.storage_path}
          onChange={(event) => updateAsset("storage_path", event.target.value)}
          placeholder="storage_path da imagem"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        />
        <input
          disabled={disabled}
          value={normalized.asset.signed_url ?? ""}
          onChange={(event) => updateAsset("signed_url", event.target.value)}
          placeholder="URL assinada (opcional)"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        />
        <input
          disabled={disabled}
          value={normalized.asset.alt}
          onChange={(event) => updateAsset("alt", event.target.value)}
          placeholder="Texto alternativo"
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            disabled={disabled}
            type="number"
            value={normalized.asset.width}
            onChange={(event) => updateAsset("width", Number(event.target.value || 0))}
            placeholder="Largura"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <input
            disabled={disabled}
            type="number"
            value={normalized.asset.height}
            onChange={(event) => updateAsset("height", Number(event.target.value || 0))}
            placeholder="Altura"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Hotspots</p>
        <button
          type="button"
          disabled={disabled}
          onClick={addHotspot}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo
        </button>
      </div>

      <div className="space-y-3">
        {normalized.hotspots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Sem hotspots ainda.
          </div>
        ) : (
          normalized.hotspots.map((hotspot) => (
            <div key={hotspot.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <input
                  disabled={disabled}
                  value={hotspot.title}
                  onChange={(event) =>
                    updateHotspot(hotspot.id, (current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Titulo do hotspot"
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeHotspot(hotspot.id)}
                  className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <input
                  disabled={disabled}
                  type="number"
                  min={0}
                  max={100}
                  value={hotspot.x}
                  onChange={(event) =>
                    updateHotspot(hotspot.id, (current) => ({ ...current, x: Number(event.target.value || 0) }))
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
                <input
                  disabled={disabled}
                  type="number"
                  min={0}
                  max={100}
                  value={hotspot.y}
                  onChange={(event) =>
                    updateHotspot(hotspot.id, (current) => ({ ...current, y: Number(event.target.value || 0) }))
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>
              <RichTextEditor
                value={hotspot.body_html}
                onChange={(next) => updateHotspot(hotspot.id, (current) => ({ ...current, body_html: next }))}
                placeholder="Conteudo HTML do hotspot"
                minHeightClassName="min-h-[140px]"
                disabled={disabled}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}


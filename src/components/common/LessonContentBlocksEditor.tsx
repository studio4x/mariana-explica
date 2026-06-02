import { ImagePlus, Plus, Trash2 } from "lucide-react"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
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
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor"

interface LessonContentBlocksEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export interface LessonContentBlocksEditorHandle {
  flush: () => string
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

export const LessonContentBlocksEditor = forwardRef<LessonContentBlocksEditorHandle, LessonContentBlocksEditorProps>(function LessonContentBlocksEditor({
  value,
  onChange,
  className,
  placeholder = "Escreva aqui...",
  disabled = false,
}: LessonContentBlocksEditorProps, ref) {
  const [blocks, setBlocks] = useState<LessonContentBlock[]>(() => splitLessonContent(value))
  const blocksRef = useRef<LessonContentBlock[]>(splitLessonContent(value))
  const editorRefs = useRef<Record<string, RichTextEditorHandle | null>>({})
  const lastCommittedValueRef = useRef(value ?? "")

  useEffect(() => {
    const nextValue = value ?? ""
    if (nextValue === lastCommittedValueRef.current) return
    const nextBlocks = splitLessonContent(nextValue)
    blocksRef.current = nextBlocks
    setBlocks(nextBlocks)
    lastCommittedValueRef.current = nextValue
  }, [value])

  const commitBlocks = (nextBlocks: LessonContentBlock[]) => {
    const nextValue = mergeLessonContent(nextBlocks)
    blocksRef.current = nextBlocks
    setBlocks(nextBlocks)
    lastCommittedValueRef.current = nextValue
    onChange(nextValue)
  }

  const updateBlock = (index: number, updater: (block: LessonContentBlock) => LessonContentBlock) => {
    const currentBlocks = blocksRef.current
    commitBlocks(
      currentBlocks.map((block, blockIndex) => (blockIndex === index ? updater(block) : block)),
    )
  }

  const removeBlock = (index: number) => {
    const next = blocksRef.current.filter((_, blockIndex) => blockIndex !== index)
    commitBlocks(next.length > 0 ? next : [{ type: "rich-text", content: "" }])
  }

  const buildBlock = (type: LessonContentBlock["type"]): LessonContentBlock => {
    if (type === "table") {
      return { type: "table", content: "<table><tbody><tr><td></td></tr></tbody></table>" }
    }
    if (type === "image-hotspots") {
      return { type: "image-hotspots", content: emptyHotspotsContent() }
    }
    return { type: "rich-text", content: "" }
  }

  const addBlockAfter = (index: number, type: LessonContentBlock["type"]) => {
    const next = [...blocksRef.current]
    next.splice(index + 1, 0, buildBlock(type))
    commitBlocks(next)
  }

  useImperativeHandle(
    ref,
    () => ({
      flush: () => {
        for (const editor of Object.values(editorRefs.current)) {
          editor?.flush()
        }
        const nextValue = mergeLessonContent(blocksRef.current)
        if (nextValue !== lastCommittedValueRef.current) {
          lastCommittedValueRef.current = nextValue
          onChange(nextValue)
        }
        return nextValue
      },
    }),
    [onChange],
  )

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <section key={`${block.type}-${index}`} className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-blue-100 px-1.5 text-[10px] text-blue-700">
                  {index + 1}
                </span>
                Bloco de {blockLabel(block)}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  onClick={() => addBlockAfter(index, "rich-text")}
                  title="Adicionar bloco de texto"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  onClick={() => addBlockAfter(index, "table")}
                  title="Adicionar bloco de tabela"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  onClick={() => addBlockAfter(index, "image-hotspots")}
                  title="Adicionar bloco de imagem interativa"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  onClick={() => removeBlock(index)}
                  title="Remover bloco"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {block.type === "rich-text" ? (
              <RichTextEditor
                ref={(instance) => {
                  editorRefs.current[`block-${index}`] = instance
                }}
                value={block.content}
                onChange={(next) =>
                  updateBlock(index, (current) =>
                    current.type === "rich-text" ? { ...current, content: next } : current,
                  )
                }
                placeholder={placeholder}
                minHeightPx={220}
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
                registerEditorRef={(editorKey, instance) => {
                  editorRefs.current[`block-${index}-${editorKey}`] = instance
                }}
                disabled={disabled}
              />
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
})

function ImageHotspotsBlockEditor({
  value,
  onChange,
  registerEditorRef,
  disabled,
}: {
  value: LessonImageHotspotsBlockContent
  onChange: (value: LessonImageHotspotsBlockContent) => void
  registerEditorRef: (editorKey: string, instance: RichTextEditorHandle | null) => void
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
                  placeholder="Título do hotspot"
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
                ref={(instance) => {
                  registerEditorRef(`hotspot-${hotspot.id}`, instance)
                }}
                value={hotspot.body_html}
                onChange={(next) => updateHotspot(hotspot.id, (current) => ({ ...current, body_html: next }))}
                placeholder="Conteúdo HTML do hotspot"
                minHeightPx={140}
                toolbarVariant="compact"
                disabled={disabled}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

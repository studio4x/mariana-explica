import { ImagePlus, Table2, Trash2, Type, Upload, Video } from "lucide-react"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type ComponentType } from "react"
import {
  useDeleteAdminLessonStorageObject,
  useUploadAdminModuleAssetFile,
  useUploadAdminProductCover,
} from "@/hooks/useAdmin"
import { supabase } from "@/integrations/supabase"
import { cn } from "@/lib/cn"
import type { LessonContentBlock, LessonImageBlockContent, LessonVideoBlockContent } from "@/lib/lesson-content-blocks"
import {
  mergeLessonContent,
  normalizeLessonImageBlockContent,
  normalizeLessonVideoBlockContent,
  splitLessonContent,
} from "@/lib/lesson-content-blocks"
import {
  LESSON_PRIVATE_MEDIA_BUCKET,
  LESSON_PUBLIC_IMAGE_BUCKET,
  isRenderableLessonMediaUrl,
} from "@/lib/lesson-media"
import { getExternalVideoUrl, getYoutubeEmbedUrl } from "@/lib/lesson-video"
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor"

interface LessonContentBlocksEditorProps {
  value: string
  onChange: (value: string) => void
  moduleId: string
  productId?: string | null
  className?: string
  placeholder?: string
  disabled?: boolean
  allowBlockInsertion?: boolean
}

export interface LessonContentBlocksEditorHandle {
  flush: () => string
}

type InsertBlockType = LessonContentBlock["type"]

type InsertAction = {
  type: InsertBlockType
  label: string
  description: string
  Icon: ComponentType<{ className?: string }>
  toneClassName: string
  iconToneClassName: string
}

const INSERT_ACTIONS: InsertAction[] = [
  {
    type: "rich-text",
    label: "Texto",
    description: "Explicação, contexto ou conclusão.",
    Icon: Type,
    toneClassName: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
    iconToneClassName: "bg-sky-100 text-sky-700",
  },
  {
    type: "table",
    label: "Tabela",
    description: "Comparações, listas e dados.",
    Icon: Table2,
    toneClassName: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
    iconToneClassName: "bg-amber-100 text-amber-700",
  },
  {
    type: "image",
    label: "Imagem",
    description: "Foto, esquema ou captura.",
    Icon: ImagePlus,
    toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
    iconToneClassName: "bg-emerald-100 text-emerald-700",
  },
  {
    type: "video",
    label: "Vídeo",
    description: "YouTube, Vimeo ou ficheiro.",
    Icon: Video,
    toneClassName: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100",
    iconToneClassName: "bg-violet-100 text-violet-700",
  },
]

function emptyImageContent(): LessonImageBlockContent {
  return {
    storage_bucket: null,
    storage_path: "",
    public_url: null,
    alt: "Imagem da aula",
    caption: "",
    link_url: null,
    width_percent: 100,
  }
}

function emptyVideoContent(): LessonVideoBlockContent {
  return {
    storage_bucket: null,
    storage_path: "",
    public_url: null,
    title: "Vídeo da aula",
  }
}

function blockLabel(block: LessonContentBlock) {
  if (block.type === "table") return "Tabela"
  if (block.type === "image") return "Imagem"
  if (block.type === "video") return "Vídeo"
  return "Texto"
}

async function resolveLessonStorageUrl(bucket: string | null | undefined, path: string) {
  const trimmedBucket = bucket?.trim() || LESSON_PRIVATE_MEDIA_BUCKET
  const trimmedPath = path.trim()

  if (!trimmedPath) {
    return null
  }

  if (trimmedBucket === LESSON_PUBLIC_IMAGE_BUCKET) {
    return supabase.storage.from(trimmedBucket).getPublicUrl(trimmedPath).data.publicUrl
  }

  const { data } = await supabase.storage.from(trimmedBucket).createSignedUrl(trimmedPath, 300)
  return data?.signedUrl ?? null
}

export const LessonContentBlocksEditor = forwardRef<LessonContentBlocksEditorHandle, LessonContentBlocksEditorProps>(function LessonContentBlocksEditor({
  value,
  onChange,
  moduleId,
  productId,
  className,
  placeholder = "Escreva aqui...",
  disabled = false,
  allowBlockInsertion = true,
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
    if (type === "image") {
      return { type: "image", content: emptyImageContent() }
    }
    if (type === "video") {
      return { type: "video", content: emptyVideoContent() }
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

            {block.type === "image" ? (
              <ImageBlockEditor
                moduleId={moduleId}
                productId={productId}
                value={block.content}
                onChange={(content) =>
                  updateBlock(index, (current) => (current.type === "image" ? { ...current, content } : current))
                }
                disabled={disabled}
              />
            ) : null}

            {block.type === "video" ? (
              <VideoBlockEditor
                moduleId={moduleId}
                value={block.content}
                onChange={(content) =>
                  updateBlock(index, (current) => (current.type === "video" ? { ...current, content } : current))
                }
                disabled={disabled}
              />
            ) : null}

            {allowBlockInsertion ? (
              <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Inserir bloco abaixo</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {INSERT_ACTIONS.map((action) => {
                    const Icon = action.Icon
                    return (
                      <button
                        key={`${index}-${action.type}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => addBlockAfter(index, action.type)}
                        className={cn(
                          "group flex items-start gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition",
                          action.toneClassName,
                          "disabled:opacity-50",
                        )}
                      >
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", action.iconToneClassName)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{action.label}</span>
                          <span className="mt-1 block text-xs leading-5 opacity-80">{action.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
})

function ImageBlockEditor({
  moduleId,
  productId,
  value,
  onChange,
  disabled,
}: {
  moduleId: string
  productId?: string | null
  value: LessonImageBlockContent
  onChange: (value: LessonImageBlockContent) => void
  disabled: boolean
}) {
  const uploadPublicImage = useUploadAdminProductCover()
  const deleteLessonStorageObject = useDeleteAdminLessonStorageObject()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null)
  const [resolvingPreviewUrl, setResolvingPreviewUrl] = useState(false)
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null)
  const normalized = normalizeLessonImageBlockContent(value)
  const imageUrl = localPreviewUrl || resolvedPreviewUrl
  const pendingUpload = uploadPublicImage.isPending || deleteLessonStorageObject.isPending || disabled

  useEffect(() => {
    return () => {
      if (localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

  useEffect(() => {
    const directSource = normalized.public_url?.trim() || normalized.storage_path.trim()
    if (!directSource) {
      setResolvedPreviewUrl(null)
      setResolvingPreviewUrl(false)
      return
    }

    if (isRenderableLessonMediaUrl(directSource)) {
      setResolvedPreviewUrl(directSource)
      setResolvingPreviewUrl(false)
      return
    }

    let active = true
    setResolvingPreviewUrl(true)
    setResolvedPreviewUrl(null)

    void resolveLessonStorageUrl(normalized.storage_bucket, directSource)
      .then((url) => {
        if (!active) return
        setResolvedPreviewUrl(url)
        setResolvingPreviewUrl(false)
      })
      .catch(() => {
        if (!active) return
        setResolvedPreviewUrl(null)
        setResolvingPreviewUrl(false)
      })

    return () => {
      active = false
    }
  }, [normalized.public_url, normalized.storage_bucket, normalized.storage_path])

  const updateAlt = (alt: string) => {
    onChange(
      normalizeLessonImageBlockContent({
        ...normalized,
        alt,
      }),
    )
  }

  const updateCaption = (caption: string) => {
    onChange(
      normalizeLessonImageBlockContent({
        ...normalized,
        caption,
      }),
    )
  }

  const updateLink = (link_url: string) => {
    onChange(
      normalizeLessonImageBlockContent({
        ...normalized,
        link_url: link_url.trim() || null,
      }),
    )
  }

  const updateWidthPercent = (width_percent: number) => {
    onChange(
      normalizeLessonImageBlockContent({
        ...normalized,
        width_percent,
      }),
    )
  }

  const uploadSelectedImage = async (file: File) => {
    const trimmedProductId = productId?.trim()
    const trimmedModuleId = moduleId.trim()

    if (!trimmedProductId) {
      throw new Error("Não foi possível identificar o material para este upload.")
    }

    if (!trimmedModuleId) {
      throw new Error("Não foi possível identificar o módulo para este upload.")
    }

    setStatus({
      tone: "info",
      message: `A enviar e guardar "${file.name}" automaticamente...`,
    })

    const upload = await uploadPublicImage.mutateAsync({
      productId: trimmedProductId,
      file,
      replacePath: normalized.storage_path || null,
    })

    if (localPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl)
    }

    onChange(
      normalizeLessonImageBlockContent({
        storage_bucket: upload.bucket,
        storage_path: upload.path,
        public_url: upload.public_url ?? null,
        alt: normalized.alt || file.name.replace(/\.[^.]+$/, ""),
        caption: normalized.caption,
        link_url: normalized.link_url,
        width_percent: normalized.width_percent,
      }),
    )
    setResolvedPreviewUrl(upload.public_url ?? null)
    setStatus({
      tone: "success",
      message: "Imagem enviada e guardada automaticamente.",
    })
  }

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setStatus({
        tone: "error",
        message: "Seleciona um ficheiro de imagem válido.",
      })
      event.target.value = ""
      return
    }

    setSelectedFile(file)
    setLocalPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
    setStatus({
      tone: "info",
      message: `Imagem selecionada: ${file.name}. A guardar automaticamente agora...`,
    })
    event.target.value = ""

    void uploadSelectedImage(file)
      .then(() => {
        setSelectedFile(null)
        setLocalPreviewUrl(null)
      })
      .catch((uploadError) => {
        setStatus({
          tone: "error",
          message: uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.",
        })
      })
  }

  const handleDeleteImage = async () => {
    const currentBucket =
      normalized.storage_bucket?.trim() ||
      (normalized.public_url?.trim() ? LESSON_PUBLIC_IMAGE_BUCKET : LESSON_PRIVATE_MEDIA_BUCKET)
    const currentPath = normalized.storage_path.trim()
    const trimmedProductId = productId?.trim() || null
    const trimmedModuleId = moduleId.trim() || null

    if (!currentPath) {
      setStatus({
        tone: "error",
        message: "Não existe nenhuma imagem para excluir.",
      })
      return
    }

    const confirmed = window.confirm("Queres excluir esta imagem e remover o ficheiro do storage?")
    if (!confirmed) return

    setStatus({
      tone: "info",
      message: "A excluir a imagem guardada...",
    })

    try {
      await deleteLessonStorageObject.mutateAsync({
        productId: trimmedProductId,
        moduleId: trimmedModuleId,
        mediaBucket: currentBucket,
        mediaPath: currentPath,
      })

      if (localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl)
      }

      setSelectedFile(null)
      setLocalPreviewUrl(null)
      setResolvedPreviewUrl(null)
      onChange(
        normalizeLessonImageBlockContent({
          storage_bucket: null,
          storage_path: "",
          public_url: null,
          alt: "Imagem da aula",
          caption: "",
          link_url: null,
          width_percent: 100,
        }),
      )
      setStatus({
        tone: "success",
        message: "Imagem excluída com sucesso.",
      })
    } catch (deleteError) {
      setStatus({
        tone: "error",
        message: deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a imagem.",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {imageUrl ? (
          <figure className="flex flex-col gap-3 p-4">
            <div className="flex justify-center">
              <div className="w-full max-w-full" style={{ width: `${normalized.width_percent}%` }}>
                {normalized.link_url?.trim() ? (
                  <a href={normalized.link_url.trim()} target="_blank" rel="noopener noreferrer">
                    <img
                      src={imageUrl}
                      alt={normalized.alt}
                      className="block w-full rounded-xl object-contain"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <img
                    src={imageUrl}
                    alt={normalized.alt}
                    className="block w-full rounded-xl object-contain"
                    loading="lazy"
                  />
                )}
              </div>
            </div>
            {normalized.caption.trim() ? (
              <figcaption className="text-sm leading-6 text-slate-600">{normalized.caption}</figcaption>
            ) : null}
          </figure>
        ) : (
          <div className="flex min-h-48 items-center justify-center px-6 py-10 text-center text-sm text-slate-500">
            {resolvingPreviewUrl ? "A carregar pré-visualização da imagem..." : "Nenhuma imagem enviada ainda."}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500">Texto alternativo</label>
          <input
            disabled={disabled}
            value={normalized.alt}
            onChange={(event) => updateAlt(event.target.value)}
            placeholder="Texto alternativo da imagem"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block w-full text-xs font-black uppercase tracking-[0.2em] text-slate-500 lg:hidden">Tamanho</label>
          <select
            disabled={disabled}
            value={String(normalized.width_percent)}
            onChange={(event) => updateWidthPercent(Number(event.target.value))}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white lg:w-40"
          >
            <option value="100">100% largura</option>
            <option value="85">85% largura</option>
            <option value="70">70% largura</option>
            <option value="55">55% largura</option>
            <option value="40">40% largura</option>
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            disabled={pendingUpload}
            onChange={handleSelectFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={pendingUpload}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Selecionar imagem
          </button>
          <button
            type="button"
            disabled={pendingUpload || !normalized.storage_path.trim()}
            onClick={() => void handleDeleteImage()}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
          >
            Excluir imagem
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500">Legenda</label>
          <input
            disabled={disabled}
            value={normalized.caption}
            onChange={(event) => updateCaption(event.target.value)}
            placeholder="Legenda opcional da imagem"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500">Link da imagem</label>
          <input
            disabled={disabled}
            value={normalized.link_url ?? ""}
            onChange={(event) => updateLink(event.target.value)}
            placeholder="https://..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>
      </div>

      {selectedFile ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span className="font-bold">Selecionada:</span> {selectedFile.name}. A imagem está a ser enviada e salva automaticamente.
        </div>
      ) : null}

      {status ? (
        <p
          className={[
            "text-sm",
            status.tone === "success"
              ? "text-emerald-700"
              : status.tone === "error"
                ? "text-rose-700"
                : "text-slate-600",
          ].join(" ")}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  )
}

function VideoBlockEditor({
  moduleId,
  value,
  onChange,
  disabled,
}: {
  moduleId: string
  value: LessonVideoBlockContent
  onChange: (value: LessonVideoBlockContent) => void
  disabled: boolean
}) {
  const uploadVideo = useUploadAdminModuleAssetFile()
  const deleteLessonStorageObject = useDeleteAdminLessonStorageObject()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null)
  const normalized = normalizeLessonVideoBlockContent(value)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  const [resolvingVideoUrl, setResolvingVideoUrl] = useState(false)
  const directSource = normalized.public_url?.trim() || normalized.storage_path.trim()
  const videoUrl = localPreviewUrl || (isRenderableLessonMediaUrl(directSource) ? directSource : resolvedVideoUrl)
  const embedUrl = getYoutubeEmbedUrl(videoUrl)
  const externalVideoUrl = getExternalVideoUrl(videoUrl)
  const pendingUpload = uploadVideo.isPending || deleteLessonStorageObject.isPending || disabled

  useEffect(() => {
    return () => {
      if (localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

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

  const updateTitle = (title: string) => {
    onChange(
      normalizeLessonVideoBlockContent({
        ...normalized,
        title,
      }),
    )
  }

  const updateSourceUrl = (sourceUrl: string) => {
    onChange(
      normalizeLessonVideoBlockContent({
        ...normalized,
        storage_path: sourceUrl,
        storage_bucket: sourceUrl.startsWith("http") ? null : normalized.storage_bucket,
        public_url: sourceUrl.startsWith("http") ? sourceUrl : null,
      }),
    )
  }

  const uploadSelectedVideo = async (file: File) => {
    const trimmedModuleId = moduleId.trim()
    if (!trimmedModuleId) {
      throw new Error("Não foi possível identificar o módulo para este upload.")
    }

    setStatus({
      tone: "info",
      message: `A enviar e guardar "${file.name}" automaticamente...`,
    })

    const upload = await uploadVideo.mutateAsync({
      moduleId: trimmedModuleId,
      file,
      replacePath: normalized.storage_path || null,
    })

    onChange(
      normalizeLessonVideoBlockContent({
        storage_bucket: upload.bucket,
        storage_path: upload.path,
        public_url: upload.public_url ?? null,
        title: normalized.title || file.name.replace(/\.[^.]+$/, ""),
      }),
    )
    setResolvedVideoUrl(upload.public_url ?? null)
    setStatus({
      tone: "success",
      message: "Vídeo enviado e guardado automaticamente.",
    })
  }

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    if (!file.type.startsWith("video/")) {
      setStatus({
        tone: "error",
        message: "Seleciona um ficheiro de vídeo válido.",
      })
      event.target.value = ""
      return
    }

    setSelectedFile(file)
    setLocalPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
    setStatus({
      tone: "info",
      message: `Vídeo selecionado: ${file.name}. A guardar automaticamente agora...`,
    })
    event.target.value = ""
    void uploadSelectedVideo(file)
      .then(() => {
        setSelectedFile(null)
        setLocalPreviewUrl(null)
      })
      .catch((uploadError) => {
        setStatus({
          tone: "error",
          message: uploadError instanceof Error ? uploadError.message : "Não foi possível enviar o vídeo.",
        })
      })
  }

  const handleDeleteVideo = async () => {
    const currentPath = normalized.storage_path.trim()
    const currentBucket = normalized.storage_bucket?.trim() || null
    const hasExternalUrl = Boolean(normalized.public_url?.trim() && isRenderableLessonMediaUrl(normalized.public_url.trim()))

    if (!currentPath && !hasExternalUrl) {
      setStatus({
        tone: "error",
        message: "Não existe nenhum vídeo para excluir.",
      })
      return
    }

    const confirmed = window.confirm("Queres excluir este vídeo?")
    if (!confirmed) return

    setStatus({
      tone: "info",
      message: "A excluir o vídeo guardado...",
    })

    try {
      if (currentPath && currentBucket) {
        await deleteLessonStorageObject.mutateAsync({
          productId: null,
          moduleId,
          mediaBucket: currentBucket,
          mediaPath: currentPath,
        })
      }

      if (localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl)
      }

      setSelectedFile(null)
      setLocalPreviewUrl(null)
      setResolvedVideoUrl(null)
      onChange(
        normalizeLessonVideoBlockContent({
          storage_bucket: null,
          storage_path: "",
          public_url: null,
          title: "Vídeo da aula",
        }),
      )
      setStatus({
        tone: "success",
        message: "Vídeo excluído com sucesso.",
      })
    } catch (deleteError) {
      setStatus({
        tone: "error",
        message: deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o vídeo.",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        {videoUrl ? (
          embedUrl ? (
            <div className="aspect-video">
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
              className="block aspect-video w-full bg-black object-contain"
            />
          ) : (
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="block aspect-video w-full bg-black object-contain"
            />
          )
        ) : (
          <div className="flex min-h-48 items-center justify-center px-6 py-10 text-center text-sm text-slate-300">
            {resolvingVideoUrl ? "A carregar pré-visualização do vídeo..." : "Nenhum vídeo enviado ainda."}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500">Título do vídeo</label>
          <input
            disabled={disabled}
            value={normalized.title}
            onChange={(event) => updateTitle(event.target.value)}
            placeholder="Título do vídeo"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500">URL do vídeo ou ficheiro</label>
          <input
            disabled={disabled}
            value={videoUrl ?? ""}
            onChange={(event) => updateSourceUrl(event.target.value)}
            placeholder="Cole a URL do YouTube, Vimeo ou do ficheiro"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            disabled={pendingUpload}
            onChange={handleSelectFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={pendingUpload}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Selecionar vídeo
          </button>
          <button
            type="button"
            disabled={pendingUpload || (!normalized.storage_path.trim() && !normalized.public_url?.trim())}
            onClick={() => void handleDeleteVideo()}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
          >
            Excluir vídeo
          </button>
        </div>
      </div>

      {selectedFile ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <span className="font-bold">Selecionado:</span> {selectedFile.name}. O vídeo está a ser enviado e salvo automaticamente.
        </div>
      ) : null}

      {status ? (
        <p
          className={[
            "text-sm",
            status.tone === "success"
              ? "text-emerald-700"
              : status.tone === "error"
                ? "text-rose-700"
                : "text-slate-600",
          ].join(" ")}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  )
}

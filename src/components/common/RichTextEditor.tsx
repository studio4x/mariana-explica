import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Underline,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/lib/rich-text"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  editorClassName?: string
  minHeightClassName?: string
  disabled?: boolean
}

type Command =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "formatBlock"
  | "removeFormat"
  | "createLink"

function runCommand(command: Command, value?: string) {
  document.execCommand(command, false, value)
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui...",
  className,
  editorClassName,
  minHeightClassName = "min-h-[220px]",
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const sanitizedValue = useMemo(() => sanitizeRichTextHtml(value), [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.innerHTML === sanitizedValue) return
    if (isFocused) return
    editor.innerHTML = sanitizedValue
  }, [isFocused, sanitizedValue])

  const emitChange = () => {
    const editor = editorRef.current
    if (!editor) return
    const nextValue = sanitizeRichTextHtml(editor.innerHTML)
    if (nextValue !== value) {
      onChange(nextValue)
    }
  }

  const applyCommand = (command: Command, commandValue?: string) => {
    if (disabled) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    runCommand(command, commandValue)
    emitChange()
  }

  const handleLink = () => {
    const href = window.prompt("Cole a URL do link")
    if (!href) return
    applyCommand("createLink", href)
  }

  const toolButtonClassName =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700"

  return (
    <div className={cn("rounded-[1.25rem] border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-3">
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("bold")} disabled={disabled} title="Negrito">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("italic")} disabled={disabled} title="Italico">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("underline")} disabled={disabled} title="Sublinhado">
          <Underline className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("insertUnorderedList")} disabled={disabled} title="Lista">
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("insertOrderedList")} disabled={disabled} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("formatBlock", "blockquote")} disabled={disabled} title="Citacao">
          <Quote className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={handleLink} disabled={disabled} title="Link">
          <Link2 className="h-4 w-4" />
        </button>
        <button type="button" className={toolButtonClassName} onClick={() => applyCommand("removeFormat")} disabled={disabled} title="Limpar formatacao">
          <RemoveFormatting className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        {!isFocused && isRichTextEmpty(sanitizedValue) ? (
          <span className="pointer-events-none absolute left-4 top-4 text-sm text-slate-400">{placeholder}</span>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className={cn(
            "rich-text-editor px-4 py-4 text-sm text-slate-900 outline-none",
            minHeightClassName,
            disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
            editorClassName,
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            emitChange()
          }}
          onInput={emitChange}
        />
      </div>
    </div>
  )
}

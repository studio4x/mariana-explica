import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/cn"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeightPx?: number
  toolbarVariant?: "lesson" | "compact"
  disabled?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui...",
  className,
  minHeightPx = 220,
  toolbarVariant = "lesson",
  disabled = false,
}: RichTextEditorProps) {
  const [editorKey, setEditorKey] = useState(0)
  const [initialValue, setInitialValue] = useState(value ?? "")
  const currentValueRef = useRef(value ?? "")
  const lastExternalValueRef = useRef(value ?? "")

  useEffect(() => {
    const nextValue = value ?? ""
    if (nextValue === lastExternalValueRef.current) return
    lastExternalValueRef.current = nextValue
    currentValueRef.current = nextValue
    setInitialValue(nextValue)
    setEditorKey((current) => current + 1)
  }, [value])

  const modules = useMemo(
    () => ({
      toolbar:
        toolbarVariant === "compact"
          ? [
              ["bold", "italic", "underline"],
              [{ list: "ordered" }, { list: "bullet" }],
              ["link", "blockquote"],
              ["clean"],
            ]
          : [
              [{ header: [1, 2, 3, false] }],
              ["bold", "italic", "underline", "strike"],
              [{ list: "ordered" }, { list: "bullet" }],
              ["link", "blockquote", "code-block"],
              ["clean"],
            ],
    }),
    [toolbarVariant],
  )

  const formats = useMemo(
    () =>
      toolbarVariant === "compact"
        ? ["bold", "italic", "underline", "list", "bullet", "link", "blockquote"]
        : [
            "header",
            "bold",
            "italic",
            "underline",
            "strike",
            "list",
            "bullet",
            "link",
            "blockquote",
            "code-block",
          ],
    [toolbarVariant],
  )

  const commitValue = (nextValue: string) => {
    if (nextValue === lastExternalValueRef.current) return
    lastExternalValueRef.current = nextValue
    onChange(nextValue)
  }

  return (
    <div className={cn("rich-text-editor-quill rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <ReactQuill
        key={`${toolbarVariant}-${editorKey}`}
        theme="snow"
        defaultValue={initialValue}
        onChange={(nextValue) => {
          currentValueRef.current = nextValue
        }}
        onBlur={(_previousRange, _source, editor) => {
          const html = editor.getHTML()
          currentValueRef.current = html
          commitValue(html)
        }}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
        style={{ minHeight: minHeightPx + 54 }}
      />
    </div>
  )
}

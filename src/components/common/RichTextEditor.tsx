import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"
import { useMemo } from "react"
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

  return (
    <div className={cn("rich-text-editor-quill rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <ReactQuill
        theme="snow"
        value={value ?? ""}
        onChange={(nextValue) => onChange(nextValue)}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
        style={{ minHeight: minHeightPx + 54 }}
      />
    </div>
  )
}

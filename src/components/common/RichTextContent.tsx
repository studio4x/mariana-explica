import { cn } from "@/lib/cn"
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/lib/rich-text"

interface RichTextContentProps {
  value: string | null | undefined
  className?: string
  fallback?: string | null
}

export function RichTextContent({ value, className, fallback = null }: RichTextContentProps) {
  if (isRichTextEmpty(value)) {
    return fallback ? <p className={className}>{fallback}</p> : null
  }

  return (
    <div
      className={cn("rich-text-content", className)}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(value) }}
    />
  )
}

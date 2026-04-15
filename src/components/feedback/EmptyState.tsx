import { FileX } from "lucide-react"

interface EmptyStateProps {
  title?: string
  message: string
  icon?: React.ReactNode
}

export function EmptyState({
  title = "Nenhum resultado encontrado",
  message,
  icon = <FileX className="h-12 w-12 text-muted-foreground" />
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      {icon}
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  )
}
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui"

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  icon?: React.ReactNode
}

export function ErrorState({
  title = "Erro",
  message,
  onRetry,
  icon = <AlertTriangle className="h-12 w-12 text-destructive" />
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      {icon}
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
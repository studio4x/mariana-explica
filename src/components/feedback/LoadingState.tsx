import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingState({
  message = "Carregando...",
  size = "md"
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8">
      <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
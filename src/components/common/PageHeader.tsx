import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui"

interface PageHeaderProps {
  title: string
  description?: string
  backTo?: string
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  backTo,
  actions
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between space-y-2">
      <div className="space-y-1">
        {backTo && (
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <a href={backTo}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </a>
          </Button>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center space-x-2">{actions}</div>}
    </div>
  )
}
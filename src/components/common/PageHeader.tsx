import { ChevronLeft } from "lucide-react"
import { Link } from "react-router-dom"
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
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        {backTo && (
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to={backTo}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

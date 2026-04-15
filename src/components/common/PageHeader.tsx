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
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        {backTo ? (
          <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2 w-fit rounded-full">
            <Link to={backTo}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        ) : null}
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

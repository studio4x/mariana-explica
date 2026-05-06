import { Link } from "react-router-dom"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { AdminFaqManagementPanel } from "./AdminFaqManagementPanel"

export function AdminFaq() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Perguntas frequentes"
          description="Gerencia perguntas publicas e categorias usadas nos filtros de FAQ."
        />
        <Button asChild type="button" variant="outline" className="rounded-full">
          <Link to={ROUTES.ADMIN_SUPPORT}>Ver tickets</Link>
        </Button>
      </div>

      <AdminFaqManagementPanel />
    </div>
  )
}

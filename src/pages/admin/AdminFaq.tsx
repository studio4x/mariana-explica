import { Link } from "react-router-dom"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { AdminFaqManagementPanel } from "./AdminFaqManagementPanel"

export function AdminFaq() {
  return (
    <div className="space-y-6 p-1 md:p-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Base de Conhecimento"
          description="Gerencie FAQs e categorias de dúvidas consumidas nas páginas públicas."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild type="button" variant="outline" className="rounded-lg">
            <Link to={ROUTES.ADMIN_SUPPORT}>Ver tickets</Link>
          </Button>
        </div>
      </div>

      <AdminFaqManagementPanel />
    </div>
  )
}

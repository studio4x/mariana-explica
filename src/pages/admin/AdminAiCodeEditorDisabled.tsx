import { AlertTriangle, Lock } from "lucide-react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"

export function AdminAiCodeEditorDisabled() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor desativado"
        description="Os editores novos foram desativados nesta build. O fluxo oficial voltou para o editor visual legado."
        backTo={ROUTES.ADMIN}
      />

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Fluxo novo desativado</h2>
            <p className="text-sm leading-6 text-slate-600">
              Os editores com IA e o editor visual novo deixaram de ser o caminho operacional. O editor visual legado
              voltou a ser o ponto principal de edi&ccedil;&atilde;o da plataforma.
            </p>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Fluxo oficial ativo
              </div>
              <p className="mt-1">
                Para edi&ccedil;&atilde;o de p&aacute;ginas, use o editor visual legado. Para opera&ccedil;&otilde;es
                administrativas, use os restantes pain&eacute;is do admin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to={ROUTES.ADMIN_PAGE_EDITOR}>Abrir editor legado</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to={ROUTES.ADMIN}>Voltar ao painel</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

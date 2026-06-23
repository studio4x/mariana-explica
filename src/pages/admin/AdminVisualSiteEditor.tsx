import { Link, Navigate, useParams } from "react-router-dom"
import { ExternalLink, Eye, Sparkles } from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import {
  VisualEditorInspectorPanel,
  VisualEditorProvider,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  VISUAL_EDITOR_PAGE_DEFINITIONS,
  getVisualEditorPageDefinition,
} from "@/features/site-editor/visual-editor/page-definitions"
import { MaterialsPageContent } from "@/pages/public/MaterialsPageContent"
import { SupportPageContent } from "@/pages/public/Support"

function getAdminVisualEditorPath(pageKey: string) {
  return pageKey === "support" ? ROUTES.ADMIN_VISUAL_EDITOR : `${ROUTES.ADMIN_VISUAL_EDITOR}/${pageKey}`
}

function VisualEditorWorkspace() {
  const { pageDefinition, pageDetail, isDirty, canEdit } = useVisualEditorPage()
  const previewPage = pageDefinition?.pageKey === "materials" ? <MaterialsPageContent /> : <SupportPageContent />
  const publicPagePath = pageDefinition?.publicPath ?? ROUTES.SUPPORT

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor Visual"
        description="Ajuste o conteudo da pagina publica em modo visual, com preview e historico de versoes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="h-10 rounded-full">
              <a href={publicPagePath} target="_blank" rel="noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                Abrir pagina publica
              </a>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-full">
              <a href={ROUTES.HOME} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Site publico
              </a>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {VISUAL_EDITOR_PAGE_DEFINITIONS.map((definition) => {
          const isActive = definition.pageKey === pageDefinition?.pageKey

          return (
            <Button
              key={definition.pageKey}
              asChild
              variant={isActive ? "default" : "outline"}
              className="h-10 rounded-full"
            >
              <Link to={getAdminVisualEditorPath(definition.pageKey)}>{definition.title}</Link>
            </Button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={canEdit ? "Edicao ativa" : "Somente leitura"} tone={canEdit ? "info" : "neutral"} />
        <StatusBadge label={isDirty ? "Alteracoes pendentes" : "Sincronizado"} tone={isDirty ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Pagina piloto</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{pageDefinition?.title ?? "Suporte"}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{pageDefinition?.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={pageDetail?.publishedVersion ? `Publicada v${pageDetail.publishedVersion.version_number}` : "Sem versao publicada"}
                  tone="success"
                />
                <StatusBadge
                  label={pageDetail?.latestDraft ? `Rascunho v${pageDetail.latestDraft.version_number}` : "Sem rascunho"}
                  tone="warning"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            {previewPage}
          </div>
        </div>

        <div className="space-y-4">
          <VisualEditorInspectorPanel className="sticky top-6" />

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-950">Como usar</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Clique num titulo, texto, botao, link ou imagem. O painel lateral permite editar o valor, guardar o
                  rascunho, publicar ou restaurar uma versao antiga.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminVisualSiteEditor() {
  const params = useParams<{ pageKey?: string }>()
  const normalizedPageKey = (params.pageKey ?? "support").trim().toLowerCase()
  const pageDefinition = getVisualEditorPageDefinition(normalizedPageKey)

  if (!pageDefinition) {
    return <Navigate to={ROUTES.ADMIN_VISUAL_EDITOR} replace />
  }

  return (
    <VisualEditorProvider pageKey={pageDefinition.pageKey}>
      <VisualEditorWorkspace />
    </VisualEditorProvider>
  )
}

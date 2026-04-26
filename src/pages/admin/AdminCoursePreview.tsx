import { useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQueries } from "@tanstack/react-query"
import { ArrowLeft, FileText, StickyNote } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { LessonContentBlocksRenderer, LessonPrimaryMedia, RichTextContent, StatusBadge } from "@/components/common"
import { useAdminModuleAssets, useAdminProductAssessments, useAdminProductModules, useAdminProducts } from "@/hooks/useAdmin"
import { useRequestAssetAccess, useRequestModulePdfAccess } from "@/hooks/useDashboard"
import { adminCourseBuilderPath } from "@/lib/routes"
import { getAssetActionLabel, getAssetTypeLabel } from "@/lib/product-presentation"
import { fetchAdminProductLessons } from "@/services"

export function AdminCoursePreview() {
  const { courseId } = useParams<{ courseId: string }>()
  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(courseId)
  const assessmentsQuery = useAdminProductAssessments(courseId)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const assetAccess = useRequestAssetAccess()
  const modulePdfAccess = useRequestModulePdfAccess()

  const product = useMemo(() => {
    const products = productsQuery.data ?? []
    return products.find((item) => item.id === courseId) ?? null
  }, [courseId, productsQuery.data])

  const modules = modulesQuery.data ?? []
  const lessonQueries = useQueries({
    queries: modules.map((module) => ({
      queryKey: ["admin", "preview", module.id, "lessons"],
      queryFn: () => fetchAdminProductLessons(module.id),
      enabled: Boolean(module.id),
      staleTime: 60_000,
    })),
  })

  const lessonsByModule = modules.reduce<Record<string, Awaited<ReturnType<typeof fetchAdminProductLessons>>>>(
    (accumulator, module, index) => {
      accumulator[module.id] = (lessonQueries[index]?.data as Awaited<ReturnType<typeof fetchAdminProductLessons>> | undefined) ?? []
      return accumulator
    },
    {},
  )

  const selectedModule =
    modules.find((module) => module.id === (selectedModuleId ?? modules[0]?.id ?? null)) ?? modules[0] ?? null
  const selectedModuleLessons = selectedModule ? lessonsByModule[selectedModule.id] ?? [] : []
  const selectedLesson =
    selectedModuleLessons.find((lesson) => lesson.id === (selectedLessonId ?? selectedModuleLessons[0]?.id ?? null)) ??
    selectedModuleLessons[0] ??
    null
  const moduleAssetsQuery = useAdminModuleAssets(selectedModule?.id)

  const loading =
    productsQuery.isLoading ||
    modulesQuery.isLoading ||
    assessmentsQuery.isLoading ||
    lessonQueries.some((query) => query.isLoading)

  if (!courseId) {
    return <EmptyState title="Curso invalido" message="Abra um curso valido para visualizar o conteudo." />
  }

  if (loading) {
    return <LoadingState message="A preparar a visualizacao administrativa do curso..." />
  }

  const lessonError = lessonQueries.find((query) => query.isError)?.error
  const error = productsQuery.error ?? modulesQuery.error ?? assessmentsQuery.error ?? lessonError
  if (
    productsQuery.isError ||
    modulesQuery.isError ||
    assessmentsQuery.isError ||
    lessonQueries.some((query) => query.isError)
  ) {
    return (
      <ErrorState
        title="Nao foi possivel abrir o visualizador do curso"
        message={error instanceof Error ? error.message : "Tente novamente dentro de instantes."}
        onRetry={() => {
          void productsQuery.refetch()
          void modulesQuery.refetch()
          void assessmentsQuery.refetch()
          lessonQueries.forEach((query) => void query.refetch())
        }}
      />
    )
  }

  if (!product) {
    return <EmptyState title="Curso nao encontrado" message="Este curso nao esta disponivel no admin." />
  }

  const moduleAssets = moduleAssetsQuery.data ?? []
  const moduleAssessments = (assessmentsQuery.data ?? []).filter(
    (assessment) => assessment.module_id === selectedModule?.id && assessment.assessment_type === "module",
  )
  const finalAssessments = (assessmentsQuery.data ?? []).filter((assessment) => assessment.assessment_type === "final")

  if (moduleAssetsQuery.isLoading) {
    return <LoadingState message="A preparar os materiais do modulo..." />
  }

  if (moduleAssetsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os materiais do modulo"
        message={moduleAssetsQuery.error instanceof Error ? moduleAssetsQuery.error.message : "Tente novamente dentro de instantes."}
        onRetry={() => void moduleAssetsQuery.refetch()}
      />
    )
  }

  return (
    <div className="grid min-h-[calc(100vh-9rem)] gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Preview admin</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-slate-950">{product.title}</h1>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to={adminCourseBuilderPath(courseId)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Builder
            </Link>
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {modules.map((module, index) => {
            const moduleLessons = lessonsByModule[module.id] ?? []
            return (
              <div key={module.id} className={`rounded-2xl border p-3 ${selectedModule?.id === module.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModuleId(module.id)
                    setSelectedLessonId(moduleLessons[0]?.id ?? null)
                  }}
                  className="w-full text-left"
                >
                  <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${selectedModule?.id === module.id ? "text-white/65" : "text-slate-500"}`}>
                    Modulo {index + 1}
                  </p>
                  <p className="mt-2 font-bold">{module.title}</p>
                </button>

                <div className="mt-3 space-y-2">
                  {moduleLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => {
                        setSelectedModuleId(module.id)
                        setSelectedLessonId(lesson.id)
                      }}
                      className={`w-full rounded-xl px-3 py-3 text-left text-sm ${
                        selectedLesson?.id === lesson.id
                          ? "bg-white text-slate-950"
                          : selectedModule?.id === module.id
                            ? "bg-white/10 text-white"
                            : "bg-white text-slate-700"
                      }`}
                    >
                      {lesson.title}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      <section className="space-y-6">
        {selectedModule && selectedLesson ? (
          <>
            <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{selectedModule.title}</p>
                  <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">{selectedLesson.title}</h2>
                  <RichTextContent
                    value={selectedLesson.description}
                    fallback="Aula pronta para visualizacao administrativa."
                    className="mt-3 max-w-3xl text-sm leading-8 text-slate-600"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={selectedLesson.lesson_type === "hybrid" ? "Hibrida" : selectedLesson.lesson_type === "video" ? "Video" : selectedLesson.lesson_type === "file" ? "Ficheiro" : "Texto"} tone="info" />
                  <StatusBadge label={`${selectedLesson.estimated_minutes} min`} tone="warning" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <LessonPrimaryMedia source={selectedLesson.youtube_url} />
                {selectedLesson.text_content ? (
                  <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileText className="h-4 w-4" />
                      <p className="font-medium">Conteudo textual</p>
                    </div>
                    <LessonContentBlocksRenderer value={selectedLesson.text_content} className="mt-3" />
                  </div>
                ) : selectedLesson.lesson_type === "file" ? (
                  <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileText className="h-4 w-4" />
                      <p className="font-medium">Conteudo principal em ficheiro</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Esta aula depende dos materiais protegidos listados abaixo.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-slate-900" />
                  <h3 className="font-display text-2xl font-bold text-slate-950">Avaliacoes deste modulo</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {moduleAssessments.length === 0 ? (
                    <EmptyState
                      title="Sem quiz neste modulo"
                      message="Quando houver uma avaliacao vinculada ao modulo, ela aparecera aqui para referencia."
                    />
                  ) : (
                    moduleAssessments.map((assessment) => (
                      <div key={assessment.id} className="rounded-2xl border bg-slate-50/70 p-4">
                        <p className="font-semibold text-slate-950">{assessment.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {assessment.description ?? "Quiz do modulo."}
                        </p>
                      </div>
                    ))
                  )}
                  {finalAssessments.length > 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Avaliacao final</p>
                      <p className="mt-2 font-semibold text-slate-950">{finalAssessments[0]?.title}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
                <h3 className="font-display text-2xl font-bold text-slate-950">Materiais do modulo</h3>
                <div className="mt-4 space-y-3">
                  {selectedModule.module_pdf_file_name ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{selectedModule.module_pdf_file_name}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">PDF base protegido do modulo.</p>
                        </div>
                        <Button
                          type="button"
                          className="rounded-full"
                          onClick={() => void modulePdfAccess.mutateAsync(selectedModule.id).then((result) => window.open(result.url, "_blank", "noopener,noreferrer"))}
                          disabled={modulePdfAccess.isPending}
                        >
                          {modulePdfAccess.isPending ? "A preparar..." : "Abrir PDF"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {moduleAssets.length === 0 ? (
                    <EmptyState
                      title="Sem materiais adicionais"
                      message="Os ficheiros, links e videos de apoio do modulo aparecerao aqui."
                    />
                  ) : (
                    moduleAssets.map((asset) => (
                      <div key={asset.id} className="rounded-2xl border bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">{asset.title}</p>
                              <StatusBadge label={getAssetTypeLabel(asset.asset_type)} tone="info" />
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Material de apoio do modulo atual.</p>
                          </div>
                          <Button
                            type="button"
                            className="rounded-full"
                            onClick={() => void assetAccess.mutateAsync(asset.id).then((result) => window.open(result.url, "_blank", "noopener,noreferrer"))}
                            disabled={assetAccess.isPending}
                          >
                            {assetAccess.isPending ? "A abrir..." : getAssetActionLabel(asset)}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <EmptyState
            title="Sem conteudo para pre-visualizar"
            message="Adicione pelo menos um modulo e uma aula para abrir o visualizador administrativo."
          />
        )}
      </section>
    </div>
  )
}

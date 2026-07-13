import { useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQueries } from "@tanstack/react-query"
import { ArrowLeft, FileText } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { Button } from "@/components/ui"
import { LessonContentBlocksRenderer, LessonPrimaryMedia, RichTextContent, StatusBadge } from "@/components/common"
import { useAdminProductModules, useAdminProducts } from "@/hooks/useAdmin"
import { adminCourseBuilderPath } from "@/lib/routes"
import { fetchAdminProductLessons } from "@/services"

export function AdminCoursePreview() {
  const { courseId } = useParams<{ courseId: string }>()
  const productsQuery = useAdminProducts()
  const modulesQuery = useAdminProductModules(courseId)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)

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
  const loading =
    productsQuery.isLoading ||
    modulesQuery.isLoading ||
    lessonQueries.some((query) => query.isLoading)

  if (!courseId) {
    return <EmptyState title="Material inválido" message="Abra um material válido para visualizar o conteúdo." />
  }

  if (loading) {
    return <LoadingState message="A preparar a visualização administrativa do material..." />
  }

  const lessonError = lessonQueries.find((query) => query.isError)?.error
  const error = productsQuery.error ?? modulesQuery.error ?? lessonError
  if (
    productsQuery.isError ||
    modulesQuery.isError ||
    lessonQueries.some((query) => query.isError)
  ) {
    return (
      <ErrorState
        title="Não foi possível abrir o visualizador do material"
        message={error instanceof Error ? error.message : "Tente novamente dentro de instantes."}
        onRetry={() => {
          void productsQuery.refetch()
          void modulesQuery.refetch()
          lessonQueries.forEach((query) => void query.refetch())
        }}
      />
    )
  }

  if (!product) {
    return <EmptyState title="Material não encontrado" message="Este material não esta disponível no admin." />
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
                    Módulo {index + 1}
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
                    fallback="Aula pronta para visualização administrativa."
                    className="mt-3 max-w-3xl text-sm leading-8 text-slate-600"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={selectedLesson.lesson_type === "hybrid" ? "Híbrida" : selectedLesson.lesson_type === "video" ? "Vídeo" : selectedLesson.lesson_type === "file" ? "Ficheiro" : "Texto"} tone="info" />
                  <StatusBadge label={`${selectedLesson.estimated_minutes} min`} tone="warning" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <LessonPrimaryMedia source={selectedLesson.youtube_url} />
                {selectedLesson.text_content ? (
                  <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileText className="h-4 w-4" />
                      <p className="font-medium">Conteúdo textual</p>
                    </div>
                    <LessonContentBlocksRenderer value={selectedLesson.text_content} className="mt-3" />
                  </div>
                ) : selectedLesson.lesson_type === "file" ? (
                  <div className="rounded-[1.5rem] border bg-slate-50/80 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <FileText className="h-4 w-4" />
                      <p className="font-medium">Conteúdo principal em ficheiro</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Esta aula depende dos materiais protegidos listados abaixo.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

          </>
        ) : (
          <EmptyState
            title="Sem conteúdo para pre-visualizar"
            message="Adicione pelo menos um módulo e uma aula para abrir o visualizador administrativo."
          />
        )}
      </section>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui"
import { useUpdateAdminProduct } from "@/hooks/useAdmin"
import { PageHeader } from "@/components/common"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"

export function CourseSettingsPanel() {
  const { product } = useAdminCourseBuilderContext()
  const updateProduct = useUpdateAdminProduct()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: product.title,
    slug: product.slug,
    shortDescription: product.short_description ?? "",
    launchDate: product.launch_date ?? "",
    workloadMinutes: String(product.workload_minutes ?? 0),
    creatorCommissionPercent:
      product.creator_commission_percent !== null && product.creator_commission_percent !== undefined
        ? String(product.creator_commission_percent)
        : "",
    isPublic: product.is_public,
    hasLinearProgression: product.has_linear_progression,
    quizSingleChoice: product.quiz_type_settings?.single_choice !== false,
    quizEssayAi: product.quiz_type_settings?.essay_ai !== false,
    quizCaseStudy: product.quiz_type_settings?.case_study_ai !== false,
  })

  useEffect(() => {
    setForm({
      title: product.title,
      slug: product.slug,
      shortDescription: product.short_description ?? "",
      launchDate: product.launch_date ?? "",
      workloadMinutes: String(product.workload_minutes ?? 0),
      creatorCommissionPercent:
        product.creator_commission_percent !== null && product.creator_commission_percent !== undefined
          ? String(product.creator_commission_percent)
          : "",
      isPublic: product.is_public,
      hasLinearProgression: product.has_linear_progression,
      quizSingleChoice: product.quiz_type_settings?.single_choice !== false,
      quizEssayAi: product.quiz_type_settings?.essay_ai !== false,
      quizCaseStudy: product.quiz_type_settings?.case_study_ai !== false,
    })
  }, [product])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await updateProduct.mutateAsync({
        productId: product.id,
        title: form.title.trim(),
        slug: form.slug.trim(),
        shortDescription: form.shortDescription.trim() || null,
        launchDate: form.launchDate || null,
        workloadMinutes: Number(form.workloadMinutes || 0),
        creatorCommissionPercent: form.creatorCommissionPercent ? Number(form.creatorCommissionPercent) : null,
        isPublic: form.isPublic,
        hasLinearProgression: form.hasLinearProgression,
        quizTypeSettings: {
          single_choice: form.quizSingleChoice,
          essay_ai: form.quizEssayAi,
          case_study_ai: form.quizCaseStudy,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel guardar as configuracoes do curso.")
    }
  }

  return (
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
      <PageHeader
        title="Configuracoes do curso"
        description="Identidade publica, vendas, progressao linear e tipos de quiz disponiveis neste curso."
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titulo do curso"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="slug-do-curso"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            type="date"
            value={form.launchDate}
            onChange={(event) => setForm((prev) => ({ ...prev, launchDate: event.target.value }))}
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={form.workloadMinutes}
            onChange={(event) => setForm((prev) => ({ ...prev, workloadMinutes: event.target.value }))}
            placeholder="Carga horaria em minutos"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
          <input
            value={form.creatorCommissionPercent}
            onChange={(event) => setForm((prev) => ({ ...prev, creatorCommissionPercent: event.target.value }))}
            placeholder="Comissao do criador (%)"
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <textarea
          value={form.shortDescription}
          onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
          rows={5}
          placeholder="Descricao resumida do curso"
          className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
            />
            Exibir no catalogo publico
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.hasLinearProgression}
              onChange={(event) => setForm((prev) => ({ ...prev, hasLinearProgression: event.target.checked }))}
            />
            Ativar progressao linear
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.quizSingleChoice}
              onChange={(event) => setForm((prev) => ({ ...prev, quizSingleChoice: event.target.checked }))}
            />
            Quiz de multipla escolha
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.quizEssayAi}
              onChange={(event) => setForm((prev) => ({ ...prev, quizEssayAi: event.target.checked }))}
            />
            Discursiva com IA
          </label>
          <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.quizCaseStudy}
              onChange={(event) => setForm((prev) => ({ ...prev, quizCaseStudy: event.target.checked }))}
            />
            Estudos de caso
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="rounded-full" disabled={updateProduct.isPending}>
            {updateProduct.isPending ? "A guardar..." : "Guardar configuracoes"}
          </Button>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}

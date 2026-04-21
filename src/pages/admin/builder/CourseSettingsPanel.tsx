import { ImagePlus, Link2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui"
import { PageHeader, RichTextEditor, StatusBadge } from "@/components/common"
import { useUpdateAdminProduct, useUploadAdminProductCover } from "@/hooks/useAdmin"
import { adminCourseBuilderPath } from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderLayout"

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function extractCoverStoragePath(url: string | null | undefined) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

function Field({
  label,
  helper,
  children,
  fullWidth = false,
}: {
  label: string
  helper?: string
  children: ReactNode
  fullWidth?: boolean
}) {
  return (
    <label className={fullWidth ? "md:col-span-2 space-y-2" : "space-y-2"}>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {helper ? <p className="text-sm text-slate-500">{helper}</p> : null}
    </label>
  )
}

export function CourseSettingsPanel() {
  const { product } = useAdminCourseBuilderContext()
  const updateProduct = useUpdateAdminProduct()
  const uploadCover = useUploadAdminProductCover()
  const [error, setError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: product.title,
    slug: product.slug,
    coverImageUrl: product.cover_image_url ?? "",
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
  })

  useEffect(() => {
    setForm({
      title: product.title,
      slug: product.slug,
      coverImageUrl: product.cover_image_url ?? "",
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
    })
    setUploadMessage(null)
  }, [product])

  const coverStoragePath = useMemo(() => extractCoverStoragePath(form.coverImageUrl), [form.coverImageUrl])

  const handleCoverSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    setError(null)
    setUploadMessage(null)

    try {
      const upload = await uploadCover.mutateAsync({
        productId: product.id,
        file,
        replacePath: coverStoragePath,
      })

      setForm((prev) => ({
        ...prev,
        coverImageUrl: upload.public_url ?? prev.coverImageUrl,
      }))
      setUploadMessage("Capa enviada com sucesso. Guarde as configuracoes para publicar a nova imagem.")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar a capa do curso.")
    } finally {
      event.target.value = ""
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await updateProduct.mutateAsync({
        productId: product.id,
        title: form.title.trim(),
        slug: form.slug.trim(),
        coverImageUrl: form.coverImageUrl.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        launchDate: form.launchDate || null,
        workloadMinutes: Number(form.workloadMinutes || 0),
        creatorCommissionPercent: form.creatorCommissionPercent ? Number(form.creatorCommissionPercent) : null,
        isPublic: form.isPublic,
        hasLinearProgression: form.hasLinearProgression,
        quizTypeSettings: {
          single_choice: form.quizSingleChoice,
          essay_ai: false,
          case_study_ai: false,
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
        description="Identidade publica, capa comercial, progressao linear e quiz objetivo disponivel neste curso."
        actions={
          <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Link to={adminCourseBuilderPath(product.id)}>Abrir construtor</Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Titulo do curso" helper="Nome principal mostrado no admin, no catalogo e no checkout.">
            <input
              value={form.title}
              onChange={(event) =>
                setForm((prev) => {
                  const nextTitle = event.target.value
                  const shouldAutoUpdateSlug = !prev.slug.trim() || prev.slug === slugify(prev.title)

                  return {
                    ...prev,
                    title: nextTitle,
                    slug: shouldAutoUpdateSlug ? slugify(nextTitle) : prev.slug,
                  }
                })
              }
              placeholder="Titulo do curso"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Slug do curso" helper="Identificador da URL publica. Use texto curto e estavel.">
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
              placeholder="slug-do-curso"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Data de lancamento" helper="Data de referencia comercial do curso.">
            <input
              type="date"
              value={form.launchDate}
              onChange={(event) => setForm((prev) => ({ ...prev, launchDate: event.target.value }))}
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Carga horaria total" helper="Use minutos para manter consistencia com player e cards.">
            <input
              value={form.workloadMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, workloadMinutes: event.target.value }))}
              placeholder="Carga horaria em minutos"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field
            label="Comissao do criador (%)"
            helper="Percentual operacional para afiliacao/autoria quando aplicavel."
          >
            <input
              value={form.creatorCommissionPercent}
              onChange={(event) => setForm((prev) => ({ ...prev, creatorCommissionPercent: event.target.value }))}
              placeholder="Comissao do criador (%)"
              className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field
            label="URL manual da capa"
            helper="Opcional. Pode usar link externo ou deixar apenas a imagem enviada abaixo."
          >
            <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3">
              <Link2 className="h-4 w-4 text-slate-400" />
              <input
                value={form.coverImageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))}
                placeholder="https://..."
                className="h-11 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </Field>
          <Field
            label="Resumo curto / area de texto"
            helper="Texto curto usado em cards, paginas de curso e contexto comercial."
            fullWidth
          >
            <RichTextEditor
              value={form.shortDescription}
              onChange={(value) => setForm((prev) => ({ ...prev, shortDescription: value }))}
              placeholder="Descreva o curso com hierarquia, listas e destaques."
              minHeightClassName="min-h-[180px]"
            />
          </Field>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Capa do curso</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Upload de imagem</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                A capa alimenta cards e paginas publicas. O upload gera um asset publico apenas para a imagem comercial do curso.
              </p>
            </div>
            {form.coverImageUrl ? <StatusBadge label="Capa configurada" tone="success" /> : null}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
              {form.coverImageUrl ? (
                <img src={form.coverImageUrl} alt={`Capa de ${product.title}`} className="aspect-[4/3] h-full w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(145deg,#1a91af_0%,#155d73_55%,#123845_100%)] text-white">
                  <div className="rounded-[1.15rem] bg-white/90 p-4 text-sky-700">
                    <ImagePlus className="h-7 w-7" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">Enviar nova imagem</p>
                <p className="mt-1 text-sm text-slate-500">
                  Formatos recomendados: JPG, PNG ou WEBP. Depois do upload, confirme em guardar configuracoes.
                </p>
              </div>

              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleCoverSelection} className="text-sm" />

              {uploadMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {uploadMessage}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-950">Exibir no catalogo publico</span>
              <span className="mt-1 block text-slate-500">Mantem o curso visivel na area comercial da plataforma.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.hasLinearProgression}
              onChange={(event) => setForm((prev) => ({ ...prev, hasLinearProgression: event.target.checked }))}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-950">Ativar progressao linear</span>
              <span className="mt-1 block text-slate-500">Bloqueia os proximos passos ate o aluno cumprir a trilha anterior.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.quizSingleChoice}
              onChange={(event) => setForm((prev) => ({ ...prev, quizSingleChoice: event.target.checked }))}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-950">Permitir quiz objetivo de multipla escolha</span>
              <span className="mt-1 block text-slate-500">
                Tipos com IA e narracao ficam desativados neste ajuste; o builder passa a operar apenas com quiz objetivo e avaliacao final objetiva.
              </span>
            </span>
          </label>
        </section>

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

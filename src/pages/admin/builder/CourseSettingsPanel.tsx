import { ImagePlus, Link2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui"
import { OperationFeedbackModal, PageHeader, RichTextEditor, StatusBadge } from "@/components/common"
import { useAdminProductCategories, useUpdateAdminProduct, useUploadAdminProductCover } from "@/hooks/useAdmin"
import { ROUTES } from "@/lib/constants"
import { adminCourseBuilderPath } from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function formatPriceInput(priceCents: number) {
  return (priceCents / 100).toFixed(2)
}

function parsePriceInput(value: string) {
  const parsed = Number(value.replace(",", ".").trim() || "0")
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
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
    <label className={fullWidth ? "block space-y-2 md:col-span-2" : "block space-y-2"}>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {helper ? <p className="text-sm text-slate-500">{helper}</p> : null}
    </label>
  )
}

export function CourseSettingsPanel() {
  const { product } = useAdminCourseBuilderContext()
  const { data: categories = [] } = useAdminProductCategories()
  const updateProduct = useUpdateAdminProduct()
  const uploadCover = useUploadAdminProductCover()
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
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
    productType: product.product_type,
    status: product.status,
    categoryId: product.category_id ?? "",
    price: formatPriceInput(product.price_cents),
    currency: product.currency,
    salesPageEnabled: product.sales_page_enabled,
    requiresAuth: product.requires_auth,
    isFeatured: product.is_featured,
    allowAffiliate: product.allow_affiliate,
    sortOrder: String(product.sort_order ?? 0),
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
      productType: product.product_type,
      status: product.status,
      categoryId: product.category_id ?? "",
      price: formatPriceInput(product.price_cents),
      currency: product.currency,
      salesPageEnabled: product.sales_page_enabled,
      requiresAuth: product.requires_auth,
      isFeatured: product.is_featured,
      allowAffiliate: product.allow_affiliate,
      sortOrder: String(product.sort_order ?? 0),
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

    setFeedback(null)
    setUploadMessage(null)

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ tone: "error", message: "A capa deve ter no maximo 10MB." })
      event.target.value = ""
      return
    }

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
      setFeedback({
        tone: "error",
        message: uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar a capa do material.",
      })
    } finally {
      event.target.value = ""
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)

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
        productType: form.productType,
        status: form.status,
        categoryId: form.categoryId.trim() || null,
        priceCents: parsePriceInput(form.price),
        currency: form.currency.trim().toUpperCase() || "EUR",
        salesPageEnabled: form.salesPageEnabled,
        requiresAuth: form.requiresAuth,
        isFeatured: form.isFeatured,
        allowAffiliate: form.allowAffiliate,
        sortOrder: Number(form.sortOrder || 0),
        isPublic: form.isPublic,
        hasLinearProgression: form.hasLinearProgression,
        quizTypeSettings: {
          single_choice: form.quizSingleChoice,
          essay_ai: false,
          case_study_ai: false,
        },
      })
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Nao foi possivel guardar as configuracoes do material.",
      })
      return
    }

    setFeedback({ tone: "success", message: "Configuracoes do material guardadas com sucesso." })
  }

  return (
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
      <PageHeader
        title="Configuracoes do material"
        description="Identidade publica, capa comercial, progressao linear e quiz objetivo disponivel neste material."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link to={adminCourseBuilderPath(product.id)}>Abrir construtor</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link to={`${ROUTES.ADMIN_COURSES}?tab=categorias`}>Gerir categorias</Link>
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Titulo do material" helper="Nome principal mostrado no admin, no catalogo e no checkout.">
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
              placeholder="Titulo do material"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Slug do material" helper="Identificador da URL publica. Use texto curto e estavel.">
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
              placeholder="slug-do-material"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Categoria do material" helper="Categorias usadas no catalogo publico e nos filtros.">
            <select
              value={form.categoryId}
              onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data de lancamento" helper="Data de referencia comercial do material.">
            <input
              type="date"
              value={form.launchDate}
              onChange={(event) => setForm((prev) => ({ ...prev, launchDate: event.target.value }))}
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Carga horaria total" helper="Use minutos para manter consistencia com player e cards.">
            <input
              value={form.workloadMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, workloadMinutes: event.target.value }))}
              placeholder="Carga horaria em minutos"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
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
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field
            label="URL manual da capa"
            helper="Opcional. Pode usar link externo ou deixar apenas a imagem enviada abaixo."
          >
            <div className="flex w-full items-center gap-2 rounded-xl border bg-slate-50 px-3">
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
            helper="Texto curto usado em cards, paginas de material e contexto comercial."
            fullWidth
          >
            <RichTextEditor
              value={form.shortDescription}
              onChange={(value) => setForm((prev) => ({ ...prev, shortDescription: value }))}
              placeholder="Descreva o material com hierarquia, listas e destaques."
              minHeightPx={180}
            />
          </Field>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Compra e checkout</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">Configuracao comercial</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Estes campos controlam o preco, a visibilidade da pagina publica e o comportamento do botao de compra.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Tipo de produto" helper="Pago vai para Stripe; gratuito ativa acesso sem pagamento.">
              <select
                value={form.productType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, productType: event.target.value as typeof form.productType }))
                }
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="paid">Pago</option>
                <option value="free">Gratuito</option>
                <option value="hybrid">Hibrido</option>
                <option value="external_service">Servico externo</option>
              </select>
            </Field>
            <Field label="Estado do material" helper="A pagina publica e o checkout exigem material publicado.">
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as typeof form.status }))
                }
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </Field>
            <Field label="Preco" helper="Valor em euros. Em produtos pagos, use pelo menos 0.50 para checkout Stripe.">
              <input
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                placeholder="0.00"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </Field>
            <Field label="Moeda" helper="Codigo ISO usado pelo checkout.">
              <input
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                placeholder="EUR"
                maxLength={3}
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm uppercase outline-none focus:border-slate-400 focus:bg-white"
              />
            </Field>
            <Field label="Ordem no catalogo" helper="Numeros menores aparecem primeiro.">
              <input
                value={form.sortOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                inputMode="numeric"
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </Field>
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.salesPageEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, salesPageEnabled: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Ativar pagina publica e checkout</span>
                  <span className="mt-1 block text-slate-500">Permite abrir a pagina do material e seguir pelo botao de compra.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.requiresAuth}
                  onChange={(event) => setForm((prev) => ({ ...prev, requiresAuth: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Exigir login para concluir</span>
                  <span className="mt-1 block text-slate-500">Mantem a compra vinculada a uma conta de aluno ativa.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) => setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Destacar no catalogo</span>
                  <span className="mt-1 block text-slate-500">Marca o material como destaque nas areas publicas.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.allowAffiliate}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowAffiliate: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Permitir afiliacao</span>
                  <span className="mt-1 block text-slate-500">Mantem o material elegivel para fluxos de afiliados quando ativos.</span>
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Capa do material</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Upload de imagem</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                A capa alimenta cards e paginas publicas. O upload gera um asset publico apenas para a imagem comercial do material.
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

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/pjpeg,image/webp,image/gif,image/avif"
                onChange={handleCoverSelection}
                className="text-sm"
              />

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
              <span className="mt-1 block text-slate-500">Mantem o material visivel na area comercial da plataforma.</span>
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
        </div>
      </form>

      <OperationFeedbackModal
        open={Boolean(feedback)}
        tone={feedback?.tone ?? "success"}
        message={feedback?.message ?? ""}
        onClose={() => setFeedback(null)}
      />
    </section>
  )
}

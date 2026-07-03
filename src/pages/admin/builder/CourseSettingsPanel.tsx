import { ArrowDown, ArrowUp, ImagePlus, Link2, Plus, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui"
import { OperationFeedbackModal, PageHeader, RichTextEditor, StatusBadge } from "@/components/common"
import { useAdminProductCategories, useUpdateAdminProduct, useUploadAdminProductCover } from "@/hooks/useAdmin"
import { buildCourseCatalogCardView, sanitizeCourseCatalogCardContent } from "@/lib/course-public-page"
import { ROUTES } from "@/lib/constants"
import { adminCourseBuilderPath } from "@/lib/routes"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"
import type { CourseCatalogCardItem, CourseCatalogCardMode } from "@/types/product.types"

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

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-400 focus:bg-white"
    />
  )
}

export function CourseSettingsPanel() {
  const { product } = useAdminCourseBuilderContext()
  const { data: categories = [] } = useAdminProductCategories()
  const updateProduct = useUpdateAdminProduct()
  const uploadCover = useUploadAdminProductCover()
  const initialCardView = useMemo(() => buildCourseCatalogCardView(product), [product])
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
    catalogCardMode: initialCardView.mode as CourseCatalogCardMode,
    catalogCardSummary: initialCardView.summary,
    catalogCardItems: initialCardView.items as CourseCatalogCardItem[],
  })

  useEffect(() => {
    const nextCardView = buildCourseCatalogCardView(product)
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
      catalogCardMode: nextCardView.mode,
      catalogCardSummary: nextCardView.summary,
      catalogCardItems: nextCardView.items,
    })
    setUploadMessage(null)
  }, [product])

  const coverStoragePath = useMemo(() => extractCoverStoragePath(form.coverImageUrl), [form.coverImageUrl])

  const moveCatalogCardItem = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.catalogCardItems.length) {
        return prev
      }

      const items = [...prev.catalogCardItems]
      const [item] = items.splice(index, 1)
      items.splice(nextIndex, 0, item)

      return {
        ...prev,
        catalogCardItems: items,
      }
    })
  }

  const handleCoverSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    setFeedback(null)
    setUploadMessage(null)

    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ tone: "error", message: "A capa deve ter no máximo 10MB." })
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
      setUploadMessage("Capa enviada com sucesso. Guarde as configurações para publicar a nova imagem.")
    } catch (uploadError) {
      setFeedback({
        tone: "error",
        message: uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a capa do material.",
      })
    } finally {
      event.target.value = ""
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)

    try {
      const nextPublicPageContent = { ...(product.public_page_content ?? {}) }
      delete nextPublicPageContent.catalogCardMode
      delete nextPublicPageContent.catalogCardSummary
      delete nextPublicPageContent.catalogCardItems
      Object.assign(
        nextPublicPageContent,
        sanitizeCourseCatalogCardContent({
          mode: form.catalogCardMode,
          summary: form.catalogCardSummary,
          items: form.catalogCardItems,
        }),
      )

      const updatedProduct = await updateProduct.mutateAsync({
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
        publicPageContent: nextPublicPageContent,
      })
      const selectedCategoryId = form.categoryId.trim()
      setForm((prev) => ({
        ...prev,
        categoryId: updatedProduct.product.category_id ?? selectedCategoryId,
      }))
    } catch (err) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Não foi possível guardar as configurações do material.",
      })
      return
    }

    setFeedback({ tone: "success", message: "Configurações do material guardadas com sucesso." })
  }

  return (
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
      <PageHeader
        title="Configurações do material"
        description="Identidade pública, capa comercial, progressao linear e quiz objetivo disponível neste material."
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
          <Field label="Título do material" helper="Nome principal mostrado no admin, no catálogo e no checkout.">
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
              placeholder="Título do material"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Slug do material" helper="Identificador da URL pública. Use texto curto e estavel.">
            <input
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
              placeholder="slug-do-material"
              className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </Field>
          <Field label="Categoria do material" helper="Categorias usadas no catálogo público e nos filtros.">
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
            label="Comissão do criador (%)"
            helper="Percentual operacional para afiliação/autoria quando aplicável."
          >
            <input
              value={form.creatorCommissionPercent}
              onChange={(event) => setForm((prev) => ({ ...prev, creatorCommissionPercent: event.target.value }))}
              placeholder="Comissão do criador (%)"
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
            label="Resumo curto / Área de texto"
            helper="Texto curto usado em cards, páginas de material e contexto comercial."
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

        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Card do catalogo</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">Informacoes exibidas em `/materiais`</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Controla o resumo e os blocos informativos mostrados no card publico deste material. Tambem podes ocultar tudo e deixar o card mais enxuto.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {([
              {
                value: "default",
                title: "Usar padrao",
                description: "Mantem os textos automáticos gerados pela narrativa atual do material.",
              },
              {
                value: "custom",
                title: "Personalizar",
                description: "Define manualmente o resumo e os blocos que aparecem no card.",
              },
              {
                value: "none",
                title: "Nao mostrar",
                description: "Oculta o resumo e todos os blocos informativos do card publico.",
              },
            ] as Array<{ value: CourseCatalogCardMode; title: string; description: string }>).map((option) => {
              const active = form.catalogCardMode === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, catalogCardMode: option.value }))}
                  className={[
                    "rounded-[1.35rem] border p-4 text-left transition",
                    active
                      ? "border-sky-300 bg-sky-50/80 shadow-[0_0_0_1px_rgba(14,165,233,0.14)]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <p className="text-sm font-black text-slate-950">{option.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                </button>
              )
            })}
          </div>

          {form.catalogCardMode === "default" ? (
            <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Pre-visualizacao do padrao atual</p>
              <div className="mt-4 space-y-3">
                {form.catalogCardSummary ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{form.catalogCardSummary}</p>
                  </div>
                ) : null}
                {form.catalogCardItems.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{item.title || `Bloco ${index + 1}`}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {form.catalogCardMode === "custom" ? (
            <div className="mt-5 space-y-4">
              <Field
                label="Resumo do card"
                helper="Texto curto logo abaixo do titulo. Se deixares vazio, o resumo nao aparece."
              >
                <TextArea
                  value={form.catalogCardSummary}
                  onChange={(catalogCardSummary) => setForm((prev) => ({ ...prev, catalogCardSummary }))}
                  placeholder="Escreve um resumo curto para o card do catalogo."
                  rows={4}
                />
              </Field>

              <div className="space-y-3">
                {form.catalogCardItems.map((item, index) => (
                  <div key={`${index}-${item.title}`} className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_180px_auto]">
                      <Field label={`Titulo ${index + 1}`}>
                        <input
                          value={item.title}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              catalogCardItems: prev.catalogCardItems.map((current, currentIndex) =>
                                currentIndex === index ? { ...current, title: event.target.value } : current,
                              ),
                            }))
                          }
                          placeholder="Ex.: Beneficio principal"
                          className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </Field>
                      <Field label="Descricao">
                        <TextArea
                          value={item.description}
                          onChange={(description) =>
                            setForm((prev) => ({
                              ...prev,
                              catalogCardItems: prev.catalogCardItems.map((current, currentIndex) =>
                                currentIndex === index ? { ...current, description } : current,
                              ),
                            }))
                          }
                          placeholder="Explica o que este bloco comunica no card."
                          rows={4}
                        />
                      </Field>
                      <Field label="Estilo visual">
                        <select
                          value={item.tone ?? "soft"}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              catalogCardItems: prev.catalogCardItems.map((current, currentIndex) =>
                                currentIndex === index
                                  ? { ...current, tone: event.target.value === "outline" ? "outline" : "soft" }
                                  : current,
                              ),
                            }))
                          }
                          className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
                        >
                          <option value="soft">Cartao suave</option>
                          <option value="outline">Cartao contornado</option>
                        </select>
                      </Field>
                      <div className="flex items-start gap-2 pt-8">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-xl"
                          onClick={() => moveCatalogCardItem(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-xl"
                          onClick={() => moveCatalogCardItem(index, 1)}
                          disabled={index === form.catalogCardItems.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-xl"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              catalogCardItems: prev.catalogCardItems.filter((_, currentIndex) => currentIndex !== index),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    catalogCardItems: [...prev.catalogCardItems, { title: "", description: "", tone: "soft" }],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar bloco informativo
              </Button>
            </div>
          ) : null}

          {form.catalogCardMode === "none" ? (
            <div className="mt-5 rounded-[1.35rem] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
              Este material vai mostrar apenas imagem, etiquetas principais, titulo, preco e CTA no card do catalogo.
            </div>
          ) : null}
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Compra e checkout</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">Configuração comercial</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Estes campos controlam o preço, a visibilidade da página pública e o comportamento do botão de compra.
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
                <option value="hybrid">Híbrido</option>
                <option value="external_service">Serviço externo</option>
              </select>
            </Field>
            <Field label="Estado do material" helper="A página pública e o checkout exigem material publicado.">
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
            <Field label="Preço" helper="Valor em euros. Em produtos pagos, use pelo menos 0.50 para checkout Stripe.">
              <input
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                placeholder="0.00"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
              />
            </Field>
            <Field label="Moeda" helper="Código ISO usado pelo checkout.">
              <input
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                placeholder="EUR"
                maxLength={3}
                className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm uppercase outline-none focus:border-slate-400 focus:bg-white"
              />
            </Field>
            <Field label="Ordem no catálogo" helper="Números menores aparecem primeiro.">
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
                  <span className="block font-semibold text-slate-950">Ativar página pública e checkout</span>
                  <span className="mt-1 block text-slate-500">Permite abrir a página do material e seguir pelo botão de compra.</span>
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
                  <span className="block font-semibold text-slate-950">Destacar no catálogo</span>
                  <span className="mt-1 block text-slate-500">Marca o material como destaque nas Áreas públicas.</span>
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
                  <span className="block font-semibold text-slate-950">Permitir afiliação</span>
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
                A capa alimenta cards e páginas públicas. O upload gera um asset público apenas para a imagem comercial do material.
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
                  Formatos recomendados: JPG, PNG ou WEBP. Depois do upload, confirme em guardar configurações.
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
              <span className="block font-semibold text-slate-950">Exibir no catálogo público</span>
              <span className="mt-1 block text-slate-500">Mantem o material visível na Área comercial da plataforma.</span>
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
              <span className="mt-1 block text-slate-500">Bloqueia os próximos passos ate o aluno cumprir a trilha anterior.</span>
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
                Tipos com IA e narracao ficam desativados neste ajuste; o builder passa a operar apenas com quiz objetivo e avaliação final objetiva.
              </span>
            </span>
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="rounded-full" disabled={updateProduct.isPending}>
            {updateProduct.isPending ? "A guardar..." : "Guardar configurações"}
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

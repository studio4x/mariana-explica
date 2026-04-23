import { Link } from "react-router-dom"
import { ArrowRight, ChevronLeft, ChevronRight, Quote, Search } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { usePublishedProducts } from "@/hooks/useProducts"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { getProductFamilyLabel, getProductNarrative } from "@/lib/product-presentation"
import { publicCoursePath } from "@/lib/routes"
import { formatProductPrice } from "@/utils/currency"
import type { ProductSummary } from "@/types/product.types"

type QuickFilter = "all" | "packs" | "sebentas" | "free" | "services"
type SortMode = "recent" | "price_asc" | "popular"

const filterLabels: Record<QuickFilter, string> = {
  all: "Todos",
  packs: "Packs completos",
  sebentas: "Sebentas",
  services: "Explicacoes",
  free: "Gratis",
}

const sortLabels: Record<SortMode, string> = {
  recent: "Mais recentes",
  price_asc: "Preco: baixo a alto",
  popular: "Popularidade",
}

function sortProducts(products: ProductSummary[], sortMode: SortMode) {
  const next = [...products]

  if (sortMode === "price_asc") {
    return next.sort((left, right) => left.price_cents - right.price_cents)
  }

  if (sortMode === "popular") {
    return next.sort((left, right) => Number(right.is_featured) - Number(left.is_featured) || left.sort_order - right.sort_order)
  }

  return next.sort((left, right) => {
    const leftDate = Date.parse(left.published_at ?? left.launch_date ?? "")
    const rightDate = Date.parse(right.published_at ?? right.launch_date ?? "")
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate)
  })
}

export function Products() {
  const { session } = useAuth()
  const [search, setSearch] = useState("")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const deferredSearch = useDeferredValue(search)
  const { data: products, isLoading, isError, error, refetch } = usePublishedProducts()
  const { data: enrolledCourses } = useMyProducts({ enabled: Boolean(session) })

  const filteredProducts = sortProducts((products ?? []).filter((product) => {
    const haystack = [
      product.title,
      product.short_description ?? "",
      product.description ?? "",
      product.product_type,
      getProductFamilyLabel(product),
    ]
      .join(" ")
      .toLowerCase()

    const matchesSearch = haystack.includes(deferredSearch.trim().toLowerCase())
    const familyLabel = getProductFamilyLabel(product).toLowerCase()
    const matchesQuickFilter =
      quickFilter === "all" ||
      (quickFilter === "packs" && familyLabel.includes("pack")) ||
      (quickFilter === "sebentas" && familyLabel.includes("sebenta")) ||
      (quickFilter === "free" && product.product_type === "free") ||
      (quickFilter === "services" && product.product_type === "external_service")

    return matchesSearch && matchesQuickFilter
  }), sortMode)

  return (
    <div className="bg-[#f5fafc] text-[#171c1e]">
      <main className="container">
        <header className="py-16 text-center md:py-20">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="font-display text-4xl font-bold leading-tight text-[#0f122c] md:text-5xl">
              Explora o teu futuro
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-[#46464d]">
              Um catalogo curado de recursos academicos, desenhados para transformar o teu estudo numa experiencia de clareza, foco e continuidade.
            </p>
          </div>
        </header>

        <section className="mb-12">
          <div className="flex flex-col items-center justify-between gap-6 rounded-lg bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,18,44,0.05)] md:flex-row">
            <div className="flex w-full gap-2 overflow-x-auto pb-2 md:w-auto md:pb-0">
              {(Object.keys(filterLabels) as QuickFilter[]).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setQuickFilter(filterKey)}
                  className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                    quickFilter === filterKey
                      ? "bg-[#0f122c] text-white"
                      : "bg-[#e4e9eb] text-[#46464d] hover:bg-[#dee3e5]"
                  }`}
                >
                  {filterLabels[filterKey]}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#46464d]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Procurar curso ou tema..."
                className="h-11 w-full rounded-lg border border-slate-200 bg-[#f5fafc] pl-10 pr-4 text-sm outline-none transition focus:border-[#3a618b] focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#46464d]">
              Exibindo {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
            </p>
            <div className="hidden h-px flex-1 bg-slate-200 md:block md:mx-8" />
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#46464d]">
              Ordenar por:
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="border-0 bg-transparent p-0 text-xs font-bold uppercase tracking-[0.08em] text-[#0f122c] outline-none focus:ring-0"
              >
                {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {sortLabels[mode]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {isLoading ? <LoadingState message="A carregar catalogo..." /> : null}
        {isError ? (
          <ErrorState
            title="Falha ao carregar o catalogo"
            message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
            onRetry={() => void refetch()}
          />
        ) : null}
        {!isLoading && !isError && filteredProducts.length === 0 ? (
          <EmptyState
            title="Nenhum curso encontrado"
            message={
              search.trim()
                ? "Experimenta outro termo de pesquisa ou limpa o filtro."
                : "Ainda nao ha cursos publicados para mostrar."
            }
          />
        ) : null}

        <section className="mb-20 grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const enrolledAction = getEnrolledCourseAction(findEnrolledCourse(product.id, enrolledCourses))

            return (
              <CatalogCourseCard
                key={product.id}
                product={product}
                actionTo={enrolledAction?.to ?? publicCoursePath(product.slug, product.id)}
                actionLabel={enrolledAction?.label ?? "Ver detalhes"}
              />
            )
          })}
        </section>

        {!isLoading && !isError && filteredProducts.length > 0 ? (
          <>
            <section className="border-y border-slate-100 py-16 md:py-20">
              <div className="mx-auto max-w-4xl space-y-8 text-center">
                <Quote className="mx-auto h-12 w-12 text-[#B8926A]" />
                <p className="font-display text-2xl italic leading-relaxed text-[#0f122c] md:text-3xl">
                  "O sucesso nao e um acidente, e o resultado de uma preparacao intencional e das ferramentas certas."
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-10 bg-[#B8926A]" />
                  <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#46464d]">
                    Mariana Explica
                  </span>
                  <div className="h-px w-10 bg-[#B8926A]" />
                </div>
              </div>
            </section>

            <nav className="flex items-center justify-center gap-4 py-16" aria-label="Paginacao do catalogo">
              <button
                type="button"
                disabled
                className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 text-[#46464d] opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="flex h-10 w-10 items-center justify-center rounded bg-[#0f122c] text-xs font-bold text-white">
                1
              </span>
              <button
                type="button"
                disabled
                className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 text-[#46464d] opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </>
        ) : null}
      </main>
    </div>
  )
}

function CatalogCourseCard({
  product,
  actionTo,
  actionLabel,
}: {
  product: ProductSummary
  actionTo: string
  actionLabel: string
}) {
  const narrative = getProductNarrative(product)
  const familyLabel = getProductFamilyLabel(product)
  const isFree = product.product_type === "free"

  return (
    <article className="group">
      <Link to={actionTo} className="block">
        <div className="relative mb-8 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-8 shadow-[0_4px_20px_-4px_rgba(15,18,44,0.05)] [perspective:1000px]">
          {isFree ? (
            <span className="absolute right-4 top-4 z-10 rounded-sm bg-[#B8926A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
              Gratis
            </span>
          ) : null}

          {product.cover_image_url ? (
            <img
              src={product.cover_image_url}
              alt={product.title}
              loading="lazy"
              className="h-full w-full rounded object-cover shadow-2xl transition duration-500 [transform:rotateY(-10deg)_translateX(5px)] group-hover:[transform:rotateY(-5deg)_translateX(0)]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded bg-[linear-gradient(135deg,#242742_0%,#3a618b_58%,#d1e4ff_100%)] p-6 text-center shadow-2xl transition duration-500 [transform:rotateY(-10deg)_translateX(5px)] group-hover:[transform:rotateY(-5deg)_translateX(0)]">
              <p className="font-display text-2xl font-bold leading-tight text-white">{product.title}</p>
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-3">
        <span className="inline-block rounded bg-[#d1e4ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#315882]">
          {familyLabel}
        </span>
        <Link to={actionTo} className="block">
          <h2 className="font-display text-2xl font-normal leading-snug text-[#0f122c] transition group-hover:text-[#3a618b]">
            {product.title}
          </h2>
        </Link>
        <p className="line-clamp-2 text-sm leading-6 text-[#46464d]">{narrative.cardSummary}</p>

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <span className="font-display text-2xl font-normal text-[#af8962]">
            {formatProductPrice(product.price_cents, product.currency)}
          </span>
          <Link
            to={actionTo}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.08em] text-[#3a618b] underline-offset-4 transition hover:underline"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}

import { useDeferredValue, useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { usePublishedProducts } from "@/hooks/useProducts"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { getProductFamilyLabel } from "@/lib/product-presentation"
import { publicCoursePath } from "@/lib/routes"
import type { ProductSummary } from "@/types/product.types"

type QuickFilter = "all" | "packs" | "sebentas" | "free" | "services"
type SortMode = "recent" | "price_asc" | "popular"

const filterLabels: Record<QuickFilter, string> = {
  all: "Todos",
  packs: "Packs",
  sebentas: "Sebentas",
  services: "Explicacoes",
  free: "Gratis",
}

const sortLabels: Record<SortMode, string> = {
  recent: "Mais recentes",
  price_asc: "Preco: baixo a alto",
  popular: "Destaques primeiro",
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

  const filteredProducts = sortProducts(
    (products ?? []).filter((product) => {
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
    }),
    sortMode,
  )

  return (
    <div className="bg-[#f7fcff] text-[#14384d]">
      <main className="container pb-16 pt-12 md:pb-20 md:pt-16">
        <header className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#577286]">Catalogo Mariana Explica</p>
          <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-[#102b3c] md:text-5xl">
            Escolhe o curso certo para o teu momento de estudo.
          </h1>
          <p className="max-w-3xl text-base leading-8 text-[#46687d] md:text-lg">
            Encontra packs, sebentas, materiais gratuitos e apoio especializado com uma navegacao simples e orientada para decisao rapida.
          </p>
        </header>

        <section className="mt-8 rounded-[1.5rem] border border-[#d4e7f0] bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(Object.keys(filterLabels) as QuickFilter[]).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setQuickFilter(filterKey)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
                    quickFilter === filterKey
                      ? "bg-[#123f59] text-white"
                      : "bg-[#edf6fb] text-[#31556c] hover:bg-[#e3f0f7]"
                  }`}
                >
                  {filterLabels[filterKey]}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#527187]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar por curso, tema ou descricao..."
                  className="h-11 w-full rounded-full border border-[#c9dde8] bg-[#f8fcff] pl-10 pr-4 text-sm outline-none transition focus:border-[#33729a] focus:bg-white"
                />
              </div>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 rounded-full border border-[#c9dde8] bg-white px-4 text-sm font-semibold text-[#21485f] outline-none transition focus:border-[#33729a]"
              >
                {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {sortLabels[mode]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-[#e6f0f5] pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5a7386]">
              {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
            </p>
            <Button variant="outline" asChild className="w-full rounded-full border-[#c8dde8] md:w-auto">
              <Link to="/suporte">Precisas de ajuda para escolher?</Link>
            </Button>
          </div>
        </section>

        <section className="mt-10">
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
                  ? "Experimenta outro termo de pesquisa ou limpa os filtros."
                  : "Ainda nao ha cursos publicados para mostrar."
              }
            />
          ) : null}

          {!isLoading && !isError && filteredProducts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const enrolledAction = getEnrolledCourseAction(findEnrolledCourse(product.id, enrolledCourses))

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    actionTo={enrolledAction?.to ?? publicCoursePath(product.slug, product.id)}
                    actionLabel={enrolledAction?.label ?? "Ver detalhes"}
                  />
                )
              })}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

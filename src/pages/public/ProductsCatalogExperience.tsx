import { useDeferredValue, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { usePublishedFaqCategories, usePublishedFaqs } from "@/hooks/useFaqs"
import { usePublishedProductCategories, usePublishedProducts } from "@/hooks/useProducts"
import { ROUTES } from "@/lib/constants"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { buildDefaultFaqCategories, buildDefaultFaqs } from "@/lib/faq-defaults"
import { inferProductCategorySlug } from "@/lib/product-categories"
import { getProductFamilyLabel } from "@/lib/product-presentation"
import { publicCoursePath } from "@/lib/routes"
import type { FaqCategorySummary, FaqSummary } from "@/types/faq.types"
import type { ProductCategorySummary, ProductSummary } from "@/types/product.types"

type SortMode = "recent" | "price_asc" | "popular"

type PublicCategoryOption = Pick<
  ProductCategorySummary,
  "id" | "slug" | "title" | "description" | "sort_order" | "is_active"
>

const DEFAULT_PUBLIC_CATEGORIES: PublicCategoryOption[] = [
  { id: "packs-poupanca", slug: "packs-poupanca", title: "Packs poupanca", description: null, sort_order: 1, is_active: true },
  { id: "sebentas-individuais", slug: "sebentas-individuais", title: "Sebentas individuais", description: null, sort_order: 2, is_active: true },
  { id: "explicacoes", slug: "explicacoes", title: "Explicacoes", description: null, sort_order: 3, is_active: true },
  { id: "gratuitos", slug: "gratuitos", title: "Gratuitos", description: null, sort_order: 4, is_active: true },
]

const SORT_LABELS: Record<SortMode, string> = {
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
    return next.sort(
      (left, right) => Number(right.is_featured) - Number(left.is_featured) || left.sort_order - right.sort_order,
    )
  }

  return next.sort((left, right) => {
    const leftDate = Date.parse(left.published_at ?? left.launch_date ?? "")
    const rightDate = Date.parse(right.published_at ?? right.launch_date ?? "")
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate)
  })
}

export function ProductsCatalogExperience() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const deferredSearch = useDeferredValue(search)
  const { data: products, isLoading, isError, error, refetch } = usePublishedProducts()
  const { data: categoriesFromDb } = usePublishedProductCategories()
  const { data: faqCategoriesFromDb } = usePublishedFaqCategories()
  const { data: faqsFromDb } = usePublishedFaqs()
  const { data: enrolledCourses } = useMyProducts({ enabled: Boolean(session) })

  const categories = useMemo(() => {
    if (!categoriesFromDb) {
      return DEFAULT_PUBLIC_CATEGORIES
    }

    return categoriesFromDb.filter((category) => category.is_active)
  }, [categoriesFromDb])

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const categoriesBySlug = useMemo(() => new Map(categories.map((category) => [category.slug, category])), [categories])

  const faqCategories = useMemo<FaqCategorySummary[]>(() => {
    return faqCategoriesFromDb && faqCategoriesFromDb.length > 0
      ? faqCategoriesFromDb
      : buildDefaultFaqCategories()
  }, [faqCategoriesFromDb])

  const faqCategoryById = useMemo(
    () => new Map(faqCategories.map((category) => [category.id, category])),
    [faqCategories],
  )

  const faqs = useMemo<FaqSummary[]>(() => {
    return faqsFromDb && faqsFromDb.length > 0 ? faqsFromDb : buildDefaultFaqs(faqCategories)
  }, [faqCategories, faqsFromDb])

  const currentCategorySlug = searchParams.get("categoria")?.trim().toLowerCase() ?? ""
  const selectedCategorySlug =
    currentCategorySlug && categoriesBySlug.has(currentCategorySlug) ? currentCategorySlug : "all"

  function setCategoryFilter(categorySlug: string) {
    if (categorySlug === "all") {
      setSearchParams({})
      return
    }

    setSearchParams({ categoria: categorySlug })
  }

  function resolveCategorySlugForProduct(product: ProductSummary) {
    if (product.category_id && categoriesById.has(product.category_id)) {
      return categoriesById.get(product.category_id)?.slug ?? inferProductCategorySlug(product)
    }

    return inferProductCategorySlug(product)
  }

  const filteredProducts = useMemo(
    () =>
      sortProducts(
        (products ?? []).filter((product) => {
          const categorySlug = resolveCategorySlugForProduct(product)
          const categoryTitle = categoriesBySlug.get(categorySlug)?.title ?? ""
          const haystack = [
            product.title,
            product.short_description ?? "",
            product.description ?? "",
            product.product_type,
            getProductFamilyLabel(product),
            categorySlug,
            categoryTitle,
          ]
            .join(" ")
            .toLowerCase()

          const matchesSearch = haystack.includes(deferredSearch.trim().toLowerCase())
          const matchesCategory = selectedCategorySlug === "all" || categorySlug === selectedCategorySlug

          return matchesSearch && matchesCategory
        }),
        sortMode,
      ),
    [categoriesBySlug, deferredSearch, products, selectedCategorySlug, sortMode],
  )

  return (
    <section className="space-y-8 pt-6">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/60 p-5 shadow-[0_24px_70px_rgba(19,54,75,0.08)] backdrop-blur">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`min-w-[110px] rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${
              selectedCategorySlug === "all" ? "bg-[#1d2340] text-white" : "bg-[#28304f] text-white hover:bg-[#1d2340]"
            }`}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => setCategoryFilter(category.slug)}
              className={`min-w-[110px] rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${
                selectedCategorySlug === category.slug
                  ? "bg-[#1d2340] text-white"
                  : "bg-[#28304f] text-white hover:bg-[#1d2340]"
              }`}
            >
              {category.title}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a7386]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por material, tema ou descricao..."
              className="h-12 w-full rounded-full border border-[#c8d9e4] bg-white/90 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#7c97a8] focus:border-[#617ea1] focus:bg-white"
            />
          </div>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-12 rounded-full border border-[#c8d9e4] bg-white px-4 text-sm font-semibold text-[#21485f] outline-none transition focus:border-[#617ea1]"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/70 pt-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#5a7386]">
            {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
          </p>
          <Button asChild variant="outline" className="rounded-full border-[#c5d7e2] bg-white/90 md:w-auto">
            <Link to={ROUTES.SUPPORT}>Precisas de ajuda a escolher?</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">
        <div>
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
              title="Nenhum material encontrado"
              message={
                search.trim()
                  ? "Experimenta outro termo de pesquisa ou limpa os filtros."
                  : "Ainda nao ha materiais publicados para mostrar."
              }
            />
          ) : null}
          {!isLoading && !isError && filteredProducts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
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
        </div>

        <aside className="rounded-[1.75rem] border border-white/70 bg-white/60 p-6 shadow-[0_24px_70px_rgba(19,54,75,0.08)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#4e6880]">FAQ em destaque</p>
          <h3 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-[#1b2644]">
            Duvidas comuns antes de comprares
          </h3>
          <div className="mt-6 space-y-4">
            {faqs.slice(0, 4).map((faqItem) => {
              const category = faqCategoryById.get(faqItem.category_id)

              return (
                <details key={faqItem.id} className="rounded-[1.1rem] border border-white/70 bg-white/90 px-4 py-3 shadow-sm">
                  <summary className="cursor-pointer list-none font-semibold text-[#1b2644]">
                    {faqItem.question}
                  </summary>
                  <div className="mt-3 space-y-2 text-sm leading-7 text-[#41586c]">
                    <p>{faqItem.answer}</p>
                    {category ? (
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7b94a7]">
                        {category.title}
                      </p>
                    ) : null}
                  </div>
                </details>
              )
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-[#28304f] text-white hover:bg-[#1d2340]">
              <Link to={ROUTES.SUPPORT}>Ir para suporte</Link>
            </Button>
          </div>
        </aside>
      </div>
    </section>
  )
}

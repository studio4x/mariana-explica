import { useDeferredValue, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Search } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { usePublishedProductCategories, usePublishedProducts } from "@/hooks/useProducts"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { inferProductCategorySlug } from "@/lib/product-categories"
import { getProductFamilyLabel } from "@/lib/product-presentation"
import { publicCoursePath } from "@/lib/routes"
import type { ProductCategorySummary, ProductSummary } from "@/types/product.types"

type SortMode = "recent" | "price_asc" | "popular"

type PublicCategoryOption = Pick<
  ProductCategorySummary,
  "id" | "slug" | "title" | "description" | "sort_order" | "is_active"
>

const DEFAULT_PUBLIC_CATEGORIES: PublicCategoryOption[] = [
  { id: "packs-poupanca", slug: "packs-poupanca", title: "Packs poupança", description: null, sort_order: 1, is_active: true },
  { id: "sebentas-individuais", slug: "sebentas-individuais", title: "Sebentas individuais", description: null, sort_order: 2, is_active: true },
  { id: "explicacoes", slug: "explicacoes", title: "Explicações", description: null, sort_order: 3, is_active: true },
  { id: "gratuitos", slug: "gratuitos", title: "Gratuitos", description: null, sort_order: 4, is_active: true },
]

const sortLabels: Record<SortMode, string> = {
  recent: "Mais recentes",
  price_asc: "Preço: baixo a alto",
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const deferredSearch = useDeferredValue(search)
  const { data: products, isLoading, isError, error, refetch } = usePublishedProducts()
  const { data: categoriesFromDb } = usePublishedProductCategories()
  const { data: enrolledCourses } = useMyProducts({ enabled: Boolean(session) })

  const categories = useMemo(() => {
    if (!categoriesFromDb) {
      return DEFAULT_PUBLIC_CATEGORIES
    }

    return categoriesFromDb.filter((category) => category.is_active)
  }, [categoriesFromDb])

  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]))
  }, [categories])

  const categoriesBySlug = useMemo(() => {
    return new Map(categories.map((category) => [category.slug, category]))
  }, [categories])

  const currentCategorySlug = searchParams.get("categoria")?.trim().toLowerCase() ?? ""
  const selectedCategorySlug = currentCategorySlug && categoriesBySlug.has(currentCategorySlug) ? currentCategorySlug : "all"

  const setCategoryFilter = (categorySlug: string) => {
    if (categorySlug === "all") {
      setSearchParams({})
      return
    }

    setSearchParams({ categoria: categorySlug })
  }

  const resolveCategorySlugForProduct = (product: ProductSummary) => {
    if (product.category_id && categoriesById.has(product.category_id)) {
      return categoriesById.get(product.category_id)?.slug ?? inferProductCategorySlug(product)
    }

    return inferProductCategorySlug(product)
  }

  const filteredProducts = sortProducts(
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
  )

  return (
    <div className="relative overflow-hidden bg-[#dff0f7] text-[#14384d]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-7rem] top-[-7rem] h-64 w-64 rounded-full bg-white/45 blur-3xl" />
        <div className="absolute right-[-5rem] top-40 h-80 w-80 rounded-full bg-[#b9d9ea]/45 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-[#4e6880]">Materiais</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-[#1b2644] md:text-6xl">
            Tudo o que precisas para brilhares
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#41586c] md:text-lg">
            Encontra aqui os teus melhores amigos de estudo: resumos leves, esquemas práticos e o apoio certo para
            dominares o português e a filosofia sem stress.
          </p>
        </header>

        <section className="mx-auto mt-10 max-w-6xl">
          <div className="rounded-[2rem] border border-white/80 bg-white/50 p-5 shadow-[0_24px_70px_rgba(19,54,75,0.08)] backdrop-blur">
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`min-w-[110px] rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${
                  selectedCategorySlug === "all"
                    ? "bg-[#1d2340] text-white shadow-sm ring-2 ring-white/55 ring-offset-2 ring-offset-transparent"
                    : "bg-[#28304f] text-white hover:bg-[#1d2340]"
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
                      ? "bg-[#1d2340] text-white shadow-sm ring-2 ring-white/55 ring-offset-2 ring-offset-transparent"
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
                  placeholder="Pesquisar por material, tema ou descrição..."
                  className="h-12 w-full rounded-full border border-[#c8d9e4] bg-white/90 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#7c97a8] focus:border-[#617ea1] focus:bg-white"
                />
              </div>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-12 rounded-full border border-[#c8d9e4] bg-white px-4 text-sm font-semibold text-[#21485f] outline-none transition focus:border-[#617ea1]"
              >
                {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {sortLabels[mode]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white/70 pt-4 text-center md:flex-row md:text-left">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#5a7386]">
                {filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}
              </p>
              <Button variant="outline" asChild className="w-full rounded-full border-[#c5d7e2] bg-white/90 md:w-auto">
                <Link to="/suporte">Precisas de ajuda para escolher?</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-12">
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

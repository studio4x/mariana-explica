import { Link } from "react-router-dom"
import { Search, Sparkles } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { ROUTES } from "@/lib/constants"
import { usePublishedProducts } from "@/hooks/useProducts"
import { getProductFamilyLabel } from "@/lib/product-presentation"

type QuickFilter = "all" | "packs" | "sebentas" | "free" | "services"

const filterLabels: Record<QuickFilter, string> = {
  all: "Todos",
  packs: "Packs",
  sebentas: "Sebentas",
  free: "Gratuitos",
  services: "Explicacoes",
}

export function Products() {
  const [search, setSearch] = useState("")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")
  const deferredSearch = useDeferredValue(search)
  const { data: products, isLoading, isError, error, refetch } = usePublishedProducts()

  const filteredProducts = (products ?? []).filter((product) => {
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
  })

  return (
    <div className="container space-y-8 py-10 md:py-12">
      <section className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,#f7fbfd_0%,#edf7fb_48%,#ffffff_100%)] p-6 shadow-sm md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700">
              <Sparkles className="h-4 w-4 text-primary" />
              Catalogo pensado para escolher sem confusao
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">
                Encontra o produto certo para o teu momento de estudo.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-600">
                Aqui o foco nao e mostrar uma lista fria. A ideia e ajudar-te a perceber rapidamente se precisas de um pack, uma sebenta, um material gratuito ou um apoio mais acompanhado.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Caminhos rapidos</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(filterLabels) as QuickFilter[]).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setQuickFilter(filterKey)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    quickFilter === filterKey
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {filterLabels[filterKey]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-[1.75rem] border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por tema, produto ou descricao..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="rounded-full">
              <Link to={ROUTES.HOME}>Voltar a home</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to={ROUTES.REGISTER}>Criar conta</Link>
            </Button>
          </div>
        </div>
      </div>

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
          title="Nenhum produto encontrado"
          message={
            search.trim()
              ? "Experimenta outro termo de pesquisa ou limpa o filtro."
              : "Ainda nao ha produtos publicados para mostrar."
          }
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            actionTo={`/produto/${product.slug}`}
            actionLabel="Ver detalhes"
            compact
          />
        ))}
      </div>

      {!isLoading && !isError ? (
        <p className="text-sm text-muted-foreground">
          {filteredProducts.length} produto{filteredProducts.length === 1 ? "" : "s"} encontrado{filteredProducts.length === 1 ? "" : "s"}.
          {quickFilter !== "all" ? ` Filtro ativo: ${filterLabels[quickFilter].toLowerCase()}.` : ""}
        </p>
      ) : null}
    </div>
  )
}

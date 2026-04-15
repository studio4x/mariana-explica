import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader } from "@/components/common"
import { ProductCard } from "@/components/product"
import { ROUTES } from "@/lib/constants"
import { usePublishedProducts } from "@/hooks/useProducts"

export function Products() {
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const { data: products, isLoading, isError, error, refetch } = usePublishedProducts()

  const filteredProducts = (products ?? []).filter((product) => {
    const haystack = [
      product.title,
      product.short_description ?? "",
      product.description ?? "",
      product.product_type,
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(deferredSearch.trim().toLowerCase())
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Catálogo de produtos"
        description="Produtos publicados e prontos para compra."
      />

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, descrição ou tipo..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>
          <Button variant="outline" asChild>
            <Link to={ROUTES.HOME}>Voltar para a home</Link>
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingState message="Carregando catálogo..." /> : null}
      {isError ? (
        <ErrorState
          title="Falha ao carregar catálogo"
          message={error instanceof Error ? error.message : "Tente novamente em instantes."}
          onRetry={() => void refetch()}
        />
      ) : null}
      {!isLoading && !isError && filteredProducts.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          message={
            search.trim()
              ? "Tente outro termo de busca ou limpe o filtro."
              : "Ainda não há produtos publicados para exibir."
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
        </p>
      ) : null}
    </div>
  )
}


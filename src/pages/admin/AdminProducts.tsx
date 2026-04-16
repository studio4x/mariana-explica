import { useDeferredValue, useState, type FormEvent } from "react"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import {
  useAdminProducts,
  useArchiveAdminProduct,
  useCreateAdminProduct,
  usePublishAdminProduct,
} from "@/hooks/useAdmin"
import { formatProductPrice } from "@/utils/currency"

const typeLabels: Record<string, string> = {
  paid: "Pago",
  free: "Gratuito",
  hybrid: "Hibrido",
  external_service: "Servico externo",
}

export function AdminProducts() {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [priceCents, setPriceCents] = useState("0")
  const [productType, setProductType] = useState<"paid" | "free" | "hybrid" | "external_service">("paid")
  const [description, setDescription] = useState("")
  const [query, setQuery] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)
  const productsQuery = useAdminProducts()
  const createProduct = useCreateAdminProduct()
  const publishProduct = usePublishAdminProduct()
  const archiveProduct = useArchiveAdminProduct()

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    try {
      await createProduct.mutateAsync({
        title,
        slug,
        productType,
        priceCents: Number(priceCents),
        description,
        salesPageEnabled: true,
        requiresAuth: true,
        allowAffiliate: true,
        isFeatured: false,
      })
      setTitle("")
      setSlug("")
      setPriceCents("0")
      setDescription("")
      setProductType("paid")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel criar o produto.")
    }
  }

  if (productsQuery.isLoading) {
    return <LoadingState message="A carregar produtos..." />
  }

  if (productsQuery.isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar os produtos"
        message={productsQuery.error instanceof Error ? productsQuery.error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void productsQuery.refetch()}
      />
    )
  }

  const products = productsQuery.data ?? []
  const q = deferredQuery.trim().toLowerCase()
  const filteredProducts = !q
    ? products
    : products.filter((product) =>
        [product.title, product.slug, product.description ?? "", product.status]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
  const publishedCount = products.filter((product) => product.status === "published").length
  const draftCount = products.filter((product) => product.status === "draft").length

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" description="Criacao, publicacao e arquivamento com leitura mais direta da operacao." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total de produtos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{products.length}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Publicados</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{publishedCount}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Rascunhos</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{draftCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form onSubmit={handleCreate} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Criacao de produto</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Novo produto</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titulo" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug-do-produto" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
            <input value={priceCents} onChange={(event) => setPriceCents(event.target.value)} placeholder="Preco em cents" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
            <select value={productType} onChange={(event) => setProductType(event.target.value as typeof productType)} className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white">
              <option value="paid">Pago</option>
              <option value="free">Gratuito</option>
              <option value="hybrid">Hibrido</option>
              <option value="external_service">Servico externo</option>
            </select>
          </div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descricao curta do produto" rows={4} className="mt-4 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <Button type="submit" className="mt-4 rounded-full" disabled={createProduct.isPending}>
            {createProduct.isPending ? "A criar..." : "Criar produto"}
          </Button>
          {submitError ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}
        </form>

        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Leitura editorial</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">O que rever antes de publicar</h2>
          <div className="mt-5 grid gap-3">
            {[
              "Titulo e slug devem ser claros, coerentes e facilmente reconheciveis no catalogo.",
              "Descricao curta precisa de explicar o valor do produto sem cair em texto generico.",
              "Estado e preco devem refletir exatamente o que o frontend e o checkout vao mostrar.",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50/80 p-4 text-sm leading-7 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950">Catalogo interno</h2>
            <p className="mt-1 text-sm text-slate-600">Pesquisa rapida por titulo, slug ou estado.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar..."
            className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white md:w-72"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Sem produtos" message="Os produtos publicados ou em rascunho vao aparecer aqui." />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Produto</th>
                  <th className="py-3 pr-4 font-medium">Tipo</th>
                  <th className="py-3 pr-4 font-medium">Estado</th>
                  <th className="py-3 pr-4 font-medium">Preco</th>
                  <th className="py-3 pr-4 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-b-0 align-top">
                    <td className="py-4 pr-4">
                      <p className="font-medium text-slate-900">{product.title}</p>
                      <p className="mt-1 text-slate-600">{product.slug}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge label={typeLabels[product.product_type] ?? product.product_type} tone="info" />
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge
                        label={product.status}
                        tone={product.status === "published" ? "success" : product.status === "archived" ? "danger" : "warning"}
                      />
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {formatProductPrice(product.price_cents, product.currency)}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="grid gap-2 md:max-w-[180px]">
                        <Button variant="outline" className="justify-start rounded-full" onClick={() => void publishProduct.mutateAsync(product.id)} disabled={publishProduct.isPending || product.status === "published"}>
                          Publicar
                        </Button>
                        <Button variant="outline" className="justify-start rounded-full" onClick={() => void archiveProduct.mutateAsync(product.id)} disabled={archiveProduct.isPending || product.status === "archived"}>
                          Arquivar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

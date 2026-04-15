import { useState, type FormEvent } from "react"
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

export function AdminProducts() {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [priceCents, setPriceCents] = useState("0")
  const [productType, setProductType] = useState<"paid" | "free" | "hybrid" | "external_service">("paid")
  const [description, setDescription] = useState("")
  const productsQuery = useAdminProducts()
  const createProduct = useCreateAdminProduct()
  const publishProduct = usePublishAdminProduct()
  const archiveProduct = useArchiveAdminProduct()

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
  }

  if (productsQuery.isLoading) {
    return <LoadingState message="Carregando produtos..." />
  }

  if (productsQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os produtos"
        message={productsQuery.error instanceof Error ? productsQuery.error.message : "Tente novamente em instantes."}
        onRetry={() => void productsQuery.refetch()}
      />
    )
  }

  const products = productsQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" description="Criação, publicação e arquivamento." />

      <form onSubmit={handleCreate} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Novo produto</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug-do-produto" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <input value={priceCents} onChange={(event) => setPriceCents(event.target.value)} placeholder="Preço em cents" className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white" />
          <select value={productType} onChange={(event) => setProductType(event.target.value as typeof productType)} className="h-11 rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white">
            <option value="paid">paid</option>
            <option value="free">free</option>
            <option value="hybrid">hybrid</option>
            <option value="external_service">external_service</option>
          </select>
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição" rows={4} className="mt-4 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white" />
        <Button type="submit" className="mt-4" disabled={createProduct.isPending}>
          {createProduct.isPending ? "Criando..." : "Criar produto"}
        </Button>
      </form>

      {products.length === 0 ? (
        <EmptyState title="Sem produtos" message="Os produtos da operação aparecem aqui." />
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">{product.title}</h2>
                    <StatusBadge label={product.status} tone={product.status === "published" ? "success" : product.status === "archived" ? "danger" : "warning"} />
                    <StatusBadge label={product.product_type} tone="info" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{product.description ?? product.short_description ?? "Sem descrição adicional."}</p>
                  <p className="mt-3 text-sm font-medium text-slate-900">
                    {formatProductPrice(product.price_cents, product.currency)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => void publishProduct.mutateAsync(product.id)} disabled={publishProduct.isPending || product.status === "published"}>
                    Publicar
                  </Button>
                  <Button variant="outline" onClick={() => void archiveProduct.mutateAsync(product.id)} disabled={archiveProduct.isPending || product.status === "archived"}>
                    Arquivar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

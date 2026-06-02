import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui"
import {
  useAdminProductCategories,
  useCreateAdminProductCategory,
  useDeleteAdminProductCategory,
  useUpdateAdminProductCategory,
} from "@/hooks/useAdmin"
import { inferProductCategorySlug, normalizeCategorySlug } from "@/lib/product-categories"
import type { ProductSummary } from "@/types/product.types"

interface CategoryFormState {
  slug: string
  title: string
  description: string
  sortOrder: string
  isActive: boolean
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildDefaultCategoryForm(nextSortOrder: number): CategoryFormState {
  return {
    slug: "",
    title: "",
    description: "",
    sortOrder: String(nextSortOrder),
    isActive: true,
  }
}

export function AdminProductCategoriesPanel({ products }: { products: ProductSummary[] }) {
  const { data: categories = [], isLoading, isError, error, refetch } = useAdminProductCategories()
  const createCategory = useCreateAdminProductCategory()
  const updateCategory = useUpdateAdminProductCategory()
  const deleteCategory = useDeleteAdminProductCategory()
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryFormState>(() => buildDefaultCategoryForm(1))
  const [submitError, setSubmitError] = useState<string | null>(null)

  const categoryCounts = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]))
    const counts = new Map<string, number>()

    for (const product of products) {
      const categorySlug =
        product.category_id && byId.get(product.category_id)
          ? byId.get(product.category_id)?.slug
          : inferProductCategorySlug(product)
      const slug = normalizeCategorySlug(categorySlug)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }

    return counts
  }, [categories, products])

  const activeCount = categories.filter((category) => category.is_active).length

  const resetForm = () => {
    setEditingCategoryId(null)
    setForm(buildDefaultCategoryForm(categories.length + 1))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const slug = normalizeCategorySlug(form.slug || form.title)
    const title = form.title.trim()

    if (!slug || !title) {
      setSubmitError("Título e slug da categoria são obrigatorios.")
      return
    }

    try {
      if (editingCategoryId) {
        await updateCategory.mutateAsync({
          categoryId: editingCategoryId,
          slug,
          title,
          description: form.description.trim() || null,
          sortOrder: Number(form.sortOrder || 0),
          isActive: form.isActive,
        })
      } else {
        await createCategory.mutateAsync({
          slug,
          title,
          description: form.description.trim() || null,
          sortOrder: Number(form.sortOrder || 0),
          isActive: form.isActive,
        })
      }

      resetForm()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Não foi possível guardar a categoria.")
    }
  }

  const handleEdit = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) return

    setEditingCategoryId(category.id)
    setForm({
      slug: category.slug,
      title: category.title,
      description: category.description ?? "",
      sortOrder: String(category.sort_order ?? categories.length + 1),
      isActive: category.is_active,
    })
    setSubmitError(null)
  }

  const handleDelete = async (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) return

    const categoryCount = categoryCounts.get(normalizeCategorySlug(category.slug)) ?? 0
    const confirmed = window.confirm(
      `Excluir a categoria "${category.title}"? ${categoryCount} material(is) vao ficar sem categoria associada e passar a usar a classificação automática no catálogo.`,
    )
    if (!confirmed) return

    setSubmitError(null)

    try {
      await deleteCategory.mutateAsync(categoryId)
      if (editingCategoryId === categoryId) {
        resetForm()
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Não foi possível excluir a categoria.")
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
            <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-24 w-full animate-pulse rounded-2xl bg-slate-200" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-8 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
                <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error instanceof Error ? error.message : "Não foi possível carregar as categorias."}
        </div>
        <div className="mt-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Categorias de materiais</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Organiza os filtros do catálogo público</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Cria, edita e remove categorias para controlar os botões de filtro em Materiais e a classificação
            associada aos materiais no admin.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Categorias ativas</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{activeCount}</p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{categories.length}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                {editingCategoryId ? "Editar categoria" : "Nova categoria"}
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">
                {editingCategoryId ? "Atualiza o filtro existente" : "Adicionar categoria"}
              </h3>
            </div>
            {editingCategoryId ? (
              <Button type="button" variant="ghost" className="rounded-full text-slate-500" onClick={resetForm}>
                Limpar
              </Button>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-800">Título</span>
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
                placeholder="Packs poupança"
                className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-800">Slug</span>
              <input
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: normalizeCategorySlug(event.target.value) }))}
                placeholder="packs-poupanca"
                className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-800">Descrição</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                placeholder="Texto curto para contextualizar a categoria"
                className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-800">Ordem</span>
                <input
                  value={form.sortOrder}
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Ativa</span>
                  <span className="mt-1 block text-slate-500">Categorias inativas continuam no admin, mas somem dos filtros públicos.</span>
                </span>
              </label>
            </div>

            {submitError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                className="rounded-full"
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {createCategory.isPending || updateCategory.isPending
                  ? "A guardar..."
                  : editingCategoryId
                    ? "Atualizar categoria"
                    : "Criar categoria"}
              </Button>
              {editingCategoryId ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : null}
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const count = categoryCounts.get(normalizeCategorySlug(category.slug)) ?? 0

              return (
                <article
                  key={category.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-950">{category.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {category.slug}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                        category.is_active
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {category.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {category.description || "Sem descrição definida para esta categoria."}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Materiais</p>
                      <p className="mt-1 text-xl font-bold text-slate-950">{count}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-slate-200 px-4"
                        onClick={() => handleEdit(category.id)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-rose-200 px-4 text-rose-700 hover:bg-rose-50"
                        onClick={() => void handleDelete(category.id)}
                        disabled={deleteCategory.isPending}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {!categories.length ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Ainda não existem categorias configuradas. Cria a primeira para ligar os materiais aos filtros públicos.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

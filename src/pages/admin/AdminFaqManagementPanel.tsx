import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { FolderOpen, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui"
import {
  useAdminFaqCategories,
  useAdminFaqs,
  useCreateAdminFaq,
  useCreateAdminFaqCategory,
  useDeleteAdminFaq,
  useDeleteAdminFaqCategory,
  useUpdateAdminFaq,
  useUpdateAdminFaqCategory,
} from "@/hooks/useAdmin"
import type { FaqCategorySummary, FaqSummary } from "@/types/faq.types"

type AdminFaqTab = "questions" | "categories"

interface FaqCategoryFormState {
  slug: string
  title: string
  description: string
  sortOrder: string
  isActive: boolean
}

interface FaqFormState {
  categoryId: string
  question: string
  answer: string
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

function buildDefaultCategoryForm(sortOrder: number): FaqCategoryFormState {
  return {
    slug: "",
    title: "",
    description: "",
    sortOrder: String(sortOrder),
    isActive: true,
  }
}

function buildDefaultFaqForm(categoryId = ""): FaqFormState {
  return {
    categoryId,
    question: "",
    answer: "",
    sortOrder: "0",
    isActive: true,
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

function FaqSkeleton() {
  return (
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-3 h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-3 h-24 w-full animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
              <div className="h-4 w-56 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function AdminFaqManagementPanel() {
  const categoriesQuery = useAdminFaqCategories()
  const faqsQuery = useAdminFaqs()
  const createCategory = useCreateAdminFaqCategory()
  const updateCategory = useUpdateAdminFaqCategory()
  const deleteCategory = useDeleteAdminFaqCategory()
  const createFaq = useCreateAdminFaq()
  const updateFaq = useUpdateAdminFaq()
  const deleteFaq = useDeleteAdminFaq()
  const [activeTab, setActiveTab] = useState<AdminFaqTab>("questions")
  const [categoryForm, setCategoryForm] = useState<FaqCategoryFormState>(() => buildDefaultCategoryForm(1))
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [faqForm, setFaqForm] = useState<FaqFormState>(() => buildDefaultFaqForm())
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [faqError, setFaqError] = useState<string | null>(null)
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false)

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const faqs = useMemo(() => faqsQuery.data ?? [], [faqsQuery.data])
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const faqCountByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const faq of faqs) {
      counts.set(faq.category_id, (counts.get(faq.category_id) ?? 0) + 1)
    }
    return counts
  }, [faqs])

  const groupedFaqs = useMemo(() => {
    const groups: Array<{ category: FaqCategorySummary | null; faqs: FaqSummary[] }> = []
    const sortedCategories = [...categories].sort(
      (left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title),
    )

    for (const category of sortedCategories) {
      groups.push({
        category,
        faqs: faqs
          .filter((faq) => faq.category_id === category.id)
          .sort((left, right) => left.sort_order - right.sort_order || left.question.localeCompare(right.question)),
      })
    }

    const uncategorizedFaqs = faqs
      .filter((faq) => !categoryById.has(faq.category_id))
      .sort((left, right) => left.sort_order - right.sort_order || left.question.localeCompare(right.question))

    if (uncategorizedFaqs.length > 0) {
      groups.push({
        category: null,
        faqs: uncategorizedFaqs,
      })
    }

    return groups
  }, [categories, categoryById, faqs])

  useEffect(() => {
    if (faqForm.categoryId || categories.length === 0) return
    setFaqForm((current) => ({ ...current, categoryId: categories[0].id }))
  }, [categories, faqForm.categoryId])

  useEffect(() => {
    if (!editingFaqId && !faqForm.categoryId && categories.length > 0) {
      setFaqForm((current) => ({ ...current, categoryId: categories[0].id }))
    }
  }, [categories, editingFaqId, faqForm.categoryId])

  const resetCategoryForm = () => {
    setEditingCategoryId(null)
    setCategoryForm(buildDefaultCategoryForm(categories.length + 1))
  }

  const resetFaqForm = () => {
    setEditingFaqId(null)
    setFaqForm(buildDefaultFaqForm(categories[0]?.id ?? ""))
  }

  const openFaqModal = (categoryId?: string) => {
    setActiveTab("questions")
    setEditingFaqId(null)
    setFaqError(null)
    setFaqForm(buildDefaultFaqForm(categoryId ?? categories[0]?.id ?? ""))
    setIsFaqModalOpen(true)
  }

  const closeFaqModal = () => {
    setIsFaqModalOpen(false)
    setFaqError(null)
    resetFaqForm()
  }

  const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCategoryError(null)

    const slug = slugify(categoryForm.slug || categoryForm.title)
    const title = categoryForm.title.trim()

    if (!slug || !title) {
      setCategoryError("Titulo e slug da categoria sao obrigatorios.")
      return
    }

    try {
      if (editingCategoryId) {
        await updateCategory.mutateAsync({
          categoryId: editingCategoryId,
          slug,
          title,
          description: categoryForm.description.trim() || null,
          sortOrder: Number(categoryForm.sortOrder || 0),
          isActive: categoryForm.isActive,
        })
      } else {
        const created = await createCategory.mutateAsync({
          slug,
          title,
          description: categoryForm.description.trim() || null,
          sortOrder: Number(categoryForm.sortOrder || 0),
          isActive: categoryForm.isActive,
        })

        setFaqForm((current) => (current.categoryId ? current : { ...current, categoryId: created.id }))
      }

      resetCategoryForm()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Nao foi possivel guardar a categoria.")
    }
  }

  const handleFaqSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFaqError(null)

    const categoryId = faqForm.categoryId.trim()
    const question = faqForm.question.trim()
    const answer = faqForm.answer.trim()

    if (!categoryId || !question || !answer) {
      setFaqError("Categoria, pergunta e resposta sao obrigatorias.")
      return
    }

    try {
      if (editingFaqId) {
        await updateFaq.mutateAsync({
          faqId: editingFaqId,
          categoryId,
          question,
          answer,
          sortOrder: Number(faqForm.sortOrder || 0),
          isActive: faqForm.isActive,
        })
      } else {
        await createFaq.mutateAsync({
          categoryId,
          question,
          answer,
          sortOrder: Number(faqForm.sortOrder || 0),
          isActive: faqForm.isActive,
        })
      }

      closeFaqModal()
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : "Nao foi possivel guardar a pergunta frequente.")
    }
  }

  const handleEditCategory = (category: FaqCategorySummary) => {
    setActiveTab("categories")
    setEditingCategoryId(category.id)
    setCategoryForm({
      slug: category.slug,
      title: category.title,
      description: category.description ?? "",
      sortOrder: String(category.sort_order ?? categories.length + 1),
      isActive: category.is_active,
    })
    setCategoryError(null)
  }

  const handleDeleteCategory = async (category: FaqCategorySummary) => {
    const totalFaqs = faqCountByCategory.get(category.id) ?? 0
    if (totalFaqs > 0) {
      setCategoryError(`A categoria "${category.title}" ainda tem ${totalFaqs} pergunta(s) associada(s). Reatribui antes de excluir.`)
      return
    }

    const confirmed = window.confirm(`Excluir a categoria "${category.title}"?`)
    if (!confirmed) return

    try {
      await deleteCategory.mutateAsync(category.id)
      if (editingCategoryId === category.id) {
        resetCategoryForm()
      }
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Nao foi possivel excluir a categoria.")
    }
  }

  const handleEditFaq = (faq: FaqSummary) => {
    setActiveTab("questions")
    setEditingFaqId(faq.id)
    setFaqForm({
      categoryId: faq.category_id,
      question: faq.question,
      answer: faq.answer,
      sortOrder: String(faq.sort_order ?? 0),
      isActive: faq.is_active,
    })
    setFaqError(null)
    setIsFaqModalOpen(true)
  }

  const handleDeleteFaq = async (faq: FaqSummary) => {
    const confirmed = window.confirm(`Excluir a pergunta "${faq.question}"?`)
    if (!confirmed) return

    try {
      await deleteFaq.mutateAsync(faq.id)
      if (editingFaqId === faq.id) {
        resetFaqForm()
      }
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : "Nao foi possivel excluir a pergunta.")
    }
  }

  const prepareNewFaqForCategory = (categoryId: string) => {
    openFaqModal(categoryId)
  }

  if (categoriesQuery.isLoading || faqsQuery.isLoading) {
    return <FaqSkeleton />
  }

  if (categoriesQuery.isError || faqsQuery.isError) {
    const message =
      categoriesQuery.error instanceof Error
        ? categoriesQuery.error.message
        : faqsQuery.error instanceof Error
          ? faqsQuery.error.message
          : "Nao foi possivel carregar as perguntas frequentes."

    return (
      <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void categoriesQuery.refetch()}>
            Recarregar categorias
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => void faqsQuery.refetch()}>
            Recarregar perguntas
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">FAQ</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Perguntas frequentes e categorias de ajuda</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Gerencia as categorias de duvidas e as perguntas usadas no suporte publico e na pagina de materiais.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Categorias</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{categories.length}</p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Perguntas</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{faqs.length}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="grid w-full max-w-md grid-cols-2 rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("questions")}
            className={`rounded-sm px-3 py-2 text-sm font-medium transition ${
              activeTab === "questions" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            FAQs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`rounded-sm px-3 py-2 text-sm font-medium transition ${
              activeTab === "categories" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Categorias
          </button>
        </div>
        <Button type="button" className="rounded-lg" onClick={() => openFaqModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Pergunta
        </Button>
      </div>

      {activeTab === "questions" ? (
        <div className="mt-6 space-y-6">
          {groupedFaqs.map((group) => {
            const categoryKey = group.category?.id ?? "uncategorized"
            const categoryTitle = group.category?.title ?? "Sem categoria"
            const totalFaqs = group.faqs.length

            return (
              <article key={categoryKey} className="rounded-xl border bg-slate-50/40 shadow-sm">
                <div className="flex flex-col justify-between gap-4 p-6 pb-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="flex items-center gap-2 text-base font-bold uppercase tracking-[0.12em] text-sky-700">
                      <FolderOpen className="h-4 w-4" />
                      {categoryTitle}
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-mono text-slate-700">
                        {totalFaqs}
                      </span>
                    </h3>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                      title="Editar categoria"
                      onClick={() => group.category && handleEditCategory(group.category)}
                      disabled={!group.category}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {group.category ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-lg border-sky-200 px-3 text-sky-700 hover:bg-sky-50"
                      onClick={() => prepareNewFaqForCategory(group.category!.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Adicionar nesta categoria
                    </Button>
                  ) : null}
                </div>

                <div className="px-6 pb-6">
                  <div className="overflow-x-auto rounded-md border bg-white">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Ordem</th>
                          <th className="px-4 py-3">Pergunta</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.faqs.map((faq) => (
                          <tr key={faq.id} className="border-b last:border-b-0 hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-slate-400"
                                  title="Ordenacao manual"
                                  disabled
                                >
                                  <GripVertical className="h-4 w-4" />
                                </button>
                                <span className="font-mono text-xs text-slate-500">{faq.sort_order}</span>
                              </div>
                            </td>
                            <td className="max-w-[520px] truncate px-4 py-3 font-medium text-slate-900">
                              {faq.question}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  faq.is_active
                                    ? "bg-emerald-500 text-white"
                                    : "border border-slate-300 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {faq.is_active ? "Publicado" : "Inativo"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                                  onClick={() => handleEditFaq(faq)}
                                  title="Editar pergunta"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md p-2 text-rose-600 transition hover:bg-rose-50"
                                  onClick={() => void handleDeleteFaq(faq)}
                                  title="Excluir pergunta"
                                  disabled={deleteFaq.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            )
          })}

          {!faqs.length ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Ainda nao existem perguntas frequentes. Cria a primeira para alimentar a pagina publica.
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "categories" ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <form id="faq-category-form" onSubmit={handleCategorySubmit} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  {editingCategoryId ? "Editar categoria" : "Nova categoria"}
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">
                  {editingCategoryId ? "Ajustar categoria" : "Criar categoria"}
                </h3>
              </div>
              {editingCategoryId ? (
                <Button type="button" variant="ghost" className="rounded-full text-slate-500" onClick={resetCategoryForm}>
                  Limpar
                </Button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="Titulo">
                <input
                  value={categoryForm.title}
                  onChange={(event) =>
                    setCategoryForm((current) => {
                      const nextTitle = event.target.value
                      const shouldAutoUpdateSlug = !current.slug.trim() || current.slug === slugify(current.title)
                      return {
                        ...current,
                        title: nextTitle,
                        slug: shouldAutoUpdateSlug ? slugify(nextTitle) : current.slug,
                      }
                    })
                  }
                  placeholder="Pagamentos"
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
              </Field>
              <Field label="Slug">
                <input
                  value={categoryForm.slug}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
                  placeholder="pagamentos"
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
              </Field>
              <Field label="Descricao" fullWidth>
                <textarea
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  placeholder="Texto curto para contextualizar a categoria"
                  className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ordem">
                  <input
                    value={categoryForm.sortOrder}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))}
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  />
                </Field>
                <label className="flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(event) => setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-slate-950">Ativa</span>
                    <span className="mt-1 block text-slate-500">Categorias inativas saem dos filtros publicos.</span>
                  </span>
                </label>
              </div>
            </div>

            {categoryError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {categoryError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
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
                <Button type="button" variant="outline" className="rounded-full" onClick={resetCategoryForm}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {categories.map((category) => {
              const count = faqCountByCategory.get(category.id) ?? 0
              return (
                <article key={category.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-950">{category.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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

                  <p className="mt-3 text-sm leading-6 text-slate-500">{category.description ?? "Sem descricao."}</p>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Perguntas</p>
                      <p className="mt-1 text-xl font-bold text-slate-950">{count}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-slate-200 px-4"
                        onClick={() => handleEditCategory(category)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-rose-200 px-4 text-rose-700 hover:bg-rose-50"
                        onClick={() => void handleDeleteCategory(category)}
                        disabled={(faqCountByCategory.get(category.id) ?? 0) > 0 || deleteCategory.isPending}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}

            {!categories.length ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                Ainda nao existem categorias. Cria a primeira para organizar as perguntas.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isFaqModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-300 bg-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-950">{editingFaqId ? "Editar FAQ" : "Nova FAQ"}</h3>
                <p className="mt-1 text-sm text-slate-500">Organize perguntas frequentes para busca rapida dos usuarios.</p>
              </div>
              <button
                type="button"
                onClick={closeFaqModal}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFaqSubmit} className="space-y-5 px-6 py-5">
              <Field label="Pergunta" fullWidth>
                <input
                  value={faqForm.question}
                  onChange={(event) => setFaqForm((current) => ({ ...current, question: event.target.value }))}
                  placeholder="Paguei, mas a sebenta ainda nao aparece. O que faco?"
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Resposta" fullWidth>
                <textarea
                  value={faqForm.answer}
                  onChange={(event) => setFaqForm((current) => ({ ...current, answer: event.target.value }))}
                  rows={6}
                  placeholder="Escreve a resposta curta e direta que queres mostrar ao publico."
                  className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_132px_132px]">
                <Field label="Categoria">
                  <select
                    value={faqForm.categoryId}
                    onChange={(event) => setFaqForm((current) => ({ ...current, categoryId: event.target.value }))}
                    className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">Seleciona uma categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="mt-7">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                    onClick={() => {
                      setActiveTab("categories")
                      setIsFaqModalOpen(false)
                      document.getElementById("faq-category-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                  >
                    Nova
                  </Button>
                </div>

                <Field label="Posicao na Lista">
                  <input
                    value={faqForm.sortOrder}
                    onChange={(event) => setFaqForm((current) => ({ ...current, sortOrder: event.target.value }))}
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                  />
                </Field>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">
                <div>
                  <span className="block font-semibold text-slate-950">Visibilidade</span>
                  <span className="mt-1 block text-xs text-slate-500">Define se a pergunta aparece na area publica.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFaqForm((current) => ({ ...current, isActive: !current.isActive }))}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    faqForm.isActive ? "bg-blue-600" : "bg-slate-300"
                  }`}
                  aria-pressed={faqForm.isActive}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      faqForm.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {faqError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {faqError}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="ghost" className="rounded-lg" onClick={closeFaqModal}>
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-lg" disabled={createFaq.isPending || updateFaq.isPending}>
                  {createFaq.isPending || updateFaq.isPending
                    ? "A guardar..."
                    : editingFaqId
                      ? "Salvar FAQ"
                      : "Salvar FAQ"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

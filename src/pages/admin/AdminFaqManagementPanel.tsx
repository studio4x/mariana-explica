import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
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
  const [categoryForm, setCategoryForm] = useState<FaqCategoryFormState>(() => buildDefaultCategoryForm(1))
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [faqForm, setFaqForm] = useState<FaqFormState>(() => buildDefaultFaqForm())
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [faqError, setFaqError] = useState<string | null>(null)

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

      resetFaqForm()
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : "Nao foi possivel guardar a pergunta frequente.")
    }
  }

  const handleEditCategory = (category: FaqCategorySummary) => {
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
    setEditingFaqId(faq.id)
    setFaqForm({
      categoryId: faq.category_id,
      question: faq.question,
      answer: faq.answer,
      sortOrder: String(faq.sort_order ?? 0),
      isActive: faq.is_active,
    })
    setFaqError(null)
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
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
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

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <form onSubmit={handleCategorySubmit} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
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

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {category.description ?? "Sem descricao."}
                  </p>

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
          </div>
        </div>

        <div className="space-y-5">
          <form onSubmit={handleFaqSubmit} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  {editingFaqId ? "Editar pergunta" : "Nova pergunta"}
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">
                  {editingFaqId ? "Ajustar FAQ" : "Criar FAQ"}
                </h3>
              </div>
              {editingFaqId ? (
                <Button type="button" variant="ghost" className="rounded-full text-slate-500" onClick={resetFaqForm}>
                  Limpar
                </Button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
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
              <Field label="Ordem">
                <input
                  value={faqForm.sortOrder}
                  onChange={(event) => setFaqForm((current) => ({ ...current, sortOrder: event.target.value }))}
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none focus:border-slate-400"
                />
              </Field>
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
              <label className="flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={faqForm.isActive}
                  onChange={(event) => setFaqForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-slate-950">Ativa</span>
                  <span className="mt-1 block text-slate-500">Perguntas inativas ficam escondidas da area publica.</span>
                </span>
              </label>
            </div>

            {faqError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {faqError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" className="rounded-full" disabled={createFaq.isPending || updateFaq.isPending}>
                {createFaq.isPending || updateFaq.isPending
                  ? "A guardar..."
                  : editingFaqId
                    ? "Atualizar pergunta"
                    : "Criar pergunta"}
              </Button>
              {editingFaqId ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={resetFaqForm}>
                  Cancelar edicao
                </Button>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {faqs.map((faq) => {
              const category = categoryById.get(faq.category_id)

              return (
                <article key={faq.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                        {category?.title ?? "Sem categoria"}
                      </p>
                      <h4 className="mt-2 text-lg font-bold text-slate-950">{faq.question}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{faq.answer}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                          faq.is_active
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {faq.is_active ? "Ativa" : "Inativa"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Ordem {faq.sort_order}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-slate-200 px-4"
                      onClick={() => handleEditFaq(faq)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-rose-200 px-4 text-rose-700 hover:bg-rose-50"
                      onClick={() => void handleDeleteFaq(faq)}
                      disabled={deleteFaq.isPending}
                    >
                      Excluir
                    </Button>
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
        </div>
      </div>
    </section>
  )
}

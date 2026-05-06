import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { HelpCircle, LifeBuoy, Search, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { buildDefaultFaqCategories, buildDefaultFaqs } from "@/lib/faq-defaults"
import { supportBusinessHours, supportCategories, supportPublicNote } from "@/lib/support-sla"
import { usePublishedFaqCategories, usePublishedFaqs } from "@/hooks/useFaqs"

export function Support() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const { data: faqCategoriesFromDb } = usePublishedFaqCategories()
  const { data: faqsFromDb } = usePublishedFaqs()

  const faqCategories = useMemo(() => {
    return faqCategoriesFromDb && faqCategoriesFromDb.length > 0
      ? faqCategoriesFromDb
      : buildDefaultFaqCategories()
  }, [faqCategoriesFromDb])

  const faqCategoryById = useMemo(
    () => new Map(faqCategories.map((category) => [category.id, category])),
    [faqCategories],
  )

  const faqs = useMemo(() => {
    if (faqsFromDb && faqsFromDb.length > 0) return faqsFromDb
    return buildDefaultFaqs(faqCategories)
  }, [faqCategories, faqsFromDb])

  const activeFaqs = useMemo(() => {
    const term = query.trim().toLowerCase()

    return faqs.filter((faq) => {
      const category = faqCategoryById.get(faq.category_id)
      const matchesCategory = activeCategory === "all" || category?.slug === activeCategory
      const matchesQuery =
        !term || `${faq.question} ${faq.answer} ${category?.title ?? ""}`.toLowerCase().includes(term)

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, faqCategoryById, faqs, query])

  const filteredFaqs = useMemo(() => {
    return [...activeFaqs].sort((left, right) => left.sort_order - right.sort_order || left.question.localeCompare(right.question))
  }, [activeFaqs])

  return (
    <div className="bg-white pb-20 pt-8 text-slate-950">
      <div className="container space-y-12">
        <section className="mx-auto max-w-4xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-black md:text-6xl">Como podemos ajudar?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Encontre respostas rapidas ou abra um chamado para a equipa acompanhar o seu caso.
          </p>
          <label className="relative mx-auto mt-8 block max-w-2xl">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar no suporte..."
              className="h-14 w-full rounded-full border border-slate-200 bg-slate-50 pl-14 pr-5 text-base outline-none focus:border-sky-500 focus:bg-white"
            />
          </label>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-black">SLA de primeira resposta</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {supportCategories.map((category) => (
                <article key={category.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black text-slate-950">{category.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{category.description}</p>
                  <span className="mt-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-sky-800">
                    ate {category.firstResponseHours} horas uteis
                  </span>
                </article>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-600">{supportBusinessHours} {supportPublicNote}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
            <ShieldAlert className="h-8 w-8 text-red-700" />
            <h2 className="mt-4 font-display text-2xl font-black text-red-950">Casos urgentes</h2>
            <p className="mt-3 text-sm leading-7 text-red-900">
              Para fraude, pagamento duplicado, bloqueio de acesso ou risco imediato, abra um chamado com o maximo de detalhes.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to={`${ROUTES.DASHBOARD_SUPPORT}?openTicketModal=1&ticketStep=form`}>Abrir chamado</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 grid gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-full px-4 py-2 text-left text-sm font-bold ${activeCategory === "all" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Todas
              </button>
              {faqCategories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => setActiveCategory(category.slug)}
                  className={`rounded-full px-4 py-2 text-left text-sm font-bold ${activeCategory === category.slug ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {category.title}
                </button>
              ))}
            </div>
          </aside>

          <div>
            <select
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              className="mb-4 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm lg:hidden"
            >
              <option value="all">Todas</option>
              {faqCategories.map((category) => (
                <option key={category.slug} value={category.slug}>{category.title}</option>
              ))}
            </select>
            <div className="space-y-3">
              {filteredFaqs.map((faq) => (
                <details key={faq.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <summary className="cursor-pointer font-black text-slate-950">{faq.question}</summary>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{faq.answer}</p>
                </details>
              ))}
              {filteredFaqs.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                  Nenhuma pergunta encontrada para esta busca.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <HelpCircle className="h-7 w-7 text-sky-200" />
              <h2 className="mt-3 font-display text-3xl font-black">Ainda precisa de ajuda?</h2>
              <p className="mt-2 text-sm leading-7 text-white/70">Abra um chamado autenticado para receber acompanhamento pelo dashboard.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="rounded-full bg-white text-slate-950 hover:bg-slate-100">
                <Link to={`${ROUTES.DASHBOARD_SUPPORT}?openTicketModal=1&ticketStep=form`}>Abrir um chamado</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10">
                <Link to={ROUTES.LOGIN}>Entrar na conta</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

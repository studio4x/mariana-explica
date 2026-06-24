import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { HelpCircle, LifeBuoy, Search } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { buildDefaultFaqCategories, buildDefaultFaqs } from "@/lib/faq-defaults"
import { usePublishedFaqCategories, usePublishedFaqs } from "@/hooks/useFaqs"
import {
  EditableContainer,
  EditableButton,
  EditableImage,
  EditableLink,
  EditableText,
  SiteContentScope,
  VisualEditorProvider,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type SupportVisualEditorDocument,
} from "@/features/site-editor/visual-editor/page-definitions"
import type { FaqSummary } from "@/types/faq.types"

type SupportFaq = FaqSummary & {
  ctaLabel?: string
  ctaTo?: string
}

function SupportPageContent() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const { document } = useVisualEditorPage()
  const { data: faqCategoriesFromDb } = usePublishedFaqCategories()
  const { data: faqsFromDb } = usePublishedFaqs()

  const faqCategories = useMemo(() => {
    return faqCategoriesFromDb && faqCategoriesFromDb.length > 0 ? faqCategoriesFromDb : buildDefaultFaqCategories()
  }, [faqCategoriesFromDb])

  const faqCategoryById = useMemo(
    () => new Map(faqCategories.map((category) => [category.id, category])),
    [faqCategories],
  )

  const faqs = useMemo<SupportFaq[]>(() => {
    if (faqsFromDb && faqsFromDb.length > 0) {
      return faqsFromDb.map((faq) => ({ ...faq }))
    }

    return buildDefaultFaqs(faqCategories).map((faq) => ({ ...faq }))
  }, [faqCategories, faqsFromDb])

  const supportFaq = useMemo<SupportFaq>(() => {
    const supportCategory = faqCategories.find((category) => category.slug === "general") ?? faqCategories[0]

    return {
      id: "support-escalation",
      category_id: supportCategory?.id ?? "support-escalation",
      question: "A FAQ ainda nao resolveu a minha duvida. O que faco?",
      answer:
        "Se a resposta nao foi suficiente, abre um chamado e a equipa acompanha o caso no dashboard do aluno.",
      sort_order: 999,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ctaLabel: "Abrir chamado",
      ctaTo: `${ROUTES.DASHBOARD_SUPPORT}?openTicketModal=1&ticketStep=form`,
    }
  }, [faqCategories])

  const faqsWithEscalation = useMemo<SupportFaq[]>(() => {
    return [...faqs, supportFaq]
  }, [faqs, supportFaq])

  const activeFaqs = useMemo(() => {
    const term = query.trim().toLowerCase()

    return faqsWithEscalation.filter((faq) => {
      const category = faqCategoryById.get(faq.category_id)
      const matchesCategory = activeCategory === "all" || category?.slug === activeCategory
      const matchesQuery =
        !term || `${faq.question} ${faq.answer} ${category?.title ?? ""}`.toLowerCase().includes(term)

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, faqCategoryById, faqsWithEscalation, query])

  const filteredFaqs = useMemo(() => {
    return [...activeFaqs].sort((left, right) => left.sort_order - right.sort_order || left.question.localeCompare(right.question))
  }, [activeFaqs])

  const visualDocument =
    (document as unknown as SupportVisualEditorDocument | undefined) ?? SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT
  const hero = visualDocument.hero
  const supportCta = visualDocument.supportCta

  return (
    <div className="bg-white pb-20 pt-8 text-slate-950">
      <div className="container space-y-12">
        <SiteContentScope title="Hero principal" description="Titulo, texto, botoes e imagem da pagina de suporte">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-center">
            <div className="mx-auto max-w-4xl text-center lg:mx-0 lg:text-left">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-700 lg:mx-0">
                <LifeBuoy className="h-8 w-8" />
              </div>
              <EditableText
                fieldKey="hero.eyebrow"
                as="p"
                fallback={hero.eyebrow}
                className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-sky-700"
              />
              <EditableText
                fieldKey="hero.title"
                as="h1"
                fallback={hero.title}
                className="mt-3 font-display text-4xl font-black md:text-6xl"
              />
              <EditableText
                fieldKey="hero.lead"
                as="p"
                fallback={hero.lead}
                className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600 lg:mx-0"
              />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <EditableButton fieldKey="hero.primaryCta" fallback={hero.primaryCta} />
                <EditableLink
                  fieldKey="hero.secondaryCta"
                  fallback={hero.secondaryCta}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                />
              </div>
            </div>

            <div className="mx-auto w-full max-w-[420px]">
              <EditableImage
                fieldKey="hero.image"
                fallback={hero.image}
                className="min-h-[280px] lg:min-h-[420px]"
              />
            </div>
          </section>
        </SiteContentScope>

        <SiteContentScope title="Busca e filtros" description="FAQ com pesquisa local e categorias">
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
              <label className="relative mb-4 block">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar no suporte..."
                  className="h-14 w-full rounded-full border border-slate-200 bg-slate-50 pl-14 pr-5 text-base outline-none focus:border-sky-500 focus:bg-white"
                />
              </label>

              <select
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value)}
                className="mb-4 h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm lg:hidden"
              >
                <option value="all">Todas</option>
                {faqCategories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.title}
                  </option>
                ))}
              </select>

              <div className="space-y-3">
                {filteredFaqs.map((faq) => (
                  <details key={faq.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <summary className="cursor-pointer font-black text-slate-950">{faq.question}</summary>
                    <div className="mt-3 space-y-4 text-sm leading-7 text-slate-600">
                      <p>{faq.answer}</p>
                      {faq.ctaTo ? (
                        <Button asChild className="rounded-full">
                          <Link to={faq.ctaTo}>{faq.ctaLabel ?? "Abrir chamado"}</Link>
                        </Button>
                      ) : null}
                    </div>
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
        </SiteContentScope>

        <SiteContentScope title="CTA final" description="Convite para abrir chamado ou entrar na conta">
          <EditableContainer
            fieldKey="supportCta.container"
            as="section"
            className="rounded-lg border border-slate-200 bg-slate-950 p-8 text-white shadow-sm"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <HelpCircle className="h-7 w-7 text-sky-200" />
                <EditableText
                  fieldKey="supportCta.title"
                  as="h2"
                  fallback={supportCta.title}
                  className="mt-3 font-display text-3xl font-black"
                />
                <EditableText
                  fieldKey="supportCta.lead"
                  as="p"
                  fallback={supportCta.lead}
                  className="mt-2 text-sm leading-7 text-white/70"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <EditableButton
                  fieldKey="supportCta.primaryCta"
                  fallback={supportCta.primaryCta}
                  className="bg-white text-slate-950 hover:bg-slate-100"
                />
                <EditableLink
                  fieldKey="supportCta.secondaryCta"
                  fallback={supportCta.secondaryCta}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/30 bg-transparent px-5 text-sm font-bold text-white transition hover:bg-white/10"
                />
              </div>
            </div>
          </EditableContainer>
        </SiteContentScope>
      </div>
    </div>
  )
}

export function Support() {
  return (
    <VisualEditorProvider pageKey="support">
      <SupportPageContent />
    </VisualEditorProvider>
  )
}

export { SupportPageContent }

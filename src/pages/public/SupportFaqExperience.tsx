import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { HelpCircle, LifeBuoy } from "lucide-react"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { buildDefaultFaqCategories, buildDefaultFaqs } from "@/lib/faq-defaults"
import { usePublishedFaqCategories, usePublishedFaqs } from "@/hooks/useFaqs"
import type { FaqSummary } from "@/types/faq.types"
import {
  EditableButton,
  EditableContainer,
  EditableImage,
  EditableLink,
  EditableText,
  SiteContentScope,
  useOptionalVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type SupportVisualEditorDocument,
} from "@/features/site-editor/visual-editor/page-definitions"

type SupportFaq = FaqSummary & {
  ctaLabel?: string
  ctaTo?: string
}

function renderSupportLink(link: { label: string; href: string }, className: string) {
  if (link.href.startsWith("/")) {
    return (
      <Button asChild className={className}>
        <Link to={link.href}>{link.label}</Link>
      </Button>
    )
  }

  return (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  )
}

function SupportFaqExperienceContent(props: { includeHero: boolean }) {
  const { includeHero } = props
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const { data: faqCategoriesFromDb } = usePublishedFaqCategories()
  const { data: faqsFromDb } = usePublishedFaqs()
  const visualEditorPage = useOptionalVisualEditorPage()

  const visualDocument =
    (visualEditorPage?.document as unknown as SupportVisualEditorDocument | undefined) ??
    SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT
  const hero = visualDocument.hero
  const supportCta = visualDocument.supportCta

  const faqCategories = useMemo(() => {
    return faqCategoriesFromDb && faqCategoriesFromDb.length > 0
      ? faqCategoriesFromDb
      : buildDefaultFaqCategories()
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
    return [...activeFaqs].sort(
      (left, right) => left.sort_order - right.sort_order || left.question.localeCompare(right.question),
    )
  }, [activeFaqs])

  return (
    <EditableContainer
      fieldKey="layout.pageFrame"
      as="div"
      className="relative overflow-hidden bg-[#f6fafc] py-10 text-slate-900 md:py-14"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[#d7eef9] blur-3xl" />
        <div className="absolute right-[-6rem] top-28 h-80 w-80 rounded-full bg-[#c7e3f1] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/4 h-80 w-80 rounded-full bg-white/70 blur-3xl" />
      </div>

      <div className="container relative space-y-12">
        {includeHero ? (
          visualEditorPage ? (
            <SiteContentScope title="Hero principal" description="Texto, CTAs e imagem de abertura">
              <section className="grid gap-8 overflow-hidden rounded-3xl border border-[#dbe8ef] bg-white p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:p-10">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#e7f3fb] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#114866]">
                    <LifeBuoy className="h-4 w-4" />
                    <EditableText
                      fieldKey="hero.eyebrow"
                      as="span"
                      fallback={hero.eyebrow}
                      className="text-[11px] font-black uppercase tracking-[0.18em] text-[#114866]"
                    />
                  </div>

                  <EditableText
                    fieldKey="hero.title"
                    as="h1"
                    fallback={hero.title}
                    className="max-w-3xl text-3xl font-black leading-tight text-[#102c40] md:text-5xl"
                  />

                  <EditableText
                    fieldKey="hero.lead"
                    as="p"
                    fallback={hero.lead}
                    className="max-w-3xl text-base leading-8 text-slate-600 md:text-lg"
                  />

                  <div className="flex flex-wrap gap-3">
                    <EditableButton
                      fieldKey="hero.primaryCta"
                      fallback={hero.primaryCta}
                      className="rounded-full bg-[#123f59] px-6 text-white hover:bg-[#0f3247]"
                    />
                    <EditableLink
                      fieldKey="hero.secondaryCta"
                      fallback={hero.secondaryCta}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <EditableImage fieldKey="hero.image" fallback={hero.image} className="w-full max-w-[360px]" />
                </div>
              </section>
            </SiteContentScope>
          ) : (
            <section className="grid gap-8 overflow-hidden rounded-3xl border border-[#dbe8ef] bg-white p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:p-10">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#e7f3fb] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#114866]">
                  <LifeBuoy className="h-4 w-4" />
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#114866]">
                    {hero.eyebrow}
                  </span>
                </div>

                <h1 className="max-w-3xl text-3xl font-black leading-tight text-[#102c40] md:text-5xl">{hero.title}</h1>

                <p className="max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{hero.lead}</p>

                <div className="flex flex-wrap gap-3">
                  {renderSupportLink(
                    hero.primaryCta,
                    "inline-flex h-11 items-center justify-center rounded-full bg-[#123f59] px-6 text-sm font-bold text-white transition hover:bg-[#0f3247]",
                  )}
                  {renderSupportLink(
                    hero.secondaryCta,
                    "inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-50",
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center">
                <img
                  src={hero.image.src}
                  alt={hero.image.alt}
                  className="w-full max-w-[360px] rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                />
              </div>
            </section>
          )
        ) : null}

        <section className="rounded-3xl border border-[#dbe8ef] bg-[#0f2f45] p-6 text-white shadow-sm md:p-10">
          <h2 className="text-2xl font-black md:text-3xl">Notas importantes antes de enviares o teu formulario:</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-white/90 md:text-base">
            <p>
              <span className="font-black text-white">Planeamento Previo:</span> Devido a agenda preenchida, todos os
              pedidos para explicacoes devem ser efetuados com um minimo de 3 semanas de antecedencia.
            </p>
            <p>
              <span className="font-black text-white">Nao Garante Reserva:</span> O envio e submissao deste formulario
              funciona estritamente como um pedido de informacoes e consulta de disponibilidade. Nao constitui, de
              forma alguma, uma marcacao automatica ou garantia de vaga.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#dbe8ef] bg-white p-6 shadow-sm md:p-10">
          <form className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nome
                <input
                  required
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email
                <input
                  required
                  type="email"
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Assunto
              <input
                required
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Mensagem
              <textarea
                required
                rows={7}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#2f8fb8] focus:bg-white"
              />
            </label>

            <div className="rounded-2xl border border-[#bee0ef] bg-[#eef8fd] p-4 text-sm leading-7 text-[#144d6b]">
              <p className="font-black">Se o teu pedido for para Explicacoes, indica obrigatoriamente nesta caixa:</p>
              <p className="mt-1">O Ano Escolar do Aluno (ex: 10.0, 11.0 ou 12.0 ano)</p>
              <p>A Disciplina pretendida (Filosofia ou Portugues)</p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="submit" className="rounded-full bg-[#123f59] px-6 hover:bg-[#0f3247]">
                Enviar formulario
              </Button>
            </div>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 grid gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-full px-4 py-2 text-left text-sm font-bold ${
                  activeCategory === "all" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Todas
              </button>
              {faqCategories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => setActiveCategory(category.slug)}
                  className={`rounded-full px-4 py-2 text-left text-sm font-bold ${
                    activeCategory === category.slug ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {category.title}
                </button>
              ))}
            </div>
          </aside>

          <div>
            <label className="relative block">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar no suporte..."
                className="mb-4 h-14 w-full rounded-full border border-slate-200 bg-slate-50 px-5 text-base outline-none focus:border-sky-500 focus:bg-white"
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

        {visualEditorPage ? (
          <SiteContentScope title="Suporte rapido" description="Bloco final com apoio e redirecionamento">
            <EditableContainer
              fieldKey="supportCta.container"
              as="section"
              className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm"
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
                    className="rounded-full bg-white text-slate-950 hover:bg-slate-100"
                    variant="secondary"
                  />
                  <EditableLink
                    fieldKey="supportCta.secondaryCta"
                    fallback={supportCta.secondaryCta}
                    className="rounded-full border border-white/30 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  />
                </div>
              </div>
            </EditableContainer>
          </SiteContentScope>
        ) : (
          <section className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <HelpCircle className="h-7 w-7 text-sky-200" />
                <h2 className="mt-3 font-display text-3xl font-black">{supportCta.title}</h2>
                <p className="mt-2 text-sm leading-7 text-white/70">{supportCta.lead}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {renderSupportLink(
                  supportCta.primaryCta,
                  "inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100",
                )}
                {renderSupportLink(
                  supportCta.secondaryCta,
                  "inline-flex h-11 items-center justify-center rounded-full border border-white/30 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10",
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </EditableContainer>
  )
}

export function SupportFaqExperience() {
  return <SupportFaqExperienceContent includeHero />
}

export function SupportFaqExperienceBody() {
  return <SupportFaqExperienceContent includeHero={false} />
}

export const SupportPageContent = SupportFaqExperience

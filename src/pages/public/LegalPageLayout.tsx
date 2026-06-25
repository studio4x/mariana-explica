import { Link } from "react-router-dom"
import { APP_NAME, ROUTES } from "@/lib/constants"
import {
  EditableButton,
  EditableText,
  SiteContentScope,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import type { LegalVisualEditorDocument } from "@/features/site-editor/visual-editor/public-page-definitions"

export type LegalSection = {
  title: string
  body: string[]
}

type LegalPageLayoutProps = {
  eyebrow: string
  title: string
  intro: string
  updatedAt: string
  sections: LegalSection[]
}

export function LegalPageLayout({
  eyebrow,
  title,
  intro,
  updatedAt,
  sections,
}: LegalPageLayoutProps) {
  const { document } = useVisualEditorPage()
  const visualDocument = (document as LegalVisualEditorDocument | undefined) ?? null
  const hero = visualDocument?.hero ?? null
  const support = visualDocument?.support ?? null

  return (
    <div className="bg-white">
      <SiteContentScope title="Cabecalho" description="Titulo, introducao e data de atualizacao">
        <section className="container py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            Voltar ao site
          </Link>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 shadow-sm sm:p-8">
            <EditableText
              fieldKey="hero.eyebrow"
              as="p"
              fallback={hero?.eyebrow ?? eyebrow}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700"
            />
            <EditableText
              fieldKey="hero.title"
              as="h1"
              fallback={hero?.title ?? title}
              className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl"
            />
            <EditableText
              fieldKey="hero.intro"
              as="p"
              fallback={hero?.intro ?? intro}
              className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base"
            />

            <EditableText
              fieldKey="hero.updatedAt"
              as="div"
              fallback={hero?.updatedAt ?? updatedAt}
              className="mt-6 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500"
            />
          </div>

          <div className="mt-8 space-y-5">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.35)] sm:p-8"
              >
                <h2 className="font-display text-2xl text-slate-950">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-[15px]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-sky-100 bg-sky-50/80 p-6 sm:p-8">
            <EditableText
              fieldKey="support.eyebrow"
              as="p"
              fallback={support?.eyebrow ?? "Apoio"}
              className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700"
            />
            <EditableText
              fieldKey="support.title"
              as="h2"
              fallback={support?.title ?? "Precisa de esclarecimentos?"}
              className="mt-3 font-display text-2xl text-slate-950"
            />
            <EditableText
              fieldKey="support.lead"
              as="p"
              fallback={
                support?.lead ??
                "Se precisar de ajuda adicional sobre privacidade, cookies, condições de utilização ou exercício de direitos, utilize os canais de apoio disponíveis na plataforma."
              }
              className="mt-3 max-w-2xl text-sm leading-7 text-slate-600"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <EditableButton
                fieldKey="support.primaryCta"
                fallback={support?.primaryCta ?? { label: "Contactar suporte", href: ROUTES.SUPPORT }}
              />
              <EditableButton
                fieldKey="support.secondaryCta"
                fallback={support?.secondaryCta ?? { label: `Aceder a ${APP_NAME}`, href: ROUTES.LOGIN }}
                variant="secondary"
              />
            </div>
          </div>
        </div>
        </section>
      </SiteContentScope>
    </div>
  )
}

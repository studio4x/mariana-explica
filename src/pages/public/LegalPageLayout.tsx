import { Link } from "react-router-dom"
import { APP_NAME, ROUTES } from "@/lib/constants"

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
  return (
    <div className="bg-white">
      <section className="container py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            Voltar ao site
          </Link>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">{eyebrow}</p>
            <h1 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{intro}</p>

            <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Ultima atualizacao: {updatedAt}
            </div>
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">Apoio</p>
            <h2 className="mt-3 font-display text-2xl text-slate-950">Precisa de esclarecimentos?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Se precisar de ajuda adicional sobre privacidade, cookies, condicoes de utilizacao ou exercicio de
              direitos, utilize os canais de apoio disponiveis na plataforma.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to={ROUTES.SUPPORT}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Contactar suporte
              </Link>
              <Link
                to={ROUTES.LOGIN}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              >
                Aceder a {APP_NAME}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

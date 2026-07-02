import { VisualEditorProvider, useVisualEditorPage } from "@/features/site-editor/visual-editor"
import {
  ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type AboutVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"
import { EditableText, SiteContentScope } from "@/features/site-editor/visual-editor"
import { PublicManagedPage } from "./PublicManagedPage"

function AboutPageContent() {
  const { document } = useVisualEditorPage()
  const visualDocument = (document as AboutVisualEditorDocument | undefined) ?? ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT
  const hero = visualDocument.hero
  const portrait = visualDocument.portrait
  const intro = visualDocument.intro
  const project = visualDocument.project
  const pillars = visualDocument.pillars

  return (
    <section className="bg-[#d8e8ef] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <SiteContentScope title="Hero" description="Título, subtítulo e retrato">
          <div className="mx-auto max-w-[860px] text-center">
            <EditableText
              fieldKey="hero.title"
              as="h1"
              fallback={hero.title}
              className="whitespace-pre-line font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl"
            />
            <EditableText
              fieldKey="hero.subtitle"
              as="p"
              fallback={hero.subtitle}
              className="mt-4 text-base font-semibold leading-7 text-[#24324a] md:text-lg"
            />
          </div>

          <div className="mt-12 grid items-center gap-8 md:mt-14 md:grid-cols-2 md:gap-12">
            <div className="flex min-h-[260px] items-center justify-center rounded bg-[#e8f0f4] p-8 md:min-h-[430px]">
              <img
                src={portrait.src}
                alt={portrait.alt}
                className="h-full w-full rounded object-contain"
                loading="lazy"
              />
            </div>

            <div className="space-y-7 text-center md:text-left">
              <EditableText
                fieldKey="intro.title"
                as="p"
                fallback={intro.title}
                className="font-display text-xl font-bold leading-[1.4] text-[#0f122c] md:text-2xl"
              />

              <EditableText
                fieldKey="intro.text1"
                as="p"
                fallback={intro.text1}
                className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
              />

              <EditableText
                fieldKey="intro.text2"
                as="p"
                fallback={intro.text2}
                className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
              />
            </div>
          </div>
        </SiteContentScope>

        <div className="mt-16 md:mt-24">
          <SiteContentScope title="Projeto" description="Contexto do projeto e explicação da proposta">
            <div className="mx-auto max-w-[980px] text-center">
              <EditableText
                fieldKey="project.title"
                as="h2"
                fallback={project.title}
                className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl"
              />
            </div>

            <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
              <article className="rounded bg-[#e8f0f4] px-8 py-9 md:px-10 md:py-11">
                <EditableText
                  fieldKey="project.card1"
                  as="p"
                  fallback={project.card1}
                  className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
                />
              </article>

              <article className="rounded bg-[#e8f0f4] px-8 py-9 md:px-10 md:py-11">
                <EditableText
                  fieldKey="project.card2"
                  as="p"
                  fallback={project.card2}
                  className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
                />
              </article>
            </div>
          </SiteContentScope>
        </div>

        <div className="mt-16 md:mt-24">
          <SiteContentScope title="Pilares" description="Blocos com os pilares do método">
            <div className="mx-auto max-w-[980px] text-center">
              <EditableText
                fieldKey="pillars.title"
                as="h2"
                fallback={pillars.title}
                className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl"
              />
            </div>

            <div className="mt-10 space-y-8 md:mt-12 md:space-y-10">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                <article className="rounded bg-[#e8f0f4] px-6 py-6 md:px-10 md:py-7">
                  <EditableText
                    fieldKey="pillars.pillar1Text"
                    as="p"
                    fallback={pillars.pillar1Text}
                    className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
                  />
                </article>
                <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                  <EditableText
                    fieldKey="pillars.pillar1Label"
                    as="p"
                    fallback={pillars.pillar1Label}
                    className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                  <EditableText
                    fieldKey="pillars.pillar2Label"
                    as="p"
                    fallback={pillars.pillar2Label}
                    className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl"
                  />
                </div>
                <article className="rounded bg-[#e8f0f4] px-6 py-6 md:px-10 md:py-7">
                  <EditableText
                    fieldKey="pillars.pillar2Text"
                    as="p"
                    fallback={pillars.pillar2Text}
                    className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
                  />
                </article>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
                <article className="rounded bg-[#e8f0f4] px-6 py-6 md:px-10 md:py-7">
                  <EditableText
                    fieldKey="pillars.pillar3Text"
                    as="p"
                    fallback={pillars.pillar3Text}
                    className="text-center text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
                  />
                </article>
                <div className="mx-auto flex w-full max-w-[240px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                  <EditableText
                    fieldKey="pillars.pillar3Label"
                    as="p"
                    fallback={pillars.pillar3Label}
                    className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl"
                  />
                </div>
              </div>
            </div>
          </SiteContentScope>
        </div>
      </div>
    </section>
  )
}

function LegacyAbout() {
  return (
    <VisualEditorProvider pageKey="about">
      <AboutPageContent />
    </VisualEditorProvider>
  )
}

export function About() {
  return <PublicManagedPage slug="sobre" fallback={<LegacyAbout />} />
}

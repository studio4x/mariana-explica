import {
  EditableImage,
  EditableText,
  SiteContentScope,
  VisualEditorProvider,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type AboutVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"

function AboutPageContent() {
  const { document } = useVisualEditorPage()
  const visualDocument =
    (document as AboutVisualEditorDocument | undefined) ?? ABOUT_VISUAL_EDITOR_DEFAULT_DOCUMENT

  return (
    <section className="bg-[#d8e8ef] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <SiteContentScope title="Hero" description="Título de apresentação e imagem principal">
          <div className="mx-auto max-w-[860px] text-center">
            <EditableText
              fieldKey="hero.title"
              as="h1"
              fallback={visualDocument.hero.title}
              className="whitespace-pre-line font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl"
            />
            <EditableText
              fieldKey="hero.subtitle"
              as="p"
              fallback={visualDocument.hero.subtitle}
              className="mt-4 text-base font-semibold leading-8 text-[#24324a] md:text-lg"
            />
          </div>
        </SiteContentScope>

        <div className="mt-12 grid items-center gap-8 md:mt-14 md:grid-cols-2 md:gap-12">
          <SiteContentScope title="Retrato" description="Imagem ilustrativa da fundadora">
            <EditableImage
              fieldKey="portrait.src"
              fallback={visualDocument.portrait}
              className="min-h-[260px] rounded bg-[#e8f0f4] p-0 md:min-h-[430px]"
            />
          </SiteContentScope>

          <SiteContentScope title="Introdução" description="Apresentação pessoal e contexto">
            <div className="space-y-7 text-center md:text-left">
              <EditableText
                fieldKey="intro.title"
                as="p"
                fallback={visualDocument.intro.title}
                className="font-display text-xl font-bold leading-[1.4] text-[#0f122c] md:text-2xl"
              />
              <EditableText
                fieldKey="intro.text1"
                as="p"
                fallback={visualDocument.intro.text1}
                className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
              />
              <EditableText
                fieldKey="intro.text2"
                as="p"
                fallback={visualDocument.intro.text2}
                className="text-lg font-semibold leading-8 text-[#24324a] md:text-xl md:leading-9"
              />
            </div>
          </SiteContentScope>
        </div>

        <SiteContentScope title="Projeto" description="Motivação e origem do projeto">
          <div className="mt-16 md:mt-24">
            <div className="mx-auto max-w-[980px] text-center">
              <EditableText
                fieldKey="project.title"
                as="h2"
                fallback={visualDocument.project.title}
                className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl"
              />
            </div>

            <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
              <EditableText
                fieldKey="project.card1"
                as="article"
                fallback={visualDocument.project.card1}
                className="rounded bg-[#e8f0f4] px-8 py-9 text-lg font-semibold leading-8 text-[#24324a] md:px-10 md:py-11 md:text-xl md:leading-9"
              />
              <EditableText
                fieldKey="project.card2"
                as="article"
                fallback={visualDocument.project.card2}
                className="rounded bg-[#e8f0f4] px-8 py-9 text-center text-lg font-semibold leading-8 text-[#24324a] md:px-10 md:py-11 md:text-xl md:leading-9"
              />
            </div>
          </div>
        </SiteContentScope>

        <SiteContentScope title="Pilares" description="Método de trabalho e diferenciação">
          <div className="mt-16 md:mt-24">
            <div className="mx-auto max-w-[980px] text-center">
              <EditableText
                fieldKey="pillars.title"
                as="h2"
                fallback={visualDocument.pillars.title}
                className="font-display text-3xl font-bold leading-tight text-[#0f122c] md:text-5xl"
              />
            </div>

            <div className="mt-10 space-y-8 md:mt-12 md:space-y-10">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                <EditableText
                  fieldKey="pillars.pillar1Text"
                  as="article"
                  fallback={visualDocument.pillars.pillar1Text}
                  className="rounded bg-[#e8f0f4] px-6 py-6 text-center text-lg font-semibold leading-8 text-[#24324a] md:px-10 md:py-7 md:text-xl md:leading-9"
                />
                <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                  <EditableText
                    fieldKey="pillars.pillar1Label"
                    as="p"
                    fallback={visualDocument.pillars.pillar1Label}
                    className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <div className="mx-auto flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                  <EditableText
                    fieldKey="pillars.pillar2Label"
                    as="p"
                    fallback={visualDocument.pillars.pillar2Label}
                    className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl"
                  />
                </div>
                <EditableText
                  fieldKey="pillars.pillar2Text"
                  as="article"
                  fallback={visualDocument.pillars.pillar2Text}
                  className="rounded bg-[#e8f0f4] px-6 py-6 text-center text-lg font-semibold leading-8 text-[#24324a] md:px-10 md:py-7 md:text-xl md:leading-9"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
                <EditableText
                  fieldKey="pillars.pillar3Text"
                  as="article"
                  fallback={visualDocument.pillars.pillar3Text}
                  className="rounded bg-[#e8f0f4] px-6 py-6 text-center text-lg font-semibold leading-8 text-[#24324a] md:px-10 md:py-7 md:text-xl md:leading-9"
                />
                <div className="mx-auto flex w-full max-w-[240px] items-center justify-center rounded-[18px] bg-[#9aa8bb] px-5 py-4 md:mx-0">
                  <EditableText
                    fieldKey="pillars.pillar3Label"
                    as="p"
                    fallback={visualDocument.pillars.pillar3Label}
                    className="text-center font-display text-xl font-bold leading-tight text-[#0f122c] md:text-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </SiteContentScope>
      </div>
    </section>
  )
}

export function About() {
  return (
    <VisualEditorProvider pageKey="about">
      <AboutPageContent />
    </VisualEditorProvider>
  )
}


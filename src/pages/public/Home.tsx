import { MessageCircleHeart } from "lucide-react"
import { HomeReviewsFeed } from "@/components/reviews"
import homeHeroIllustration from "@/assets/home-hero-illustration.svg"
import {
  EditableButton,
  EditableText,
  SiteContentScope,
  VisualEditorProvider,
  useVisualEditorPage,
} from "@/features/site-editor/visual-editor"
import {
  HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT,
  type HomeVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"

function HomePageContent() {
  const { document } = useVisualEditorPage()
  const visualDocument =
    (document as HomeVisualEditorDocument | undefined) ?? HOME_VISUAL_EDITOR_DEFAULT_DOCUMENT

  return (
    <div className="flex flex-col">
      <SiteContentScope title="Hero principal" description="Mensagem principal e CTA inicial">
        <header className="bg-[#f5fafc] py-20 lg:py-32">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="aspect-[4/5] w-full rounded-xl bg-white shadow-sm ring-1 ring-black/5 lg:aspect-square">
                <img
                  src={homeHeroIllustration}
                  alt="Ilustração de materiais de estudo para Português e Filosofia"
                  className="h-full w-full rounded-xl object-contain p-6"
                  loading="eager"
                />
              </div>
            </div>

            <div className="order-1 space-y-8 lg:order-2">
              <div className="space-y-4">
                <EditableText
                  fieldKey="hero.eyebrow"
                  as="p"
                  fallback={visualDocument.hero.eyebrow}
                  className="max-w-[14ch] text-xs font-black uppercase tracking-[0.28em] text-[#48637e]"
                />
                <EditableText
                  fieldKey="hero.title"
                  as="h1"
                  fallback={visualDocument.hero.title}
                  className="max-w-[12ch] font-display text-5xl font-bold leading-[1.1] tracking-[-0.02em] text-[#0f122c] whitespace-pre-line lg:text-6xl"
                />
                <EditableText
                  fieldKey="hero.subtitle"
                  as="h2"
                  fallback={visualDocument.hero.subtitle}
                  className="max-w-[14ch] font-display text-3xl font-bold leading-[1.3] tracking-[-0.02em] text-[#0f122c]/80 lg:text-4xl"
                />
                <EditableText
                  fieldKey="hero.lead"
                  as="p"
                  fallback={visualDocument.hero.lead}
                  className="max-w-[18ch] font-sans text-xl leading-[1.6] text-[#46464d]"
                />
              </div>

              <EditableButton
                fieldKey="hero.primaryCta"
                fallback={visualDocument.hero.primaryCta}
                className="rounded-full bg-[#242742] px-12 py-6 text-sm font-bold uppercase tracking-widest text-white shadow-lg hover:bg-[#1d2036]"
              />
            </div>
          </div>
        </header>
      </SiteContentScope>

      <SiteContentScope title="Objetivo" description="Bloco de proposta de valor e apresentação inicial">
        <section className="bg-[rgba(239,244,246,0.5)] py-24">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
            <div className="flex flex-col items-center rounded border border-[rgba(71,71,77,0.12)] bg-white p-12 text-center shadow-sm">
              <EditableText
                fieldKey="objective.eyebrow"
                as="span"
                fallback={visualDocument.objective.eyebrow}
                className="mb-8 inline-flex rounded-full bg-[#242742] px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-white"
              />
              <EditableText
                fieldKey="objective.text"
                as="p"
                fallback={visualDocument.objective.text}
                className="max-w-2xl font-display text-2xl leading-relaxed text-[#0f122c]"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[visualDocument.featureBlocks.block1, visualDocument.featureBlocks.block2, visualDocument.featureBlocks.block3, visualDocument.featureBlocks.block4].map(
                (block, index) => (
                  <div
                    key={`${block.eyebrow}-${index}`}
                    className="flex flex-col items-center rounded border border-[rgba(71,71,77,0.12)] bg-white p-8 text-center shadow-sm"
                  >
                    <EditableText
                      fieldKey={`featureBlocks.block${index + 1}.eyebrow`}
                      as="span"
                      fallback={block.eyebrow}
                      className="mb-4 inline-flex rounded-full bg-[#242742] px-4 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white"
                    />
                    <EditableText
                      fieldKey={`featureBlocks.block${index + 1}.text`}
                      as="p"
                      fallback={block.text}
                      className="text-xs leading-relaxed text-[#46464d]"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      </SiteContentScope>

      <SiteContentScope title="Passos" description="Fluxo rápido de entendimento e navegação">
        <section className="bg-[#eff4f6] py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="mb-16 max-w-2xl">
              <h2 className="mb-6 font-display text-5xl font-bold tracking-[-0.02em] text-[#0f122c]">
                O teu caminho para o sucesso é simples
              </h2>
              <p className="text-lg leading-8 text-[#46464d]">
                Esquece as complicações burocráticas. Aqui, o foco é o teu estudo. Em três passos rápidos, tens tudo o
                que precisas para começar a brilhar.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[visualDocument.steps.step1, visualDocument.steps.step2, visualDocument.steps.step3].map((step, index) => (
                <div
                  key={`${step.eyebrow}-${index}`}
                  className="flex flex-col rounded border border-[rgba(71,71,77,0.12)] bg-white p-10 shadow-sm"
                >
                  <EditableText
                    fieldKey={`steps.step${index + 1}.eyebrow`}
                    as="span"
                    fallback={step.eyebrow}
                    className="mb-8 inline-flex self-start rounded-full bg-[#242742] px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-white"
                  />
                  <EditableText
                    fieldKey={`steps.step${index + 1}.text`}
                    as="p"
                    fallback={step.text}
                    className="text-base leading-7 text-[#46464d]"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </SiteContentScope>

      <SiteContentScope title="Confiança" description="Benefícios, provas sociais e chamadas secundárias">
        <section className="bg-[rgba(239,244,246,0.5)] py-24">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
            <div className="rounded border border-[rgba(71,71,77,0.12)] bg-white p-12 shadow-sm">
              <EditableText
                fieldKey="trust.leftTitle"
                as="h3"
                fallback={visualDocument.trust.leftTitle}
                className="mb-12 inline-flex rounded-full bg-[rgba(169,207,255,0.35)] px-6 py-2 text-lg font-display text-[#0f122c]"
              />
              <ul className="space-y-8">
                {[
                  visualDocument.trust.leftPoint1,
                  visualDocument.trust.leftPoint2,
                  visualDocument.trust.leftPoint3,
                ].map((point, index) => (
                  <li key={`${point.title}-${index}`} className="flex items-start gap-3">
                    <span className="mt-1 text-xs text-[#242742]">•</span>
                    <div>
                      <EditableText
                        fieldKey={`trust.leftPoint${index + 1}.title`}
                        as="span"
                        fallback={point.title}
                        className="block text-base font-bold text-[#242742]"
                      />
                      <EditableText
                        fieldKey={`trust.leftPoint${index + 1}.text`}
                        as="span"
                        fallback={point.text}
                        className="text-sm text-[#46464d]"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col justify-between rounded bg-[rgba(169,207,255,0.2)] p-12">
              <div>
                <EditableText
                  fieldKey="trust.rightTitle"
                  as="h3"
                  fallback={visualDocument.trust.rightTitle}
                  className="mb-12 inline-flex rounded-full bg-white px-6 py-2 text-lg font-display text-[#0f122c]"
                />
                <ul className="space-y-6">
                  {[visualDocument.trust.rightPoint1, visualDocument.trust.rightPoint2, visualDocument.trust.rightPoint3].map(
                    (point, index) => (
                      <li key={`${point}-${index}`} className="flex items-start gap-3">
                        <span className="mt-1 text-xs text-[#242742]">•</span>
                        <EditableText
                          fieldKey={`trust.rightPoint${index + 1}`}
                          as="span"
                          fallback={point}
                          className="text-sm font-medium leading-6 text-[#242742]"
                        />
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="mt-12 flex flex-wrap gap-4">
                <EditableButton
                  fieldKey="trust.primaryCta"
                  fallback={visualDocument.trust.primaryCta}
                  className="rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm"
                />
                <EditableButton
                  fieldKey="trust.secondaryCta"
                  fallback={visualDocument.trust.secondaryCta}
                  variant="secondary"
                  className="rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm"
                />
              </div>
            </div>
          </div>
        </section>
      </SiteContentScope>

      <SiteContentScope title="Reviews" description="Secção de prova social">
        <section className="bg-[#f5fafc] py-24">
          <div className="mx-auto max-w-[1200px] px-6 text-center">
            <div className="mx-auto max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#567085] shadow-sm ring-1 ring-black/5">
                <MessageCircleHeart className="h-4 w-4 text-[#242742]" />
                <EditableText
                  fieldKey="reviews.eyebrow"
                  as="span"
                  fallback={visualDocument.reviews.eyebrow}
                />
              </div>
              <EditableText
                fieldKey="reviews.title"
                as="h2"
                fallback={visualDocument.reviews.title}
                className="mt-4 font-display text-5xl font-bold tracking-[-0.02em] text-[#0f122c]"
              />
              <EditableText
                fieldKey="reviews.lead"
                as="p"
                fallback={visualDocument.reviews.lead}
                className="mt-4 text-base leading-7 text-[#46464d]"
              />
            </div>
            <HomeReviewsFeed />
          </div>
        </section>
      </SiteContentScope>
    </div>
  )
}

export function Home() {
  return (
    <VisualEditorProvider pageKey="home">
      <HomePageContent />
    </VisualEditorProvider>
  )
}

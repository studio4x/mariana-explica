import { FieldLabel, Render, type Config, type Data } from "@puckeditor/core"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

type PuckBlock = { type: string; props: Record<string, unknown> }

function createBlockId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `puck-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeInlineHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, ' $1="#"')
}

function safeRichText(html: string) {
  const normalized = String(html ?? "").trim()
  if (!normalized) return "<p></p>"
  return sanitizeInlineHtml(normalized)
}

function renderRichNode(value: unknown): ReactNode {
  if (typeof value === "string") {
    return <div dangerouslySetInnerHTML={{ __html: safeRichText(value) }} />
  }

  if (value == null) {
    return <div dangerouslySetInnerHTML={{ __html: "<p></p>" }} />
  }

  return value as ReactNode
}

function toPlainText(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(raw, "text/html")
      const text = normalizeText(doc.body.textContent)
      if (text) return text
    } catch {
      return normalizeText(raw.replace(/<[^>]+>/g, " "))
    }
  }

  return normalizeText(raw.replace(/<[^>]+>/g, " "))
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Falha ao ler imagem."))
    reader.readAsDataURL(file)
  })
}

const HOME_DEFAULTS = {
  hero: {
    imageSrc: "/assets/home-hero-illustration.svg",
    imageAlt: "Ilustracao de materiais de estudo para Portugues e Filosofia",
    heading: "<p>Tens dificuldades a Portugues ou Filosofia?</p>",
    headingTag: "h1",
    subheading: "<p>Nunca tiveste a disciplina e vais fazer exame?</p>",
    subheadingTag: "h2",
    body: "<p>Entao fica aqui que este local e para ti!</p>",
    ctaLabel: "<p>Explorar materiais</p>",
    ctaHref: "/materiais",
  },
  objective: {
    badge: "<p>Objetivo Principal</p>",
    text:
      "<p>Criei este espaco para te dar o apoio que os manuais nao dao: leveza, clareza e uma estrategia real para brilhares nos exames de Filosofia e Portugues. Vamo-nos simplificar?</p>",
    feature1Eyebrow: "<p>EM BREVE - AULAS GRAVADAS</p>",
    feature1Text:
      "<p>Domina temas complexos ao teu ritmo, com aulas organizadas e flexiveis, prontas quando tu estiveres.</p>",
    feature2Eyebrow: "<p>EXPLICACOES</p>",
    feature2Text:
      "<p>Acompanhamento personalizado e focado nas tuas duvidas especificas para garantires resultados.</p>",
    feature3Eyebrow: "<p>MATERIAIS DIGITAIS</p>",
    feature3Text:
      "<p>Resumos visuais e esquemas claros para simplificar o teu estudo e garantires a nota maxima sem complicacoes.</p>",
    feature4Eyebrow: "<p>MATERIAIS DIGITAIS - GRATUITOS</p>",
    feature4Text: "<p>Dicas flash e recursos rapidos para descarregar e dares um boost imediato no teu estudo.</p>",
  },
  steps: {
    title: "<p>O teu caminho para o sucesso e simples</p>",
    titleTag: "h2",
    subtitle:
      "<p>Esquece as complicacoes burocraticas. Aqui, o foco e o teu estudo. Em tres passos rapidos, tens tudo o que precisas para comecar a brilhar.</p>",
    step1Eyebrow: "<p>ENCONTRA O TEU APOIO</p>",
    step1Text:
      "<p>Explora as sebentas e materiais disponiveis. Cada material foi criado para resolver uma dor especifica, por isso vais perceber logo qual e o ideal para o teu momento.</p>",
    step2Eyebrow: "<p>ACESSO RAPIDO E SEGURO</p>",
    step2Text:
      "<p>O processo e direto e transparente. Sem taxas escondidas ou passos desnecessarios. Pagas de forma segura e o material e teu no segundo seguinte.</p>",
    step3Eyebrow: "<p>FOCA-TE NO QUE IMPORTA</p>",
    step3Text:
      "<p>Tudo fica organizado na tua Area do Aluno. Podes aceder aos PDFs e aulas sempre que quiseres, ao teu ritmo, e retomar o estudo exatamente onde paraste.</p>",
  },
  trust: {
    leftTitle: "<p>Vantagens de trabalhares comigo</p>",
    leftTitleTag: "h3",
    left1Title: "<p>Linguagem Direta:</p>",
    left1Text:
      "<p>Falamos a mesma lingua. Esquece os termos impossiveis dos manuais e entende a materia a primeira.</p>",
    left2Title: "<p>Foco no Exame:</p>",
    left2Text: "<p>Materiais desenhados apenas com o que realmente sai. Sem distracoes.</p>",
    left3Title: "<p>Resumos Visuais:</p>",
    left3Text: "<p>Esquemas e cores pensados para quem precisa de organizar ideias rapidamente.</p>",
    rightTitle: "<p>Leveza e Confianca em cada passo</p>",
    rightTitleTag: "h3",
    right1Text:
      '<p>Suporte Real: Nao recebes so um PDF. Tens uma "amiga" (eu!) nas DMs para te apoiar sempre que precisares.</p>',
    right2Text:
      "<p>Tudo Organizado: Esquece o caos do WhatsApp. Os teus materiais ficam sempre guardados na tua Area do Aluno.</p>",
    right3Text:
      "<p>Pes na Terra: Filosofia e Portugues deixam de ser abstratos e passam a ser ferramentas que dominas com seguranca.</p>",
    primaryCtaLabel: "<p>Explorar materiais</p>",
    primaryCtaHref: "/materiais",
    secondaryCtaLabel: "<p>Criar Conta</p>",
    secondaryCtaHref: "/criar-conta",
  },
  reviews: {
    title: "<p>Widget dinamico: reviews da Home</p>",
    note: "<p>Este bloco e renderizado dinamicamente no site publico.</p>",
  },
}

export const sitePagePuckConfig: Config = {
  categories: {
    estrutura: {
      title: "Estrutura",
      components: [
        "HomeHeroSection",
        "HomeObjectiveSection",
        "HomeStepsSection",
        "HomeTrustSection",
        "SectionTitle",
        "Spacer",
        "TwoColumnsText",
        "RawHtml",
      ],
    },
    conteudo: {
      title: "Conteudo",
      components: ["RichTextBlock", "ImageBlock", "ButtonBlock", "HomeReviewsWidget"],
    },
  },
  components: {
    HomeHeroSection: {
      label: "Hero Home (foto + texto)",
      defaultProps: {
        imageSrc: "https://placehold.co/900x900?text=Foto+Home",
        imageAlt: "Imagem principal",
        heading: "<p>Titulo principal</p>",
        headingTag: "h1",
        subheading: "<p>Subtitulo</p>",
        subheadingTag: "h2",
        body: "<p>Texto de apoio.</p>",
        ctaLabel: "<p>Explorar materiais</p>",
        ctaHref: "/materiais",
      },
      fields: {
        imageSrc: {
          type: "custom",
          label: "Imagem",
          render: ({ id, value, onChange, readOnly }) => (
            <FieldLabel label="Imagem" el="div" readOnly={readOnly}>
              <div className="space-y-2">
                <input
                  id={id}
                  type="url"
                  value={String(value ?? "")}
                  readOnly={readOnly}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder="https://..."
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
                <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  Upload imagem
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={readOnly}
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (!file) return
                      const dataUrl = await readFileAsDataUrl(file)
                      onChange(dataUrl)
                    }}
                  />
                </label>
              </div>
            </FieldLabel>
          ),
        },
        imageAlt: { type: "text", label: "Alt da imagem" },
        heading: { type: "richtext", label: "Titulo principal" },
        headingTag: {
          type: "select",
          label: "Tag do titulo",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        subheading: { type: "richtext", label: "Subtitulo" },
        subheadingTag: {
          type: "select",
          label: "Tag do subtitulo",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        body: { type: "richtext", label: "Texto de apoio" },
        ctaLabel: { type: "richtext", label: "Texto do botao" },
        ctaHref: { type: "text", label: "Link do botao" },
      },
      render: ({ imageSrc, imageAlt, heading, headingTag, subheading, subheadingTag, body, ctaLabel, ctaHref }) => {
        const HeadingTag = String(headingTag ?? "h1") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
        const SubheadingTag = String(subheadingTag ?? "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

        return (
          <header className="bg-[#f5fafc] py-20 lg:py-32">
            <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <div className="aspect-[4/5] w-full rounded-xl bg-white shadow-sm ring-1 ring-black/5 lg:aspect-square">
                  <img
                    src={String(imageSrc ?? "").trim() || "https://placehold.co/900x900?text=Foto+Home"}
                    alt={String(imageAlt ?? "").trim() || "Imagem principal"}
                    className="h-full w-full rounded-xl object-contain p-6"
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="order-1 space-y-8 lg:order-2">
                <div className="space-y-4">
                  <HeadingTag className="max-w-[12ch] font-display text-5xl font-bold leading-[1.1] tracking-[-0.02em] text-[#0f122c] lg:text-6xl">
                    {toPlainText(heading)}
                  </HeadingTag>
                  <SubheadingTag className="max-w-[14ch] font-display text-3xl font-bold leading-[1.3] tracking-[-0.02em] text-[#0f122c]/80 lg:text-4xl">
                    {toPlainText(subheading)}
                  </SubheadingTag>
                  <div className="max-w-[18ch] font-sans text-xl leading-[1.6] text-[#46464d]">{renderRichNode(body)}</div>
                </div>

                <a
                  href={String(ctaHref ?? "").trim() || "#"}
                  className="inline-flex rounded-full bg-[#242742] px-12 py-6 text-sm font-bold uppercase tracking-widest text-white shadow-lg transition hover:bg-[#1d2036]"
                >
                  {toPlainText(ctaLabel)}
                </a>
              </div>
            </div>
          </header>
        )
      },
    },
    HomeObjectiveSection: {
      label: "Home: Objetivo + Blocos",
      defaultProps: { ...HOME_DEFAULTS.objective },
      fields: {
        badge: { type: "richtext", label: "Selo principal" },
        text: { type: "richtext", label: "Texto principal" },
        feature1Eyebrow: { type: "richtext", label: "Bloco 1 - Titulo" },
        feature1Text: { type: "richtext", label: "Bloco 1 - Texto" },
        feature2Eyebrow: { type: "richtext", label: "Bloco 2 - Titulo" },
        feature2Text: { type: "richtext", label: "Bloco 2 - Texto" },
        feature3Eyebrow: { type: "richtext", label: "Bloco 3 - Titulo" },
        feature3Text: { type: "richtext", label: "Bloco 3 - Texto" },
        feature4Eyebrow: { type: "richtext", label: "Bloco 4 - Titulo" },
        feature4Text: { type: "richtext", label: "Bloco 4 - Texto" },
      },
      render: ({
        badge,
        text,
        feature1Eyebrow,
        feature1Text,
        feature2Eyebrow,
        feature2Text,
        feature3Eyebrow,
        feature3Text,
        feature4Eyebrow,
        feature4Text,
      }) => {
        const features = [
          { eyebrow: feature1Eyebrow, text: feature1Text },
          { eyebrow: feature2Eyebrow, text: feature2Text },
          { eyebrow: feature3Eyebrow, text: feature3Text },
          { eyebrow: feature4Eyebrow, text: feature4Text },
        ]

        return (
          <section className="bg-[rgba(239,244,246,0.5)] py-24">
            <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
              <div className="flex flex-col items-center rounded border border-[rgba(71,71,77,0.12)] bg-white p-12 text-center shadow-sm">
                <span className="mb-8 inline-flex rounded-full bg-[#242742] px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-white">
                  {toPlainText(badge)}
                </span>
                <div className="max-w-2xl font-display text-2xl leading-relaxed text-[#0f122c]">{renderRichNode(text)}</div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {features.map((feature, index) => (
                  <div
                    key={`${String(feature.eyebrow ?? "")}-${index}`}
                    className="flex flex-col items-center rounded border border-[rgba(71,71,77,0.12)] bg-white p-8 text-center shadow-sm"
                  >
                    <span className="mb-4 inline-flex rounded-full bg-[#242742] px-4 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-white">
                      {toPlainText(feature.eyebrow)}
                    </span>
                    <div className="text-xs leading-relaxed text-[#46464d]">{renderRichNode(feature.text)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      },
    },
    HomeStepsSection: {
      label: "Home: 3 passos",
      defaultProps: { ...HOME_DEFAULTS.steps },
      fields: {
        title: { type: "richtext", label: "Titulo da secao" },
        titleTag: {
          type: "select",
          label: "Tag do titulo",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        subtitle: { type: "richtext", label: "Subtitulo da secao" },
        step1Eyebrow: { type: "richtext", label: "Passo 1 - Titulo" },
        step1Text: { type: "richtext", label: "Passo 1 - Texto" },
        step2Eyebrow: { type: "richtext", label: "Passo 2 - Titulo" },
        step2Text: { type: "richtext", label: "Passo 2 - Texto" },
        step3Eyebrow: { type: "richtext", label: "Passo 3 - Titulo" },
        step3Text: { type: "richtext", label: "Passo 3 - Texto" },
      },
      render: ({ title, titleTag, subtitle, step1Eyebrow, step1Text, step2Eyebrow, step2Text, step3Eyebrow, step3Text }) => {
        const TitleTag = String(titleTag ?? "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
        const steps = [
          { eyebrow: step1Eyebrow, text: step1Text },
          { eyebrow: step2Eyebrow, text: step2Text },
          { eyebrow: step3Eyebrow, text: step3Text },
        ]

        return (
          <section className="bg-[#eff4f6] py-24">
            <div className="mx-auto max-w-[1200px] px-6">
              <div className="mb-16 max-w-2xl">
                <TitleTag className="mb-6 font-display text-5xl font-bold tracking-[-0.02em] text-[#0f122c]">
                  {toPlainText(title)}
                </TitleTag>
                <div className="text-lg leading-8 text-[#46464d]">{renderRichNode(subtitle)}</div>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {steps.map((step, index) => (
                  <div
                    key={`${String(step.eyebrow ?? "")}-${index}`}
                    className="flex flex-col rounded border border-[rgba(71,71,77,0.12)] bg-white p-10 shadow-sm"
                  >
                    <span className="mb-8 inline-flex self-start rounded-full bg-[#242742] px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-white">
                      {toPlainText(step.eyebrow)}
                    </span>
                    <div className="text-base leading-7 text-[#46464d]">{renderRichNode(step.text)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      },
    },
    HomeTrustSection: {
      label: "Home: Vantagens + CTAs",
      defaultProps: { ...HOME_DEFAULTS.trust },
      fields: {
        leftTitle: { type: "richtext", label: "Titulo coluna esquerda" },
        leftTitleTag: {
          type: "select",
          label: "Tag titulo esquerdo",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        left1Title: { type: "richtext", label: "Esq 1 - Titulo" },
        left1Text: { type: "richtext", label: "Esq 1 - Texto" },
        left2Title: { type: "richtext", label: "Esq 2 - Titulo" },
        left2Text: { type: "richtext", label: "Esq 2 - Texto" },
        left3Title: { type: "richtext", label: "Esq 3 - Titulo" },
        left3Text: { type: "richtext", label: "Esq 3 - Texto" },
        rightTitle: { type: "richtext", label: "Titulo coluna direita" },
        rightTitleTag: {
          type: "select",
          label: "Tag titulo direito",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        right1Text: { type: "richtext", label: "Dir 1 - Texto" },
        right2Text: { type: "richtext", label: "Dir 2 - Texto" },
        right3Text: { type: "richtext", label: "Dir 3 - Texto" },
        primaryCtaLabel: { type: "richtext", label: "CTA 1 - Texto" },
        primaryCtaHref: { type: "text", label: "CTA 1 - Link" },
        secondaryCtaLabel: { type: "richtext", label: "CTA 2 - Texto" },
        secondaryCtaHref: { type: "text", label: "CTA 2 - Link" },
      },
      render: ({
        leftTitle,
        leftTitleTag,
        left1Title,
        left1Text,
        left2Title,
        left2Text,
        left3Title,
        left3Text,
        rightTitle,
        rightTitleTag,
        right1Text,
        right2Text,
        right3Text,
        primaryCtaLabel,
        primaryCtaHref,
        secondaryCtaLabel,
        secondaryCtaHref,
      }) => {
        const LeftTitleTag = String(leftTitleTag ?? "h3") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
        const RightTitleTag = String(rightTitleTag ?? "h3") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
        const leftItems = [
          { title: left1Title, text: left1Text },
          { title: left2Title, text: left2Text },
          { title: left3Title, text: left3Text },
        ]
        const rightItems = [right1Text, right2Text, right3Text]
        return (
          <section className="bg-[rgba(239,244,246,0.5)] py-24">
            <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2">
              <div className="rounded border border-[rgba(71,71,77,0.12)] bg-white p-12 shadow-sm">
                <LeftTitleTag className="mb-12 inline-flex rounded-full bg-[rgba(169,207,255,0.35)] px-6 py-2 text-lg font-display text-[#0f122c]">
                  {toPlainText(leftTitle)}
                </LeftTitleTag>
                <ul className="space-y-8">
                  {leftItems.map((item, index) => (
                    <li key={`${String(item.title ?? "")}-${index}`} className="flex items-start gap-3">
                      <span className="mt-1 text-xs text-[#242742]">•</span>
                      <div>
                        <span className="block text-base font-bold text-[#242742]">{toPlainText(item.title)}</span>
                        <span className="text-sm text-[#46464d]">{renderRichNode(item.text)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col justify-between rounded bg-[rgba(169,207,255,0.2)] p-12">
                <div>
                  <RightTitleTag className="mb-12 inline-flex rounded-full bg-white px-6 py-2 text-lg font-display text-[#0f122c]">
                    {toPlainText(rightTitle)}
                  </RightTitleTag>
                  <ul className="space-y-6">
                    {rightItems.map((item, index) => (
                      <li key={`${String(item ?? "")}-${index}`} className="flex items-start gap-3">
                        <span className="mt-1 text-xs text-[#242742]">•</span>
                        <span className="text-sm font-medium leading-6 text-[#242742]">{renderRichNode(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-12 flex flex-wrap gap-4">
                  <a
                    href={String(primaryCtaHref ?? "").trim() || "#"}
                    className="inline-flex rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm"
                  >
                    {toPlainText(primaryCtaLabel)}
                  </a>
                  <a
                    href={String(secondaryCtaHref ?? "").trim() || "#"}
                    className="inline-flex rounded-xl border border-[rgba(71,71,77,0.12)] bg-white px-8 py-3 text-xs font-bold uppercase shadow-sm"
                  >
                    {toPlainText(secondaryCtaLabel)}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )
      },
    },
    SectionTitle: {
      label: "Titulo de secao",
      defaultProps: {
        eyebrow: "<p>Secao</p>",
        title: "<p>Titulo da secao</p>",
        titleTag: "h2",
        subtitle: "<p>Subtitulo opcional.</p>",
        subtitleTag: "p",
        align: "center",
      },
      fields: {
        eyebrow: { type: "richtext", label: "Eyebrow" },
        title: { type: "richtext", label: "Titulo" },
        titleTag: {
          type: "select",
          label: "Tag do titulo",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        subtitle: { type: "richtext", label: "Subtitulo" },
        subtitleTag: {
          type: "select",
          label: "Tag do subtitulo",
          options: [
            { label: "Paragrafo", value: "p" },
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        align: {
          type: "select",
          label: "Alinhamento",
          options: [
            { label: "Esquerda", value: "left" },
            { label: "Centro", value: "center" },
          ],
        },
      },
      render: ({ eyebrow, title, titleTag, subtitle, subtitleTag, align }) => {
        const alignmentClass = align === "left" ? "text-left" : "text-center"
        const TitleTag = String(titleTag ?? "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
        const SubtitleTag = String(subtitleTag ?? "p") as "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

        return (
          <section className="py-6 md:py-10">
            <div className={`mx-auto max-w-[1200px] px-6 ${alignmentClass}`}>
              {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.22em] text-[#567085]">{toPlainText(eyebrow)}</p> : null}
              {title ? <TitleTag className="mt-2 font-display text-3xl font-bold text-[#0f122c] md:text-5xl">{toPlainText(title)}</TitleTag> : null}
              {subtitle ? <SubtitleTag className="mt-4 text-base leading-7 text-[#24324a] md:text-lg">{toPlainText(subtitle)}</SubtitleTag> : null}
            </div>
          </section>
        )
      },
    },
    RichTextBlock: {
      label: "Texto rico",
      defaultProps: {
        content: "<p>Escreve aqui o conteudo da secao.</p>",
        align: "left",
      },
      fields: {
        content: { type: "richtext", label: "Conteudo" },
        align: {
          type: "select",
          label: "Alinhamento",
          options: [
            { label: "Esquerda", value: "left" },
            { label: "Centro", value: "center" },
          ],
        },
      },
      render: ({ content, align }) => {
        const alignmentClass = align === "center" ? "text-center" : "text-left"

        return (
          <section className="py-6 md:py-8">
            <div className={`mx-auto max-w-[1200px] px-6 text-[#24324a] ${alignmentClass}`}>{renderRichNode(content)}</div>
          </section>
        )
      },
    },
    ImageBlock: {
      label: "Imagem",
      defaultProps: {
        src: "https://placehold.co/1280x720?text=Imagem",
        alt: "Imagem",
        caption: "",
      },
      fields: {
        src: {
          type: "custom",
          label: "URL da imagem",
          render: ({ id, value, onChange, readOnly }) => (
            <FieldLabel label="Imagem" el="div" readOnly={readOnly}>
              <div className="space-y-2">
                <input
                  id={id}
                  type="url"
                  value={String(value ?? "")}
                  readOnly={readOnly}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder="https://..."
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
                <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  Upload imagem
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={readOnly}
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (!file) return
                      const dataUrl = await readFileAsDataUrl(file)
                      onChange(dataUrl)
                    }}
                  />
                </label>
              </div>
            </FieldLabel>
          ),
        },
        alt: { type: "text", label: "Texto alternativo" },
        caption: { type: "richtext", label: "Legenda" },
      },
      render: ({ src, alt, caption }) => {
        return (
          <section className="py-6 md:py-10">
            <div className="mx-auto max-w-[1200px] px-6">
              <figure className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <img src={src} alt={alt || "Imagem"} className="h-auto w-full object-cover" loading="lazy" />
                {caption ? <figcaption className="px-4 py-3 text-sm text-[#4f5f76]">{renderRichNode(caption)}</figcaption> : null}
              </figure>
            </div>
          </section>
        )
      },
    },
    ButtonBlock: {
      label: "Botao",
      defaultProps: {
        label: "<p>Abrir link</p>",
        href: "#",
        align: "left",
      },
      fields: {
        label: { type: "richtext", label: "Texto do botao" },
        href: { type: "text", label: "Link" },
        align: {
          type: "select",
          label: "Alinhamento",
          options: [
            { label: "Esquerda", value: "left" },
            { label: "Centro", value: "center" },
          ],
        },
      },
      render: ({ label, href, align }) => {
        const alignmentClass = align === "center" ? "justify-center" : "justify-start"

        return (
          <section className="py-4 md:py-6">
            <div className={`mx-auto flex max-w-[1200px] px-6 ${alignmentClass}`}>
              <a
                href={href || "#"}
                className="inline-flex items-center justify-center rounded-full bg-[#242742] px-8 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#1d2036]"
              >
                {toPlainText(label) || "Abrir link"}
              </a>
            </div>
          </section>
        )
      },
    },
    TwoColumnsText: {
      label: "2 colunas de texto",
      defaultProps: {
        left: "<p>Conteudo da coluna esquerda.</p>",
        right: "<p>Conteudo da coluna direita.</p>",
      },
      fields: {
        left: { type: "richtext", label: "Coluna esquerda" },
        right: { type: "richtext", label: "Coluna direita" },
      },
      render: ({ left, right }) => {
        return (
          <section className="py-6 md:py-10">
            <div className="mx-auto grid max-w-[1200px] gap-6 px-6 md:grid-cols-2">
              <article className="rounded-2xl bg-[#e8f0f4] px-6 py-6 text-[#24324a] md:px-8 md:py-8">
                {renderRichNode(left)}
              </article>
              <article className="rounded-2xl bg-[#e8f0f4] px-6 py-6 text-[#24324a] md:px-8 md:py-8">
                {renderRichNode(right)}
              </article>
            </div>
          </section>
        )
      },
    },
    Spacer: {
      label: "Espacador",
      defaultProps: {
        height: 32,
      },
      fields: {
        height: {
          type: "number",
          label: "Altura (px)",
          min: 8,
          max: 280,
          step: 4,
        },
      },
      render: ({ height }) => {
        const safeHeight = Number.isFinite(Number(height)) ? Number(height) : 32
        return <div style={{ height: Math.max(8, safeHeight) }} />
      },
    },
    HomeReviewsWidget: {
      label: "Widget Reviews (Home)",
      defaultProps: {
        title: "Widget dinamico: reviews da Home",
        note: "Este bloco e renderizado dinamicamente no site publico.",
      },
      fields: {
        title: { type: "richtext", label: "Titulo" },
        note: { type: "richtext", label: "Nota" },
      },
      render: ({ title, note }) => {
        return (
          <section data-me-widget="home-reviews" className="bg-[#f5fafc] py-20">
            <div className="mx-auto max-w-[1200px] px-6 text-center">
              <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-[rgba(71,71,77,0.24)] bg-white p-8 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#567085]">{toPlainText(title)}</p>
                <div className="mt-3 text-sm leading-7 text-[#46464d]">{renderRichNode(note)}</div>
              </div>
            </div>
          </section>
        )
      },
    },
    RawHtml: {
      label: "HTML livre (legado)",
      defaultProps: {
        html: "<section><div class='mx-auto max-w-[1200px] px-6 py-12'><p>Conteudo HTML.</p></div></section>",
      },
      fields: {
        html: {
          type: "textarea",
          label: "HTML",
        },
      },
      render: ({ html }) => {
        return <div dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(String(html ?? "")) }} />
      },
    },
  },
}

function createStructuredBlock(type: string, props: Record<string, unknown>) {
  return {
    type,
    props: {
      id: createBlockId(),
      ...props,
    },
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && normalizeText(node.textContent).length > 0)
}

function unwrapLegacyWrapper(element: Element): Element {
  let current = element

  while (
    ["DIV", "MAIN", "SECTION", "ARTICLE"].includes(current.tagName) &&
    current.children.length === 1 &&
    !hasDirectText(current) &&
    !current.querySelector('[data-me-widget="home-reviews"]')
  ) {
    const next = current.children[0]
    if (!(next instanceof Element)) break
    current = next
  }

  return current
}

function looksLikeTwoColumns(element: Element) {
  if (element.children.length !== 2) return false

  const [left, right] = Array.from(element.children)
  if (!(left instanceof Element) || !(right instanceof Element)) return false

  const className = (element.getAttribute("class") ?? "").toLowerCase()
  const hasGridHint =
    className.includes("grid") ||
    className.includes("columns") ||
    className.includes("col-") ||
    className.includes("md:grid-cols-2") ||
    className.includes("lg:grid-cols-2")

  const leftText = normalizeText(left.textContent)
  const rightText = normalizeText(right.textContent)
  const hasEnoughText = leftText.length > 36 && rightText.length > 36

  return hasGridHint || hasEnoughText
}

function pickMainImage(element: Element) {
  if (element.tagName === "IMG") {
    return element as HTMLImageElement
  }

  const images = element.querySelectorAll("img")
  if (images.length !== 1) return null
  return images[0] as HTMLImageElement
}

function pickPrimaryButton(element: Element) {
  if (element.tagName === "A") {
    return element as HTMLAnchorElement
  }

  const candidates = Array.from(element.querySelectorAll("a")) as HTMLAnchorElement[]
  const buttonLike = candidates.find((anchor) => {
    const className = (anchor.getAttribute("class") ?? "").toLowerCase()
    return className.includes("btn") || className.includes("button") || className.includes("rounded") || className.includes("bg-")
  })

  if (buttonLike) return buttonLike
  if (candidates.length === 1) return candidates[0]

  return null
}

function extractDirectHeading(element: Element) {
  const heading = element.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6")
  if (!heading) return null
  const text = normalizeText(heading.textContent)
  if (!text) return null
  return heading
}

function extractHomeHeroSectionProps(element: Element) {
  const image = element.querySelector("img")
  const heading = element.querySelector("h1")
  const subheading = element.querySelector("h2")
  const body = element.querySelector("p")
  const button = pickPrimaryButton(element)

  if (!image || !heading || !subheading || !body || !button) return null

  const headingText = normalizeText(heading.textContent)
  const subheadingText = normalizeText(subheading.textContent)
  const bodyText = normalizeText(body.textContent)
  const buttonText = normalizeText(button.textContent)

  if (!headingText || !subheadingText || !bodyText || !buttonText) return null

  const className = (element.getAttribute("class") ?? "").toLowerCase()
  const hasHeroHint =
    element.tagName === "HEADER" ||
    className.includes("lg:py-32") ||
    className.includes("py-20") ||
    className.includes("f5fafc")

  if (!hasHeroHint && !headingText.includes("?")) {
    return null
  }

  return {
    imageSrc: image.getAttribute("src") ?? "https://placehold.co/900x900?text=Foto+Home",
    imageAlt: image.getAttribute("alt") ?? "Imagem principal",
    heading: `<p>${headingText}</p>`,
    headingTag: heading.tagName.toLowerCase(),
    subheading: `<p>${subheadingText}</p>`,
    subheadingTag: subheading.tagName.toLowerCase(),
    body: `<p>${bodyText}</p>`,
    ctaLabel: buttonText,
    ctaHref: button.getAttribute("href") ?? "#",
  }
}

function addConvertedBlocksFromElement(element: Element, blocks: Array<{ type: string; props: Record<string, unknown> }>) {
  const normalizedElement = unwrapLegacyWrapper(element)

  if (normalizedElement.matches('[data-me-widget="home-reviews"]') || normalizedElement.querySelector('[data-me-widget="home-reviews"]')) {
    blocks.push(
      createStructuredBlock("HomeReviewsWidget", {
        title: "Widget dinamico: reviews da Home",
        note: "Este bloco e renderizado dinamicamente no site publico.",
      }),
    )
    return
  }

  const spacerMatch = /(?:height|min-height)\s*:\s*(\d+)px/i.exec(normalizedElement.getAttribute("style") ?? "")
  if (spacerMatch && normalizedElement.children.length === 0) {
    blocks.push(
      createStructuredBlock("Spacer", {
        height: Number(spacerMatch[1]),
      }),
    )
    return
  }

  const homeHeroProps = extractHomeHeroSectionProps(normalizedElement)
  if (homeHeroProps) {
    blocks.push(createStructuredBlock("HomeHeroSection", homeHeroProps))
    return
  }

  if (looksLikeTwoColumns(normalizedElement)) {
    const [left, right] = Array.from(normalizedElement.children) as Element[]
    blocks.push(
      createStructuredBlock("TwoColumnsText", {
        left: sanitizeInlineHtml(left.innerHTML || left.outerHTML),
        right: sanitizeInlineHtml(right.innerHTML || right.outerHTML),
      }),
    )
    return
  }

  const image = pickMainImage(normalizedElement)
  if (image) {
    blocks.push(
      createStructuredBlock("ImageBlock", {
        src: image.getAttribute("src") ?? "https://placehold.co/1280x720?text=Imagem",
        alt: image.getAttribute("alt") ?? "Imagem",
        caption: "",
      }),
    )
    return
  }

  const heading = extractDirectHeading(normalizedElement)
  if (heading) {
    const title = normalizeText(heading.textContent)
    const titleTag = heading.tagName.toLowerCase()
    const subtitleParts = Array.from(normalizedElement.querySelectorAll(":scope > p"))
      .map((paragraph) => normalizeText(paragraph.textContent))
      .filter(Boolean)

    blocks.push(
      createStructuredBlock("SectionTitle", {
        eyebrow: "<p>Secao</p>",
        title: `<p>${title}</p>`,
        titleTag,
        subtitle: subtitleParts.length > 0 ? `<p>${subtitleParts.join(" ")}</p>` : "<p></p>",
        subtitleTag: "p",
        align: "center",
      }),
    )

    const clone = normalizedElement.cloneNode(true) as Element
    clone.querySelectorAll("h1,h2,h3").forEach((node) => node.remove())
    const directAnchors = Array.from(clone.querySelectorAll(":scope > a")) as HTMLAnchorElement[]
    directAnchors.forEach((anchor) => {
      const label = normalizeText(anchor.textContent)
      if (!label) return
      blocks.push(
        createStructuredBlock("ButtonBlock", {
          label,
          href: anchor.getAttribute("href") ?? "#",
          align: "left",
        }),
      )
      anchor.remove()
    })
    const remainder = sanitizeInlineHtml(clone.innerHTML).trim()
    if (remainder.length > 0) {
      blocks.push(
        createStructuredBlock("RichTextBlock", {
          content: remainder,
          align: "left",
        }),
      )
    }

    return
  }

  const button = pickPrimaryButton(normalizedElement)
  if (button && normalizeText(button.textContent).length > 0) {
    blocks.push(
      createStructuredBlock("ButtonBlock", {
        label: normalizeText(button.textContent),
        href: button.getAttribute("href") ?? "#",
        align: "left",
      }),
    )
    return
  }

  const childElements = Array.from(normalizedElement.children)
  const canUnrollChildren =
    ["DIV", "MAIN", "SECTION"].includes(normalizedElement.tagName) &&
    childElements.length > 1 &&
    !hasDirectText(normalizedElement)

  if (canUnrollChildren) {
    childElements.forEach((child) => {
      if (child instanceof Element) {
        addConvertedBlocksFromElement(child, blocks)
      }
    })
    return
  }

  blocks.push(
    createStructuredBlock("RichTextBlock", {
      content: sanitizeInlineHtml(normalizedElement.outerHTML),
      align: "left",
    }),
  )
}

function selectText(element: ParentNode, selector: string) {
  const found = element.querySelector(selector)
  if (!found) return ""
  return normalizeText(found.textContent)
}

function selectFirstText(element: ParentNode, selectors: string[]) {
  for (const selector of selectors) {
    const value = selectText(element, selector)
    if (value) return value
  }
  return ""
}

function findNodeByClassToken(scope: ParentNode, classToken: string) {
  return scope.querySelector(`[class*="${classToken}"]`)
}

function getDirectChildren(element: Element | null) {
  if (!element) return [] as Element[]
  return Array.from(element.children).filter((child): child is Element => child instanceof Element)
}

type TextCard = { eyebrow: string; text: string; element: Element }

function extractSpanParagraphCards(scope: ParentNode) {
  const candidates = Array.from(scope.querySelectorAll("div,article,section")).filter((node): node is Element => node instanceof Element)
  const cards: TextCard[] = []

  candidates.forEach((node) => {
    const span = node.querySelector(":scope > span")
    const paragraph = node.querySelector(":scope > p")
    if (!span || !paragraph) return

    const eyebrow = normalizeText(span.textContent)
    const text = normalizeText(paragraph.textContent)
    if (!eyebrow || !text) return

    cards.push({ eyebrow, text, element: node })
  })

  return cards
}

function stripBulletToken(value: string) {
  return value.replace(/^[-•·\s]+/, "").trim()
}

function extractListItemTexts(item: Element) {
  const spans = Array.from(item.querySelectorAll("span"))
    .map((span) => stripBulletToken(normalizeText(span.textContent)))
    .filter((value) => value.length > 0 && value !== "•")

  if (spans.length >= 2) {
    return {
      first: spans[0],
      second: spans[1],
    }
  }

  const text = stripBulletToken(normalizeText(item.textContent))
  if (!text) {
    return { first: "", second: "" }
  }

  const separatorIndex = text.indexOf(":")
  if (separatorIndex > -1) {
    return {
      first: `${text.slice(0, separatorIndex + 1).trim()}`,
      second: text.slice(separatorIndex + 1).trim(),
    }
  }

  return { first: text, second: "" }
}

function buildHomeStructuredDataFromDefaults(): Data {
  const blocks: PuckBlock[] = [
    createStructuredBlock("HomeHeroSection", { ...HOME_DEFAULTS.hero }),
    createStructuredBlock("HomeObjectiveSection", { ...HOME_DEFAULTS.objective }),
    createStructuredBlock("HomeStepsSection", { ...HOME_DEFAULTS.steps }),
    createStructuredBlock("HomeTrustSection", { ...HOME_DEFAULTS.trust }),
    createStructuredBlock("HomeReviewsWidget", { ...HOME_DEFAULTS.reviews }),
  ]

  return {
    root: {
      props: {
        title: "Home",
      },
    },
    content: blocks,
  } as Data
}

function convertHomeHtmlToStructuredData(html: string): Data {
  const sanitized = sanitizeInlineHtml(String(html ?? "")).trim()
  if (!sanitized) {
    return buildHomeStructuredDataFromDefaults()
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return buildHomeStructuredDataFromDefaults()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="me-home-root">${sanitized}</div>`, "text/html")
  const root = doc.getElementById("me-home-root")
  if (!root) {
    return buildHomeStructuredDataFromDefaults()
  }

  const heroNode = root.querySelector("header")
  const sectionNodes = Array.from(root.querySelectorAll("section"))
  const objectiveNode = sectionNodes[0] ?? null
  const stepsNode = sectionNodes[1] ?? null
  const trustNode = sectionNodes[2] ?? null
  const reviewsNode = root.querySelector('[data-me-widget="home-reviews"], section[data-me-widget="home-reviews"]')

  const heroProps = heroNode ? extractHomeHeroSectionProps(heroNode) : null

  const objectiveScope = objectiveNode ?? root
  const objectiveTopGrid =
    (findNodeByClassToken(objectiveScope, "lg:grid-cols-2") as Element | null) ??
    (objectiveScope.querySelector("div") as Element | null)
  const objectiveTopChildren = getDirectChildren(objectiveTopGrid)
  const objectiveMainColumn = objectiveTopChildren[0] ?? null
  const objectiveMainCards = objectiveMainColumn ? extractSpanParagraphCards(objectiveMainColumn) : []
  const objectiveMainCard = objectiveMainCards[0] ?? null

  const objectiveFeaturesGrid = findNodeByClassToken(objectiveScope, "sm:grid-cols-2")
  const objectiveFeatureCards = objectiveFeaturesGrid ? extractSpanParagraphCards(objectiveFeaturesGrid) : []

  const feature1 = objectiveFeatureCards[0] ?? null
  const feature2 = objectiveFeatureCards[1] ?? null
  const feature3 = objectiveFeatureCards[2] ?? null
  const feature4 = objectiveFeatureCards[3] ?? null

  const objectiveProps = {
    badge:
      objectiveMainCard?.eyebrow ||
      selectFirstText(objectiveScope, ["div > span", "span"]) ||
      HOME_DEFAULTS.objective.badge,
    text:
      objectiveMainCard?.text ||
      selectFirstText(objectiveScope, ["div > p", "p"]) ||
      HOME_DEFAULTS.objective.text,
    feature1Eyebrow: feature1?.eyebrow || HOME_DEFAULTS.objective.feature1Eyebrow,
    feature1Text: feature1?.text || HOME_DEFAULTS.objective.feature1Text,
    feature2Eyebrow: feature2?.eyebrow || HOME_DEFAULTS.objective.feature2Eyebrow,
    feature2Text: feature2?.text || HOME_DEFAULTS.objective.feature2Text,
    feature3Eyebrow: feature3?.eyebrow || HOME_DEFAULTS.objective.feature3Eyebrow,
    feature3Text: feature3?.text || HOME_DEFAULTS.objective.feature3Text,
    feature4Eyebrow: feature4?.eyebrow || HOME_DEFAULTS.objective.feature4Eyebrow,
    feature4Text: feature4?.text || HOME_DEFAULTS.objective.feature4Text,
  }

  const stepsScope = stepsNode ?? root
  const stepsGrid = findNodeByClassToken(stepsScope, "md:grid-cols-3")
  const stepCards = stepsGrid ? extractSpanParagraphCards(stepsGrid) : []
  const step1 = stepCards[0] ?? null
  const step2 = stepCards[1] ?? null
  const step3 = stepCards[2] ?? null

  const stepsProps = {
    title: selectFirstText(stepsScope, ["h2", "h1"]) || HOME_DEFAULTS.steps.title,
    subtitle: selectFirstText(stepsScope, ["div > p", "p"]) || HOME_DEFAULTS.steps.subtitle,
    step1Eyebrow: step1?.eyebrow || HOME_DEFAULTS.steps.step1Eyebrow,
    step1Text: step1?.text || HOME_DEFAULTS.steps.step1Text,
    step2Eyebrow: step2?.eyebrow || HOME_DEFAULTS.steps.step2Eyebrow,
    step2Text: step2?.text || HOME_DEFAULTS.steps.step2Text,
    step3Eyebrow: step3?.eyebrow || HOME_DEFAULTS.steps.step3Eyebrow,
    step3Text: step3?.text || HOME_DEFAULTS.steps.step3Text,
  }

  const trustScope = trustNode ?? root
  const trustTopGrid =
    (findNodeByClassToken(trustScope, "lg:grid-cols-2") as Element | null) ??
    (trustScope.querySelector("div") as Element | null)
  const trustColumns = getDirectChildren(trustTopGrid)
  const trustLeftColumn = trustColumns[0] ?? null
  const trustRightColumn = trustColumns[1] ?? null

  const trustLeftItems = trustLeftColumn
    ? Array.from(trustLeftColumn.querySelectorAll("ul > li"))
        .map((item) => extractListItemTexts(item))
        .filter((item) => item.first.length > 0 || item.second.length > 0)
    : []

  const trustRightItems = trustRightColumn
    ? Array.from(trustRightColumn.querySelectorAll("ul > li"))
        .map((item) => stripBulletToken(normalizeText(item.textContent)))
        .filter(Boolean)
    : []

  const trustRightLinks = trustRightColumn
    ? Array.from(trustRightColumn.querySelectorAll("a[href]")).filter((link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement)
    : []

  const trustProps = {
    leftTitle: (trustLeftColumn && selectFirstText(trustLeftColumn, ["h3"])) || HOME_DEFAULTS.trust.leftTitle,
    left1Title: trustLeftItems[0]?.first || HOME_DEFAULTS.trust.left1Title,
    left1Text: trustLeftItems[0]?.second || HOME_DEFAULTS.trust.left1Text,
    left2Title: trustLeftItems[1]?.first || HOME_DEFAULTS.trust.left2Title,
    left2Text: trustLeftItems[1]?.second || HOME_DEFAULTS.trust.left2Text,
    left3Title: trustLeftItems[2]?.first || HOME_DEFAULTS.trust.left3Title,
    left3Text: trustLeftItems[2]?.second || HOME_DEFAULTS.trust.left3Text,
    rightTitle: (trustRightColumn && selectFirstText(trustRightColumn, ["h3"])) || HOME_DEFAULTS.trust.rightTitle,
    right1Text: trustRightItems[0] || HOME_DEFAULTS.trust.right1Text,
    right2Text: trustRightItems[1] || HOME_DEFAULTS.trust.right2Text,
    right3Text: trustRightItems[2] || HOME_DEFAULTS.trust.right3Text,
    primaryCtaLabel: normalizeText(trustRightLinks[0]?.textContent) || HOME_DEFAULTS.trust.primaryCtaLabel,
    primaryCtaHref: String(trustRightLinks[0]?.getAttribute("href") ?? "").trim() || HOME_DEFAULTS.trust.primaryCtaHref,
    secondaryCtaLabel: normalizeText(trustRightLinks[1]?.textContent) || HOME_DEFAULTS.trust.secondaryCtaLabel,
    secondaryCtaHref: String(trustRightLinks[1]?.getAttribute("href") ?? "").trim() || HOME_DEFAULTS.trust.secondaryCtaHref,
  }

  const blocks: PuckBlock[] = [
    createStructuredBlock("HomeHeroSection", heroProps ?? { ...HOME_DEFAULTS.hero }),
    createStructuredBlock("HomeObjectiveSection", objectiveProps),
    createStructuredBlock("HomeStepsSection", stepsProps),
    createStructuredBlock("HomeTrustSection", trustProps),
  ]

  if (reviewsNode) {
    blocks.push(createStructuredBlock("HomeReviewsWidget", { ...HOME_DEFAULTS.reviews }))
  } else {
    blocks.push(createStructuredBlock("HomeReviewsWidget", { ...HOME_DEFAULTS.reviews }))
  }

  return {
    root: {
      props: {
        title: "Home",
      },
    },
    content: blocks,
  } as Data
}

export function convertLegacyHtmlToPuckData(html: string): Data {
  const sanitized = sanitizeInlineHtml(String(html ?? "")).trim()
  if (!sanitized) return createFallbackPuckDataFromHtml(html)

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return createFallbackPuckDataFromHtml(sanitized)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="me-legacy-root">${sanitized}</div>`, "text/html")
  const root = doc.getElementById("me-legacy-root")

  if (!root) {
    return createFallbackPuckDataFromHtml(sanitized)
  }

  const topLevelElements = Array.from(root.children).filter((node): node is Element => node instanceof Element)
  const blocks: Array<{ type: string; props: Record<string, unknown> }> = []

  topLevelElements.forEach((element) => {
    addConvertedBlocksFromElement(element, blocks)
  })

  if (blocks.length === 0) {
    return createFallbackPuckDataFromHtml(sanitized)
  }

  return {
    root: {
      props: {
        title: "Pagina institucional",
      },
    },
    content: blocks,
  } as Data
}

export function createFallbackPuckDataFromHtml(html: string): Data {
  return {
    root: {
      props: {
        title: "Pagina institucional",
      },
    },
    content: [
      {
        type: "RawHtml",
        props: {
          id: createBlockId(),
          html: sanitizeInlineHtml(String(html ?? "")),
        },
      },
    ],
  }
}

export function extractPuckDataFromLayout(layoutJson: Record<string, unknown> | undefined): Data | null {
  if (!layoutJson || typeof layoutJson !== "object") return null

  const direct = layoutJson.puckData
  if (direct && typeof direct === "object") {
    const data = direct as Record<string, unknown>
    if (Array.isArray(data.content) && data.root && typeof data.root === "object") {
      return data as Data
    }
  }

  const nested = layoutJson.data
  if (nested && typeof nested === "object") {
    const data = nested as Record<string, unknown>
    if (Array.isArray(data.content) && data.root && typeof data.root === "object") {
      return data as Data
    }
  }

  return null
}

function hasBlockType(content: unknown[], type: string) {
  return content.some((block) => block && typeof block === "object" && (block as { type?: unknown }).type === type)
}

function hasStructuredHomeBlocks(data: Data) {
  const content = Array.isArray(data.content) ? data.content : []
  return (
    hasBlockType(content, "HomeHeroSection") &&
    hasBlockType(content, "HomeObjectiveSection") &&
    hasBlockType(content, "HomeStepsSection") &&
    hasBlockType(content, "HomeTrustSection")
  )
}

export function ensureHomeStructuredLayout(data: Data, htmlSource: string): Data {
  if (hasStructuredHomeBlocks(data)) return data

  const candidate = convertHomeHtmlToStructuredData(htmlSource)
  if (hasStructuredHomeBlocks(candidate)) return candidate

  return buildHomeStructuredDataFromDefaults()
}

export function buildHomeBaselinePuckData() {
  return buildHomeStructuredDataFromDefaults()
}

export function renderPuckHtmlSnapshot(data: Data) {
  return renderToStaticMarkup(<Render config={sitePagePuckConfig} data={data} />)
}


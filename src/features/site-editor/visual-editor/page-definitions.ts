import { ROUTES } from "@/lib/constants"
import type { VisualEditorPageDefinition } from "./types"
import { PUBLIC_VISUAL_EDITOR_PAGE_DEFINITIONS } from "./public-page-definitions"

export interface SupportVisualEditorLinkField {
  label: string
  href: string
}

export interface SupportVisualEditorImageField {
  src: string
  alt: string
}

export interface SupportVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    lead: string
    primaryCta: SupportVisualEditorLinkField
    secondaryCta: SupportVisualEditorLinkField
    image: SupportVisualEditorImageField
  }
  supportCta: {
    title: string
    lead: string
    primaryCta: SupportVisualEditorLinkField
    secondaryCta: SupportVisualEditorLinkField
  }
  supportForm: {
    submitLabel: string
  }
  faqSection: {
    searchPlaceholder: string
  }
}

export interface MaterialsVisualEditorLinkField {
  label: string
  href: string
}

export interface MaterialsVisualEditorDocument extends Record<string, unknown> {
  hero: {
    eyebrow: string
    title: string
    lead: string
    primaryCta: MaterialsVisualEditorLinkField
  }
  catalogHelpCta: MaterialsVisualEditorLinkField
  supportCta: {
    title: string
    lead: string
    primaryCta: MaterialsVisualEditorLinkField
    secondaryCta: MaterialsVisualEditorLinkField
  }
  faq: {
    eyebrow: string
    title: string
  }
}

const PAGE_FRAME_FIELD: VisualEditorPageDefinition["fields"][number] = {
  key: "layout.pageFrame",
  label: "Espaço da página",
  kind: "container",
  styleGroup: "container",
  description: "Ajusta o espaço entre o header e o início do conteúdo.",
}

const SUPPORT_IMAGE_SRC = "/support-hero-illustration.svg"

export const SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT: SupportVisualEditorDocument = {
  hero: {
    eyebrow: "Suporte e FAQ",
    title: "Como podemos ajudar?",
    lead:
      "Encontre respostas rapidas na FAQ e, se ainda precisar, abra um ticket para a equipa acompanhar o seu caso.",
    primaryCta: {
      label: "Abrir um ticket",
      href: "/aluno/suporte?openTicketModal=1&ticketStep=form",
    },
    secondaryCta: {
      label: "Entrar na conta",
      href: ROUTES.LOGIN,
    },
    image: {
      src: SUPPORT_IMAGE_SRC,
      alt: "Ilustracao de apoio e contacto",
    },
  },
  supportCta: {
    title: "Ainda precisa de ajuda?",
    lead: "Abra um ticket autenticado para receber acompanhamento pela area do aluno.",
    primaryCta: {
      label: "Abrir um ticket",
      href: "/aluno/suporte?openTicketModal=1&ticketStep=form",
    },
    secondaryCta: {
      label: "Entrar na conta",
      href: ROUTES.LOGIN,
    },
  },
  supportForm: {
    submitLabel: "Enviar formulario",
  },
  faqSection: {
    searchPlaceholder: "Pesquisar no suporte...",
  },
}

export const MATERIALS_VISUAL_EDITOR_DEFAULT_DOCUMENT: MaterialsVisualEditorDocument = {
  hero: {
    eyebrow: "Materiais",
    title: "Tudo o que precisas para brilhares",
    lead:
      "Encontra aqui os teus melhores amigos de estudo: resumos leves, esquemas práticos e o apoio certo para dominares o português e a filosofia sem stress.",
    primaryCta: {
      label: "Explorar catálogo",
      href: "#catalogo",
    },
  },
  catalogHelpCta: {
    label: "Precisas de ajuda para escolher?",
    href: ROUTES.SUPPORT,
  },
  supportCta: {
    title: "Dúvidas? Estou aqui para ajudar!",
    lead:
      "Seja uma questão sobre as sebentas ou um problema técnico, encontras aqui as respostas rápidas. Se não resolver, fala diretamente comigo.",
    primaryCta: {
      label: "Preciso de ajuda!",
      href: ROUTES.SUPPORT,
    },
    secondaryCta: {
      label: "Entrar na conta",
      href: ROUTES.LOGIN,
    },
  },
  faq: {
    eyebrow: "Respostas úteis",
    title: "Perguntas Frequentes",
  },
}

export const VISUAL_EDITOR_PAGE_DEFINITIONS: VisualEditorPageDefinition[] = [
  ...PUBLIC_VISUAL_EDITOR_PAGE_DEFINITIONS,
  {
    pageKey: "support",
    title: "Suporte",
    publicPath: ROUTES.SUPPORT,
    description: "Hero, CTA e imagem da pagina publica de suporte.",
    defaultDocument: SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: [
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda do topo", kind: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.lead", label: "Paragrafo principal", kind: "textarea" },
      { key: "hero.primaryCta", label: "Botao principal", kind: "link", styleGroup: "interactive" },
        { key: "hero.secondaryCta", label: "Link secundario", kind: "link", styleGroup: "interactive" },
        { key: "hero.image", label: "Imagem principal", kind: "image", styleGroup: "image" },
        { key: "supportForm.formContainer", label: "Card do formulario", kind: "container", styleGroup: "container" },
        { key: "supportForm.submitLabel", label: "Rotulo do botao do formulario", kind: "text" },
        { key: "faqSection.container", label: "Bloco da FAQ", kind: "container", styleGroup: "container" },
        { key: "faqSection.searchPlaceholder", label: "Placeholder da pesquisa", kind: "text" },
        { key: "supportCta.container", label: "Card do CTA final", kind: "container", styleGroup: "container" },
        { key: "supportCta.title", label: "Titulo do bloco final", kind: "text", styleGroup: "heading" },
        { key: "supportCta.lead", label: "Paragrafo do bloco final", kind: "textarea" },
      { key: "supportCta.primaryCta", label: "Botao do bloco final", kind: "link", styleGroup: "interactive" },
      { key: "supportCta.secondaryCta", label: "Link extra do bloco final", kind: "link", styleGroup: "interactive" },
    ],
  },
  {
    pageKey: "materials",
    title: "Materiais",
    publicPath: ROUTES.COURSES,
    description: "Hero, CTA de ajuda, suporte e FAQ da pagina publica de materiais.",
    defaultDocument: MATERIALS_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: [
      PAGE_FRAME_FIELD,
      { key: "hero.eyebrow", label: "Legenda do topo", kind: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.lead", label: "Paragrafo principal", kind: "textarea" },
      { key: "hero.primaryCta", label: "Botao principal", kind: "link", styleGroup: "interactive" },
      { key: "catalogHelpCta", label: "Botao de apoio ao catalogo", kind: "link", styleGroup: "interactive" },
      { key: "supportCta.container", label: "Card de apoio final", kind: "container", styleGroup: "container" },
      { key: "supportCta.title", label: "Titulo do bloco final", kind: "text", styleGroup: "heading" },
      { key: "supportCta.lead", label: "Paragrafo do bloco final", kind: "textarea" },
      { key: "supportCta.primaryCta", label: "Botao do bloco final", kind: "link", styleGroup: "interactive" },
      { key: "supportCta.secondaryCta", label: "Link extra do bloco final", kind: "link", styleGroup: "interactive" },
      { key: "faq.eyebrow", label: "Legenda da FAQ", kind: "text" },
      { key: "faq.title", label: "Titulo da FAQ", kind: "text", styleGroup: "heading" },
    ],
  },
]

export function getVisualEditorPageDefinition(pageKey: string) {
  return VISUAL_EDITOR_PAGE_DEFINITIONS.find((page) => page.pageKey === pageKey)
}

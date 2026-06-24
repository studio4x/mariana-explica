import { ROUTES } from "@/lib/constants"
import type { VisualEditorPageDefinition } from "./types"

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

const SUPPORT_IMAGE_SRC =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 720'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='#e0f2fe'/><stop offset='100%' stop-color='#bae6fd'/></linearGradient></defs><rect width='960' height='720' rx='48' fill='url(#g)'/><rect x='70' y='70' width='820' height='580' rx='36' fill='#ffffff' opacity='0.9'/><circle cx='320' cy='280' r='92' fill='#0f172a' opacity='0.08'/><rect x='424' y='200' width='240' height='26' rx='13' fill='#0f172a' opacity='0.16'/><rect x='424' y='246' width='180' height='18' rx='9' fill='#0f172a' opacity='0.12'/><rect x='200' y='440' width='560' height='120' rx='28' fill='#0f172a' opacity='0.05'/><path d='M286 506h388' stroke='#0284c7' stroke-width='18' stroke-linecap='round'/><path d='M408 506l48-48 42 42 70-86 78 70' fill='none' stroke='#0284c7' stroke-width='18' stroke-linecap='round' stroke-linejoin='round'/></svg>"

export const SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT: SupportVisualEditorDocument = {
  hero: {
    eyebrow: "Suporte e FAQ",
    title: "Como podemos ajudar?",
    lead:
      "Encontre respostas rapidas na FAQ e, se ainda precisar, abra um chamado para a equipa acompanhar o seu caso.",
    primaryCta: {
      label: "Abrir um chamado",
      href: "/aluno/chamados?openTicketModal=1&ticketStep=form",
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
    lead: "Abra um chamado autenticado para receber acompanhamento pelo dashboard.",
    primaryCta: {
      label: "Abrir um chamado",
      href: "/aluno/chamados?openTicketModal=1&ticketStep=form",
    },
    secondaryCta: {
      label: "Entrar na conta",
      href: ROUTES.LOGIN,
    },
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
  {
    pageKey: "support",
    title: "Suporte",
    publicPath: ROUTES.SUPPORT,
    description: "Hero, CTA e imagem da pagina publica de suporte.",
    defaultDocument: SUPPORT_VISUAL_EDITOR_DEFAULT_DOCUMENT,
    fields: [
      { key: "hero.eyebrow", label: "Legenda do topo", kind: "text" },
      { key: "hero.title", label: "Titulo principal", kind: "text", styleGroup: "heading" },
      { key: "hero.lead", label: "Paragrafo principal", kind: "textarea" },
      { key: "hero.primaryCta", label: "Botao principal", kind: "link", styleGroup: "interactive" },
      { key: "hero.secondaryCta", label: "Link secundario", kind: "link", styleGroup: "interactive" },
      { key: "hero.image", label: "Imagem principal", kind: "image", styleGroup: "image" },
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

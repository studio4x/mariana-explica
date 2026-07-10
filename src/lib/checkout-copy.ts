import type {
  CheckoutSuccessVisualEditorDocument,
  CheckoutVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"
import type { ProductSummary, ProductType } from "@/types/product.types"

export interface ResolvedCheckoutCopy {
  hero: CheckoutVisualEditorDocument["hero"]
  productBadge: string
  productAccessLabel: string
  productSecureLabel: string
  authPanelEyebrow: string
  authenticatedTitle: string
  authTitleLogin: string
  authTitleRegister: string
  authSubmitLoginLabel: string
  authSubmitRegisterLabel: string
  authSubmitLoginHint: string
  authSubmitRegisterHint: string
  checkoutSubmitLabel: string
  checkoutSubmitHint: string
  pendingVerificationMessage: string
}

export interface ResolvedCheckoutSuccessCopy {
  hero: CheckoutSuccessVisualEditorDocument["hero"]
  nextStep: CheckoutSuccessVisualEditorDocument["nextStep"]
  benefits: CheckoutSuccessVisualEditorDocument["benefits"]
  access: CheckoutSuccessVisualEditorDocument["access"]
}

function resolveProductBadge(productType: ProductType) {
  if (productType === "free") return "MATERIAL GRATUITO"
  if (productType === "external_service") return "ACESSO E ACOMPANHAMENTO"
  return "MATERIAL DE APOIO"
}

function isFreeCheckoutProduct(product: Pick<ProductSummary, "product_type" | "price_cents">) {
  return product.product_type === "free" || product.price_cents === 0
}

export function normalizeCheckoutVisualDocument(
  document: CheckoutVisualEditorDocument,
): CheckoutVisualEditorDocument {
  return {
    ...document,
    hero: {
      ...document.hero,
      eyebrow: document.hero.eyebrow === "Confirmação de pedido" ? "" : document.hero.eyebrow,
      title:
        document.hero.title === "Quase lá! Vamos finalizar a tua inscrição."
          ? "Quase lá! Finaliza o teu pedido abaixo!"
          : document.hero.title,
    },
    productCard: {
      ...document.productCard,
      accessLabel:
        document.productCard.accessLabel === "Acesso na conta"
          ? "Acesso imediato"
          : document.productCard.accessLabel,
    },
  }
}

export function resolveCheckoutCopy(
  document: CheckoutVisualEditorDocument,
  product: Pick<ProductSummary, "product_type" | "price_cents">,
): ResolvedCheckoutCopy {
  const normalizedDocument = normalizeCheckoutVisualDocument(document)
  const isFree = isFreeCheckoutProduct(product)

  if (isFree) {
    return {
      hero: {
        eyebrow: "Ativação de acesso",
        title: "Quase lá! Vamos ativar o teu acesso.",
        lead: "Confirma os teus dados abaixo para entrares na tua área do aluno e começares a estudar sem demoras.",
      },
      productBadge: resolveProductBadge(product.product_type),
      productAccessLabel: "Acesso imediato",
      productSecureLabel: "Acesso protegido",
      authPanelEyebrow: "Acesso gratuito",
      authenticatedTitle: "Aceder gratuitamente",
      authTitleLogin: "Já tenho conta",
      authTitleRegister: "Criar conta",
      authSubmitLoginLabel: "Entrar e ativar acesso",
      authSubmitRegisterLabel: "Criar conta e ativar acesso",
      authSubmitLoginHint: "Ao entrar, usamos a tua conta para ativar este material gratuito.",
      authSubmitRegisterHint: "Ao criares a conta, ligamos o acesso gratuito sem saíres desta página.",
      checkoutSubmitLabel: "Aceder gratuitamente",
      checkoutSubmitHint: "Confirma os teus dados para libertarmos o acesso na tua área do aluno.",
      pendingVerificationMessage:
        "Criámos a conta para {email} e enviámos o email de confirmação. Assim que validares o email, o acesso fica ligado à tua área do aluno.",
    }
  }

  return {
    hero: normalizedDocument.hero,
    productBadge: resolveProductBadge(product.product_type),
    productAccessLabel: normalizedDocument.productCard.accessLabel,
    productSecureLabel: normalizedDocument.productCard.secureLabel,
    authPanelEyebrow: normalizedDocument.authPanel.eyebrow,
    authenticatedTitle: "Confirma os teus dados",
    authTitleLogin: normalizedDocument.authPanel.titleLogin,
    authTitleRegister: normalizedDocument.authPanel.titleRegister,
    authSubmitLoginLabel: "Entrar e continuar",
    authSubmitRegisterLabel: "Criar conta e continuar",
    authSubmitLoginHint: "Ao entrar, usamos a tua conta para avançar para o pagamento.",
    authSubmitRegisterHint: "Ao criar a conta, avançamos para o pagamento sem sair desta página.",
    checkoutSubmitLabel: "Ir para pagamento",
    checkoutSubmitHint: normalizedDocument.productCard.buttonHint,
    pendingVerificationMessage:
      "Criámos a conta para {email} e enviámos o email de confirmação sem travar o checkout.",
  }
}

export function resolveCheckoutSuccessCopy(
  document: CheckoutSuccessVisualEditorDocument,
  mode: string,
): ResolvedCheckoutSuccessCopy {
  if (mode === "free") {
    return {
      hero: {
        eyebrow: "Acesso gratuito ativado",
        title: "Obrigada pela confiança! <3",
        lead: "O teu material já está disponível. Poder começar a explorar os conteúdos imediatamente a partir da tua área de aluno.",
      },
      nextStep: {
        title: "Próximo passo",
        lead: "Entra diretamente na tua área para consultares o material e começares a estudar.",
      },
      benefits: {
        firstTitle: "Organização",
        firstLead: "Todos os teus materiais ficam disponíveis no mesmo sítio.",
        secondTitle: "Acesso imediato",
        secondLead: "O acesso já está ativo e os teus dados continuam protegidos.",
      },
      access: {
        eyebrow: "Acesso rápido",
        primaryCtaLabel: "Ir para o material",
        secondaryCtaLabel: "Abrir área do aluno",
        note: "Se o material demorar a aparecer, basta atualizares a página.",
      },
    }
  }

  return {
    hero: document.hero,
    nextStep: document.nextStep,
    benefits: document.benefits,
    access: document.access,
  }
}

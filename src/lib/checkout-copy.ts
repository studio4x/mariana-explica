import type {
  CheckoutSuccessVisualEditorDocument,
  CheckoutVisualEditorDocument,
} from "@/features/site-editor/visual-editor/public-page-definitions"
import type { ProductType } from "@/types/product.types"

export interface ResolvedCheckoutCopy {
  hero: CheckoutVisualEditorDocument["hero"]
  productBadge: string
  authPanelEyebrow: string
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

export function resolveCheckoutCopy(
  document: CheckoutVisualEditorDocument,
  productType: ProductType,
): ResolvedCheckoutCopy {
  const isFree = productType === "free"

  if (isFree) {
    return {
      hero: {
        eyebrow: "Ativação de acesso",
        title: "Quase lá! Vamos ativar o teu acesso.",
        lead: "Confirma os teus dados abaixo para entrares na tua área do aluno e começares a estudar sem demoras.",
      },
      productBadge: resolveProductBadge(productType),
      authPanelEyebrow: "Acesso gratuito",
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
    hero: document.hero,
    productBadge: resolveProductBadge(productType),
    authPanelEyebrow: document.authPanel.eyebrow,
    authTitleLogin: document.authPanel.titleLogin,
    authTitleRegister: document.authPanel.titleRegister,
    authSubmitLoginLabel: "Entrar e continuar",
    authSubmitRegisterLabel: "Criar conta e continuar",
    authSubmitLoginHint: "Ao entrar, usamos a tua conta para avançar para o pagamento.",
    authSubmitRegisterHint: "Ao criar a conta, avançamos para o pagamento sem sair desta página.",
    checkoutSubmitLabel: "Ir para pagamento",
    checkoutSubmitHint: document.productCard.buttonHint,
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
        title: "O teu material gratuito já está disponível.",
        lead: "O acesso foi ativado com sucesso e já podes começar a explorar os conteúdos a partir da tua área do aluno.",
      },
      nextStep: {
        title: "Próximo passo",
        lead: "Entra diretamente no material para confirmares o acesso e começares a estudar.",
      },
      benefits: {
        firstTitle: "Tudo no mesmo sítio",
        firstLead: "Os teus materiais ficam reunidos na área do aluno para continuares o estudo com clareza.",
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

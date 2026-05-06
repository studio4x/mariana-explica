import type { FaqCategorySummary, FaqSummary } from "@/types/faq.types"

const DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z"

interface FaqCategorySeed {
  slug: string
  title: string
  description: string
  sortOrder: number
}

interface FaqSeed {
  categorySlug: string
  question: string
  answer: string
  sortOrder: number
}

export const DEFAULT_FAQ_CATEGORIES: FaqCategorySeed[] = [
  {
    slug: "payment",
    title: "Pagamentos",
    description: "Compra, checkout, fatura ou acesso apos pagamento.",
    sortOrder: 1,
  },
  {
    slug: "technical",
    title: "Problema tecnico",
    description: "Erro no dashboard, visualizador, downloads ou login.",
    sortOrder: 2,
  },
  {
    slug: "account",
    title: "Conta e acesso",
    description: "Dados da conta, senha, acesso a materiais ou permissao.",
    sortOrder: 3,
  },
  {
    slug: "general",
    title: "Duvida geral",
    description: "Perguntas sobre materiais ou funcionamento.",
    sortOrder: 4,
  },
]

export const DEFAULT_FAQS: FaqSeed[] = [
  {
    categorySlug: "payment",
    question: "Paguei, mas a sebenta ainda nao aparece. O que faco?",
    answer: "Confirma se usaste o mesmo email no pagamento e no registo. Se nao aparecer em 10 minutos, avisa-me em 'Pagamentos'.",
    sortOrder: 1,
  },
  {
    categorySlug: "technical",
    question: "O material nao abre no site.",
    answer: "Tenta atualizar a pagina ou mudar de navegador. Se o erro persistir, manda-me um print.",
    sortOrder: 2,
  },
  {
    categorySlug: "account",
    question: "Perdi a minha palavra-passe.",
    answer: "Clica em 'Recuperar' no login. Se nao receberes o email, fala comigo.",
    sortOrder: 3,
  },
  {
    categorySlug: "general",
    question: "Onde vejo as respostas as minhas duvidas?",
    answer: "Tudo o que conversarmos fica guardado na tua Area do Aluno > Suporte.",
    sortOrder: 4,
  },
]

export function buildDefaultFaqCategories(): FaqCategorySummary[] {
  return DEFAULT_FAQ_CATEGORIES.map((category) => ({
    id: `default-${category.slug}`,
    slug: category.slug,
    title: category.title,
    description: category.description,
    sort_order: category.sortOrder,
    is_active: true,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
  }))
}

export function buildDefaultFaqs(categories = buildDefaultFaqCategories()): FaqSummary[] {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))

  return DEFAULT_FAQS.map((faq, index) => {
    const category = categoryBySlug.get(faq.categorySlug)

    return {
      id: `default-faq-${index + 1}`,
      category_id: category?.id ?? `default-${faq.categorySlug}`,
      question: faq.question,
      answer: faq.answer,
      sort_order: faq.sortOrder,
      is_active: true,
      created_at: DEFAULT_TIMESTAMP,
      updated_at: DEFAULT_TIMESTAMP,
    }
  })
}

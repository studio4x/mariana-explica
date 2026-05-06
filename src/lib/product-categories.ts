import type { ProductSummary } from "@/types/product.types"

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function normalizeCategorySlug(value: string | null | undefined) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export function inferProductCategorySlug(
  product: Pick<ProductSummary, "title" | "slug" | "product_type" | "short_description" | "description">,
) {
  const haystack = normalize(
    `${product.title} ${product.slug} ${product.short_description ?? ""} ${product.description ?? ""}`,
  )

  if (product.product_type === "external_service" || haystack.includes("explicac")) {
    return "explicacoes"
  }

  if (product.product_type === "free") {
    return "gratuitos"
  }

  if (haystack.includes("pack") || haystack.includes("bundle") || haystack.includes("poupanca")) {
    return "packs-poupanca"
  }

  return "sebentas-individuais"
}

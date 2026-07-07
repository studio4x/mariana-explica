import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { ProductCard } from "./ProductCard"
import type { ProductSummary } from "@/types/product.types"

function buildProduct(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: "product-1",
    slug: "sebenta-teste",
    title: "Sebenta Teste",
    short_description: "Resumo do material",
    description: "Descricao completa do material",
    product_type: "paid",
    status: "published",
    price_cents: 1900,
    currency: "EUR",
    cover_image_url: null,
    launch_date: "2026-01-01T00:00:00.000Z",
    is_public: true,
    creator_id: null,
    creator_commission_percent: null,
    workload_minutes: 45,
    has_linear_progression: false,
    quiz_type_settings: {},
    public_page_content: null,
    sales_page_enabled: true,
    requires_auth: false,
    is_featured: false,
    allow_affiliate: false,
    sort_order: 1,
    category_id: null,
    published_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function renderCard(product: ProductSummary) {
  return render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>,
  )
}

describe("ProductCard", () => {
  it("renders the default catalog information when no custom config exists", () => {
    renderCard(buildProduct())

    expect(screen.getByText("Beneficio principal")).toBeInTheDocument()
    expect(screen.getByText("Formato e entrega")).toBeInTheDocument()
    expect(screen.getByText("Como acedes")).toBeInTheDocument()
    expect(screen.getByText(/Valor|Acesso gratuito|Pedido orientado/)).toBeInTheDocument()
  })

  it("renders custom catalog information blocks from product settings", () => {
    renderCard(
      buildProduct({
        public_page_content: {
          catalogCardMode: "custom",
          catalogCardSummary: "Resumo configurado manualmente.",
          catalogCardItems: [
            {
              title: "Para quem e",
              description: "Alunos que querem rever com mais clareza.",
              tone: "soft",
            },
            {
              title: "Entrega",
              description: "Material digital com consulta organizada.",
              tone: "outline",
            },
          ],
        },
      }),
    )

    expect(screen.getByText("Resumo configurado manualmente.")).toBeInTheDocument()
    expect(screen.getByText("Para quem e")).toBeInTheDocument()
    expect(screen.getByText("Entrega")).toBeInTheDocument()
    expect(screen.queryByText("Beneficio principal")).not.toBeInTheDocument()
  })

  it("hides catalog information blocks when the mode is none", () => {
    renderCard(
      buildProduct({
        public_page_content: {
          catalogCardMode: "none",
          catalogCardSummary: "",
          catalogCardItems: [],
        },
      }),
    )

    expect(screen.queryByText("Beneficio principal")).not.toBeInTheDocument()
    expect(screen.queryByText("Formato e entrega")).not.toBeInTheDocument()
    expect(screen.queryByText("Como acedes")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Detalhes/i })).toBeInTheDocument()
  })
})

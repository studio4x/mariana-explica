import { Link } from "react-router-dom"
import { Button } from "@/components/ui"
import { PageHeader } from "@/components/common"

// Placeholder data
const products = [
  {
    id: "1",
    title: "Curso de Matemática Básica",
    description: "Aprenda os fundamentos da matemática de forma prática e divertida.",
    price: "R$ 49,90",
    slug: "curso-matematica-basica"
  },
  {
    id: "2",
    title: "Inglês para Iniciantes",
    description: "Domine o inglês básico com aulas interativas e exercícios práticos.",
    price: "R$ 69,90",
    slug: "ingles-iniciantes"
  },
  {
    id: "3",
    title: "Programação Web",
    description: "Aprenda HTML, CSS e JavaScript do zero até criar seu primeiro site.",
    price: "R$ 89,90",
    slug: "programacao-web"
  }
]

export function Products() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nossos Produtos"
        description="Descubra nossos cursos e materiais educacionais"
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-lg border bg-card text-card-foreground shadow-sm"
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold">{product.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-2xl font-bold">{product.price}</span>
                <Button asChild>
                  <Link to={`/produto/${product.slug}`}>Ver Detalhes</Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
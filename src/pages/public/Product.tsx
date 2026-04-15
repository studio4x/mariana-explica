import { useParams, Link } from "react-router-dom"
import { Button } from "@/components/ui"
import { PageHeader } from "@/components/common"
import { ROUTES } from "@/lib/constants"

// Placeholder data
const productData = {
  "curso-matematica-basica": {
    id: "1",
    title: "Curso de Matemática Básica",
    description: "Aprenda os fundamentos da matemática de forma prática e divertida.",
    price: "R$ 49,90",
    fullDescription: "Este curso abrangente cobre todos os conceitos fundamentais da matemática básica, desde operações aritméticas até geometria elementar. Com aulas em vídeo, exercícios interativos e materiais complementares.",
    features: [
      "20 aulas em vídeo",
      "Exercícios práticos",
      "Materiais de apoio",
      "Certificado de conclusão",
      "Suporte por 6 meses"
    ]
  },
  "ingles-iniciantes": {
    id: "2",
    title: "Inglês para Iniciantes",
    description: "Domine o inglês básico com aulas interativas e exercícios práticos.",
    price: "R$ 69,90",
    fullDescription: "Curso completo para quem está começando a aprender inglês. Focamos na conversação prática e na construção de vocabulário essencial para o dia a dia.",
    features: [
      "30 aulas interativas",
      "Conversação prática",
      "Vocabulário essencial",
      "Exercícios de pronúncia",
      "Materiais complementares"
    ]
  },
  "programacao-web": {
    id: "3",
    title: "Programação Web",
    description: "Aprenda HTML, CSS e JavaScript do zero até criar seu primeiro site.",
    price: "R$ 89,90",
    fullDescription: "Da teoria à prática: aprenda a criar websites modernos e responsivos. Este curso é perfeito para iniciantes que querem entrar no mundo da programação web.",
    features: [
      "25 aulas práticas",
      "Projetos reais",
      "HTML5 e CSS3",
      "JavaScript moderno",
      "Frameworks introdutórios"
    ]
  }
}

export function Product() {
  const { slug } = useParams<{ slug: string }>()
  const product = slug ? productData[slug as keyof typeof productData] : null

  if (!product) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Produto não encontrado"
          description="O produto que você está procurando não existe."
        />
        <Button asChild>
          <Link to={ROUTES.PRODUCTS}>Voltar aos produtos</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.title}
        backTo={ROUTES.PRODUCTS}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            {product.description}
          </p>
          <p className="text-base">
            {product.fullDescription}
          </p>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">O que você vai aprender:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {product.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-3xl font-bold">{product.price}</span>
            </div>
            <Button className="w-full" size="lg">
              Comprar Agora
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Acesso imediato após a compra
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
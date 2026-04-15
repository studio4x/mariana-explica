import { Link } from "react-router-dom"
import { Button } from "@/components/ui"
import { ROUTES, APP_NAME } from "@/lib/constants"

export function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container space-y-6 py-8 md:py-12 lg:py-32">
        <div className="mx-auto flex max-w-[980px] flex-col items-center space-y-4 text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-6xl">
            Bem-vindo ao {APP_NAME}
          </h1>
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Plataforma de venda e entrega de conteúdos educacionais digitais.
            Aprenda no seu ritmo, acesse quando quiser.
          </p>
        </div>
        <div className="flex justify-center space-x-4">
          <Button asChild size="lg">
            <Link to={ROUTES.PRODUCTS}>Ver Produtos</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to={ROUTES.REGISTER}>Cadastrar</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container space-y-6 py-8 md:py-12 lg:py-32">
        <div className="mx-auto flex max-w-[980px] flex-col items-center space-y-4 text-center">
          <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
            Por que escolher {APP_NAME}?
          </h2>
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Oferecemos uma experiência completa de aprendizado digital.
          </p>
        </div>
        <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <div className="space-y-2">
                <h3 className="font-bold">Conteúdo de Qualidade</h3>
                <p className="text-sm text-muted-foreground">
                  Materiais elaborados por especialistas em educação.
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <div className="space-y-2">
                <h3 className="font-bold">Acesso Imediato</h3>
                <p className="text-sm text-muted-foreground">
                  Compre e acesse seus materiais instantaneamente.
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-2">
            <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
              <div className="space-y-2">
                <h3 className="font-bold">Suporte Completo</h3>
                <p className="text-sm text-muted-foreground">
                  Tire suas dúvidas com nossa equipe especializada.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
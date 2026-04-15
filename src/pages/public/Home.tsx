import { Link } from "react-router-dom"
import { ShieldCheck, ShoppingBag, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { ProductCard } from "@/components/product"
import { ROUTES, APP_NAME } from "@/lib/constants"
import { useFeaturedProducts } from "@/hooks/useProducts"

export function Home() {
  const { data: featuredProducts, isLoading, isError, error, refetch } = useFeaturedProducts()

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,39,66,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(223,242,248,0.85),transparent_40%),linear-gradient(180deg,#f8fbfd_0%,#eef8fb_50%,#ffffff_100%)]" />
        <div className="container relative grid gap-10 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-slate-900" />
              Conteúdo digital com acesso seguro
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-950 md:text-6xl">
                Aprenda, compre e acesse tudo em um só lugar.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                {APP_NAME} reúne produtos educacionais com checkout seguro, acesso protegido e uma experiência pensada para evoluir junto com a plataforma.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to={ROUTES.PRODUCTS}>Ver produtos</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to={ROUTES.REGISTER}>Criar conta</Link>
              </Button>
            </div>

            <div className="grid gap-3 pt-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Acesso protegido", text: "Conteúdo e permissões sob controle do banco." },
                { icon: ShoppingBag, title: "Compra simples", text: "Checkout direto do produto para o backend." },
                { icon: Zap, title: "Fluxo rápido", text: "Menos fricção do visitante ao aluno." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <item.icon className="h-5 w-5 text-slate-900" />
                  <p className="mt-3 font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-2xl shadow-slate-200/60 backdrop-blur">
            <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-8 text-white">
              <p className="text-sm uppercase tracking-[0.3em] text-white/70">Base pronta</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight">
                Catálogo real conectado ao Supabase.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/80">
                Os produtos da home vêm do banco e o botão de compra já aciona o backend que cria pedido, grant e sessão de pagamento.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/65">Segurança</p>
                  <p className="mt-2 text-lg font-semibold">RLS e roles</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/65">Backend</p>
                  <p className="mt-2 text-lg font-semibold">Edge Functions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                Produtos em destaque
              </h2>
              <p className="max-w-2xl text-slate-600">
                Alguns dos produtos publicados e prontos para compra.
              </p>
            </div>
            <Button variant="ghost" asChild className="hidden md:inline-flex">
              <Link to={ROUTES.PRODUCTS}>Ver catálogo completo</Link>
            </Button>
          </div>

          {isLoading ? <LoadingState message="Carregando produtos em destaque..." /> : null}
          {isError ? (
            <ErrorState
              title="Não foi possível carregar os produtos"
              message={error instanceof Error ? error.message : "Tente novamente em instantes."}
              onRetry={() => void refetch()}
            />
          ) : null}
          {!isLoading && !isError && (featuredProducts?.length ?? 0) === 0 ? (
            <EmptyState
              title="Sem produtos em destaque"
              message="Ainda não há produtos destacados publicados no banco."
            />
          ) : null}

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredProducts?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                actionLabel="Ver detalhes"
                actionTo={`/produto/${product.slug}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-slate-50/80">
        <div className="container py-16 md:py-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "1. Escolha o produto",
                text: "Veja o catálogo publicado e abra a página com informações reais do banco.",
              },
              {
                title: "2. Finalize a compra",
                text: "O checkout já conversa com o backend para criar pedido e grant.",
              },
              {
                title: "3. Acesse o conteúdo",
                text: "Após a confirmação, o aluno vai para o dashboard com acesso liberado.",
              },
            ].map((step) => (
              <div key={step.title} className="rounded-2xl border bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Como funciona
                </p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}


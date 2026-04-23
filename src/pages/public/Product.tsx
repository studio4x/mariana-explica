import { Link, useParams } from "react-router-dom"
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui"
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback"
import { CourseReviews } from "@/components/reviews"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { useMyProducts } from "@/hooks/useDashboard"
import { usePublishedProductBySlug } from "@/hooks/useProducts"
import { findEnrolledCourse, getEnrolledCourseAction } from "@/lib/course-cta"
import { formatProductPrice } from "@/utils/currency"
import { buildCoursePublicPageView } from "@/lib/course-public-page"

export function Product() {
  const { slug } = useParams<{ slug: string }>()
  const { session } = useAuth()
  const { data: product, isLoading, isError, error, refetch } = usePublishedProductBySlug(slug)
  const { data: enrolledCourses } = useMyProducts({ enabled: Boolean(session) })

  if (isLoading) {
    return <LoadingState message="A carregar curso..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel abrir este curso"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!product) {
    return (
      <EmptyState
        title="Curso nao encontrado"
        message="O curso pedido nao esta publicado ou deixou de estar disponivel."
      />
    )
  }

  const page = buildCoursePublicPageView(product)
  const checkoutIdentifier = product.slug?.trim() || product.id
  const enrolledAction = getEnrolledCourseAction(findEnrolledCourse(product.id, enrolledCourses))

  return (
    <div className="bg-white pb-20 pt-6 text-slate-950">
      <div className="container">
        <Link
          to={ROUTES.PRODUCTS}
          className="inline-flex items-center text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Voltar aos cursos
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
          <main className="min-w-0 space-y-12">
            <section className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-slate-600">
                  {page.eyebrow}
                </span>
                {product.is_featured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                    <Star className="h-3.5 w-3.5" />
                    Destaque
                  </span>
                ) : null}
              </div>

              <h1 className="mt-6 max-w-4xl font-display text-4xl font-black leading-tight text-slate-950 md:text-6xl">
                {page.headline}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
                {page.intro}
              </p>
            </section>

            <section className="max-w-3xl">
              <h2 className="font-display text-3xl font-black text-slate-950">{page.aboutTitle}</h2>
              <div className="mt-5 space-y-5 text-base leading-8 text-slate-600">
                {page.aboutParagraphs.map((paragraph, index) => (
                  <p key={`${paragraph}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-3xl font-black text-slate-950">{page.learnTitle}</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {page.learnItems.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                      <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-3xl font-black text-slate-950">{page.curriculumTitle}</h2>
              <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
                {page.curriculumItems.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">
                          {item.label}
                        </p>
                        <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{item.lessons}</p>
                      </div>
                      <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-slate-400" />
                    </div>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{item.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <CourseReviews productId={product.id} />
          </main>

          <aside className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="relative aspect-video bg-slate-900">
                {product.cover_image_url ? (
                  <img
                    src={product.cover_image_url}
                    alt={`Capa de ${product.title}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#0f766e_0%,#155e75_52%,#172554_100%)] text-white">
                    <Sparkles className="h-12 w-12" />
                  </div>
                )}
              </div>

              <div className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
                    {page.instructorInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">{page.instructorName}</p>
                    <p className="text-sm text-slate-500">{page.instructorRole}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Investimento</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">
                    {formatProductPrice(product.price_cents, product.currency)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{page.priceNote}</p>
                </div>

                <Button asChild className="w-full rounded-md" size="lg">
                  <Link to={enrolledAction?.to ?? `${ROUTES.CHECKOUT}?slug=${encodeURIComponent(checkoutIdentifier)}`}>
                    {enrolledAction?.label ?? page.ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <div className="grid gap-3">
                  {page.sidebarFeatures.map((feature, index) => (
                    <div key={`${feature}-${index}`} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-sky-700" />
                    <p className="text-sm font-black text-slate-950">{page.previewTitle}</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{page.previewText}</p>
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  {product.workload_minutes > 0
                    ? `${product.workload_minutes} minutos estimados`
                    : "Acesso organizado na area do aluno"}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

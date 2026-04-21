import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  PlayCircle,
  RefreshCw,
  UserRound,
} from "lucide-react"
import { ErrorState, LoadingState } from "@/components/feedback"
import { StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { useAuth } from "@/hooks/useAuth"
import { getDashboardProductNote } from "@/lib/product-presentation"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/cn"
import { useDashboardOverview } from "@/hooks/useDashboard"
import { formatDate } from "@/utils/date"
import type { DashboardProductSummary } from "@/types/app.types"

function sanitizeDescription(product: DashboardProductSummary) {
  const text = product.short_description ?? product.description ?? ""
  const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return plainText || "Conteudo liberado para estudar com mais clareza, pratica e seguranca."
}

function isCompleted(product: DashboardProductSummary) {
  return product.lesson_count > 0 && product.progress_percent >= 100
}

function getCourseActionLabel(product: DashboardProductSummary) {
  if (isCompleted(product)) return "Revisar aprendizagem"
  if (product.completed_lessons > 0 || product.progress_percent > 0) return "Continuar aprendizagem"
  return "Iniciar aprendizagem"
}

function getCourseStatus(product: DashboardProductSummary) {
  if (isCompleted(product)) {
    return { label: "Concluido", tone: "success" as const }
  }

  if (product.completed_lessons > 0 || product.progress_percent > 0) {
    return { label: "Em andamento", tone: "info" as const }
  }

  return { label: "Por iniciar", tone: "neutral" as const }
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "slate" | "blue" | "amber" | "emerald"
}) {
  const toneClasses = {
    slate: "border-slate-200 bg-white text-slate-950",
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }

  return (
    <div className={cn("rounded-[28px] border p-5 shadow-sm", toneClasses[tone])}>
      <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </div>
  )
}

function QuickLink({
  to,
  icon,
  title,
  description,
  variant = "blue",
}: {
  to: string
  icon: ReactNode
  title: string
  description: string
  variant?: "blue" | "slate"
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-4 rounded-[24px] border p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
        variant === "blue"
          ? "border-sky-100 bg-sky-50 hover:bg-sky-100/70"
          : "border-slate-200 bg-slate-50 hover:bg-slate-100/70",
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398B7] shadow-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-slate-950">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#1398B7]" />
    </Link>
  )
}

function RecommendedCourseCard({ product }: { product: DashboardProductSummary }) {
  const status = getCourseStatus(product)

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-900 to-slate-700">
        {product.cover_image_url ? (
          <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl font-black tracking-[0.2em] text-white/10">
            LMS
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
        <div className="absolute left-4 top-4">
          <StatusBadge label={status.label} tone={status.tone} />
        </div>
      </div>

      <div className="p-5">
        <h3 className="line-clamp-2 font-display text-xl font-black text-slate-950">{product.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{sanitizeDescription(product)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge label={`${product.module_count} modulos`} tone="info" />
          <StatusBadge label={`${product.lesson_count} aulas`} tone="neutral" />
          <StatusBadge label={`${product.progress_percent}%`} tone={status.tone} />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button asChild className="rounded-full bg-[#1398B7] text-white hover:bg-[#0A3640]">
            <Link to={`${ROUTES.DASHBOARD_PRODUCT}/${product.id}`}>
              {getCourseActionLabel(product)}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-white">
            <Link to={ROUTES.DASHBOARD_PRODUCTS}>Ver catalogo</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const { data, isLoading, isError, error, refetch } = useDashboardOverview()
  const [authFlash] = useState<string | null>(() => {
    const flash =
      window.sessionStorage.getItem("mariana-explica:auth-flash") ??
      window.sessionStorage.getItem("mariana-explica:password-flash")
    if (!flash) {
      return null
    }

    window.sessionStorage.removeItem("mariana-explica:auth-flash")
    window.sessionStorage.removeItem("mariana-explica:password-flash")
    return flash
  })

  if (isLoading) {
    return <LoadingState message="A carregar o teu painel..." />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar o dashboard"
        message={error instanceof Error ? error.message : "Tenta novamente dentro de instantes."}
        onRetry={() => void refetch()}
      />
    )
  }

  const products = data?.products ?? []
  const completedCourses = products.filter(isCompleted)
  const inProgressCourses = products.filter((product) => !isCompleted(product))
  const finalPendingCourses = 0
  const featuredCourse = inProgressCourses[0] ?? products[0] ?? null
  const recommendedCourses = (inProgressCourses.length > 0 ? inProgressCourses : products).slice(0, 2)
  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "Aluno"

  return (
    <div className="space-y-8">
      <header className="border-b border-slate-100 pb-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-sky-600">
              <UserRound className="h-4 w-4" />
              Painel do Aluno
            </span>
            <h1 className="mt-4 font-display text-3xl font-black text-slate-950 sm:text-4xl">
              Ola, {firstName}!
            </h1>
            {profile?.email ? <p className="mt-1 text-sm font-semibold text-slate-500">{profile.email}</p> : null}
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Gerencie sua jornada de estudo, acompanhe sua evolucao e retome seus materiais da Mariana Explica com clareza.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full bg-white font-bold"
            onClick={() => void refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar painel
          </Button>
        </div>

        {authFlash ? (
          <div className="mt-5 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
            {authFlash}
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cursos liberados" value={products.length} tone="slate" />
        <MetricCard label="Em andamento" value={inProgressCourses.length} tone="blue" />
        <MetricCard label="Prova final pendente" value={finalPendingCourses} tone="amber" />
        <MetricCard label="Concluidos" value={completedCourses.length} tone="emerald" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Acesso rapido</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Atalhos do aluno</h2>
            <div className="mt-5 grid gap-3">
              <QuickLink
                to={ROUTES.DASHBOARD_PRODUCTS}
                icon={<BookOpen className="h-5 w-5" />}
                title="Explorar meus cursos"
                description="Acesse todos os materiais liberados para sua conta."
              />
              {featuredCourse ? (
                <QuickLink
                  to={`${ROUTES.DASHBOARD_PRODUCT}/${featuredCourse.id}`}
                  icon={<PlayCircle className="h-5 w-5" />}
                  title={getCourseActionLabel(featuredCourse)}
                  description={featuredCourse.title}
                  variant="slate"
                />
              ) : (
                <QuickLink
                  to={ROUTES.COURSES}
                  icon={<GraduationCap className="h-5 w-5" />}
                  title="Conhecer cursos disponiveis"
                  description="Veja o catalogo publico e escolha o proximo material."
                  variant="slate"
                />
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Destaque</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Proximos cursos recomendados</h2>

            {recommendedCourses.length === 0 ? (
              <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-black text-slate-950">Nenhum curso liberado no momento.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Assim que novos materiais forem atribuidos, eles aparecerao aqui.
                </p>
                <Button asChild className="mt-5 rounded-full bg-[#1398B7] text-white hover:bg-[#0A3640]">
                  <Link to={ROUTES.COURSES}>Ver cursos</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {recommendedCourses.map((product) => (
                  <RecommendedCourseCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Situacao da conta</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Resumo do perfil</h2>

            <div className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-black text-slate-950">Conta ativa para aprendizagem</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Seus materiais liberados estao disponiveis para acesso e continuidade.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Nome</p>
                <p className="mt-2 truncate font-bold text-slate-950">{profile?.full_name || "Nao informado"}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">E-mail</p>
                <p className="mt-2 truncate font-bold text-slate-950">{profile?.email ?? "Nao informado"}</p>
              </div>
            </div>

            <Button asChild variant="outline" className="mt-5 w-full rounded-full bg-white">
              <Link to={ROUTES.DASHBOARD_PROFILE}>
                Editar meus dados
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Leitura rapida</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Status da jornada</h2>
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-[20px] border border-sky-100 bg-sky-50 p-4">
                <span className="text-sm font-bold text-slate-700">Cursos em andamento</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-700">
                  {inProgressCourses.length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[20px] border border-amber-100 bg-amber-50 p-4">
                <span className="text-sm font-bold text-slate-700">Aguardando prova final</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-700">
                  {finalPendingCourses}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[20px] border border-emerald-100 bg-emerald-50 p-4">
                <span className="text-sm font-bold text-slate-700">Cursos concluidos</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">
                  {completedCourses.length}
                </span>
              </div>
            </div>
          </section>

          {featuredCourse ? (
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Continuidade</p>
              <h2 className="mt-2 font-display text-2xl font-black text-slate-950">Ultimo destaque</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{getDashboardProductNote(featuredCourse)}</p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  <span>Progresso</span>
                  <span>{featuredCourse.progress_percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#1398B7]"
                    style={{ width: `${featuredCourse.progress_percent}%` }}
                  />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Liberado em {formatDate(featuredCourse.granted_at)}
              </p>
            </section>
          ) : null}
        </aside>
      </section>
    </div>
  )
}

import { useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ArrowRight, LayoutDashboard, Menu, ShieldCheck, X } from "lucide-react"
import { SiteLogo } from "@/components/common"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/cn"

export function Navbar() {
  const location = useLocation()
  const { isAuthenticated, isAdmin, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = useMemo(
    () =>
      [
        { to: ROUTES.COURSES, label: "Materiais" },
        { to: ROUTES.SUPPORT, label: "Suporte" },
      ].filter(Boolean) as Array<{ to: string; label: string }>,
    [],
  )

  const closeMenu = () => setMobileOpen(false)
  const isActiveItem = (itemTo: string) => {
    return location.pathname.startsWith(itemTo)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[#d9e6ec] bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/78">
      <div className="border-b border-[#e8f0f4] bg-[#f7fbfd]">
        <div className="container flex items-center justify-between gap-3 py-2 text-xs font-semibold text-[#21485e]">
          <p className="truncate">Tens dificuldades a Portugues ou Filosofia? Comeca com um plano claro de estudo.</p>
          <Link to={ROUTES.COURSES} className="hidden items-center gap-1 text-[#163d56] sm:inline-flex">
            Ver materiais
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="container flex items-center justify-between gap-4 py-3.5">
        <div className="flex min-w-0 items-center gap-4">
          <Link to={ROUTES.HOME} className="min-w-0" onClick={closeMenu}>
            <SiteLogo variant="dark" imageClassName="h-12 max-w-[210px]" />
          </Link>

          <nav className="hidden items-center gap-3 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-semibold transition",
                  isActiveItem(item.to)
                    ? "bg-[#e8f4fb] text-[#0f3247]"
                    : "text-slate-600 hover:bg-[#f4f8fa] hover:text-slate-950",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {!isAuthenticated ? (
            <>
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 xl:inline-flex">
                Exames nacionais
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link to={ROUTES.LOGIN}>Entrar</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full bg-[#123f59] hover:bg-[#0f3247]">
                <Link to={ROUTES.COURSES}>
                  Ver materiais
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              {isAdmin ? (
                <Button asChild size="sm" className="rounded-full">
                  <Link to={ROUTES.ADMIN}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Operacao
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="ghost" size="sm" className="rounded-full">
                  <Link to={ROUTES.DASHBOARD}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Area do Aluno
                  </Link>
                </Button>
              )}
              <Button onClick={() => void signOut()} variant="secondary" size="sm" className="rounded-full">
                Sair
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="rounded-full border border-slate-200 md:hidden"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200/80 bg-white/95 md:hidden">
          <div className="container space-y-5 py-5">
            <SiteLogo variant="dark" imageClassName="h-12 max-w-[210px]" />

            <section className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Menu principal</p>
              <nav className="grid gap-2">
                <Link
                  to={ROUTES.COURSES}
                  onClick={closeMenu}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    isActiveItem(ROUTES.COURSES)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  Materiais
                </Link>
                <Link
                  to={ROUTES.SUPPORT}
                  onClick={closeMenu}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    isActiveItem(ROUTES.SUPPORT)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  Suporte
                </Link>
                {isAdmin ? (
                  <Link
                    to={ROUTES.ADMIN}
                    onClick={closeMenu}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-medium transition",
                      isActiveItem(ROUTES.ADMIN)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    Admin
                  </Link>
                ) : null}
              </nav>
            </section>

            <div className="grid gap-3">
              {!isAuthenticated ? (
                <>
                  <Button asChild className="w-full rounded-full">
                    <Link to={ROUTES.COURSES} onClick={closeMenu}>
                      Ver materiais
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full">
                    <Link to={ROUTES.LOGIN} onClick={closeMenu}>
                      Entrar
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  {isAdmin ? (
                    <Button asChild className="w-full rounded-full">
                      <Link to={ROUTES.ADMIN} onClick={closeMenu}>
                        Painel admin
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full rounded-full">
                      <Link to={ROUTES.DASHBOARD} onClick={closeMenu}>
                        Area do Aluno
                      </Link>
                    </Button>
                  )}
                  <Button onClick={() => void signOut()} variant="secondary" className="w-full rounded-full">
                    Sair
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  )
}

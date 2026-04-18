import { useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ArrowRight, GraduationCap, LayoutDashboard, Menu, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui"
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/cn"

export function Navbar() {
  const location = useLocation()
  const { isAuthenticated, isAdmin, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = useMemo(
    () =>
      [
        { to: ROUTES.COURSES, label: "Cursos" },
        isAuthenticated && !isAdmin ? { to: ROUTES.DASHBOARD, label: "Area do aluno" } : null,
        isAdmin ? { to: ROUTES.ADMIN, label: "Admin" } : null,
      ].filter(Boolean) as Array<{ to: string; label: string }>,
    [isAdmin, isAuthenticated],
  )

  const closeMenu = () => setMobileOpen(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/88 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link to={ROUTES.HOME} className="min-w-0" onClick={closeMenu}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-slate-950">{APP_NAME}</p>
                <p className="hidden text-xs text-slate-500 md:block">{APP_DESCRIPTION}</p>
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 p-1.5 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  location.pathname.startsWith(item.to)
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
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
                Exames nacionais e materiais digitais
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link to={ROUTES.LOGIN}>Entrar</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to={ROUTES.COURSES}>
                  Ver cursos
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
                    Continuar estudando
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
          className="rounded-full md:hidden"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200/80 bg-white/95 md:hidden">
          <div className="container space-y-5 py-5">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
              <p className="font-display text-lg font-bold text-slate-950">{APP_NAME}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cursos e materiais claros para exames nacionais, compra simples e area do aluno organizada.
              </p>
            </div>

            <nav className="grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    location.pathname.startsWith(item.to)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="grid gap-3">
              {!isAuthenticated ? (
                <>
                  <Button asChild className="w-full rounded-full">
                    <Link to={ROUTES.COURSES} onClick={closeMenu}>
                      Ver cursos
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
                        Area do aluno
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

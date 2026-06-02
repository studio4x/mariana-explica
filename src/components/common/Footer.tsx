import { Link } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { BUILD_VERSION } from "@/lib/build"
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants"

export function FooterCopyright({ className = "" }: { className?: string }) {
  return (
    <div className={`border-t border-slate-200/80 pt-6 text-sm text-slate-500 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>&copy; 2026 {APP_NAME}. Todos os direitos reservados.</span>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400/90">
            <Link to={ROUTES.PRIVACY} className="transition hover:text-slate-600">
              Privacidade
            </Link>
            <Link to={ROUTES.COOKIES} className="transition hover:text-slate-600">
              Cookies
            </Link>
            <Link to={ROUTES.TERMS} className="transition hover:text-slate-600">
              Termos de uso
            </Link>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400/80">
            Build {BUILD_VERSION}
          </span>
        </div>
      </div>
    </div>
  )
}

export function Footer() {
  const { isAdmin } = useAuth()

  return (
    <footer className="border-t border-white/60 bg-[linear-gradient(180deg,#f5fbfd_0%,#eef7fb_100%)]">
      <div className="container grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="font-display text-2xl font-bold text-slate-950">{APP_NAME}</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{APP_DESCRIPTION}</p>
          </div>
          <p className="text-sm leading-7 text-slate-600">
            Uma experiência pensada para explicar melhor, vender com clareza e dar ao aluno um acesso simples e
            confi?vel aos materiais e ao estudo.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Explorar</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <Link to={ROUTES.HOME} className="hover:text-slate-950">
                Home
              </Link>
              <Link to={ROUTES.COURSES} className="hover:text-slate-950">
                Materiais
              </Link>
              <Link to={ROUTES.SUPPORT} className="hover:text-slate-950">
                Suporte
              </Link>
              <Link to={ROUTES.REGISTER} className="hover:text-slate-950">
                Criar conta
              </Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Conta</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <Link to={ROUTES.LOGIN} className="hover:text-slate-950">
                Entrar
              </Link>
              {!isAdmin ? (
                <Link to={ROUTES.DASHBOARD} className="hover:text-slate-950">
                  Área do aluno
                </Link>
              ) : null}
              <Link to={ROUTES.ADMIN} className="hover:text-slate-950">
                Admin
              </Link>
            </div>
          </div>
        </div>

        <FooterCopyright className="lg:col-span-2" />
      </div>
    </footer>
  )
}

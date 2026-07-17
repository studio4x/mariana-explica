import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Mail } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { fetchPublicBrandingConfig } from "@/services"
import { BUILD_VERSION } from "@/lib/build"
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants"

function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.45" cy="6.65" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

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
  const brandingQuery = useQuery({
    queryKey: ["site", "branding"],
    queryFn: fetchPublicBrandingConfig,
    staleTime: 0,
    refetchOnMount: "always",
  })
  const footerDescription = brandingQuery.data?.config_value.footer_description?.trim() || APP_DESCRIPTION

  return (
    <footer className="border-t border-white/60 bg-[linear-gradient(180deg,#f5fbfd_0%,#eef7fb_100%)]">
      <div className="container grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="font-display text-2xl font-bold text-slate-950">{APP_NAME}</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{footerDescription}</p>
          </div>
          <p className="text-sm leading-7 text-slate-600">
            Uma experiência pensada para simplificar o teu estudo, estruturar a tua preparação para os exames e
            garantir que tens acesso a resumos confiáveis e diretos ao assunto, a qualquer hora.
          </p>
          <div className="grid gap-3 pt-1 text-sm text-slate-600">
            <a
              href="https://www.instagram.com/mariana.explica/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 transition hover:text-slate-950"
              aria-label="Instagram @mariana.explica"
            >
              <InstagramIcon className="h-4 w-4" />
              <span>@mariana.explica</span>
            </a>
            <a
              href="mailto:marianaexplica.online@gmail.com"
              className="inline-flex w-fit items-center gap-2 transition hover:text-slate-950"
              aria-label="Enviar e-mail para marianaexplica.online@gmail.com"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>marianaexplica.online@gmail.com</span>
            </a>
          </div>
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
                  Area do aluno
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

import { Link } from "react-router-dom"
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants"

export function Footer() {
  return (
    <footer className="border-t border-white/60 bg-[linear-gradient(180deg,#f5fbfd_0%,#eef7fb_100%)]">
      <div className="container grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div>
            <p className="font-display text-2xl font-bold text-slate-950">{APP_NAME}</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{APP_DESCRIPTION}</p>
          </div>
          <p className="text-sm leading-7 text-slate-600">
            Uma experiencia pensada para explicar melhor, vender com clareza e dar ao aluno um acesso simples e confiavel aos materiais.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Explorar</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <Link to={ROUTES.HOME} className="hover:text-slate-950">Home</Link>
              <Link to={ROUTES.PRODUCTS} className="hover:text-slate-950">Produtos</Link>
              <Link to={ROUTES.REGISTER} className="hover:text-slate-950">Criar conta</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Conta</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <Link to={ROUTES.LOGIN} className="hover:text-slate-950">Entrar</Link>
              <Link to={ROUTES.DASHBOARD} className="hover:text-slate-950">Area do aluno</Link>
              <Link to={ROUTES.ADMIN} className="hover:text-slate-950">Admin</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/80 pt-6 text-sm text-slate-500 lg:col-span-2">
          © 2026 {APP_NAME}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}

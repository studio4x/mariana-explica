import { Link } from "react-router-dom"
import { Lock, ShieldCheck, Wrench } from "lucide-react"
import { SiteLogo } from "@/components/common/SiteLogo"
import { ROUTES } from "@/lib/constants"

interface MaintenancePageProps {
  message: string
}

export function MaintenancePage({ message }: MaintenancePageProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,44,64,0.16),transparent_34%),linear-gradient(180deg,#eef7fb_0%,#e3f0f6_52%,#f9fcfe_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-lg backdrop-blur sm:p-7">
          <SiteLogo variant="dark" imageClassName="h-12 max-w-[220px]" />
        </div>

        <section className="rounded-[2rem] border border-[#d7e6ee] bg-white p-7 shadow-[0_30px_80px_rgba(18,63,89,0.12)] sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe2eb] bg-[#eef7fb] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#24506a]">
            <Wrench className="h-3.5 w-3.5" />
            Modo manutencao
          </div>

          <h1 className="mt-5 font-display text-3xl font-bold leading-tight text-[#112f45] sm:text-4xl">
            Estamos a preparar melhorias na plataforma
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#456173]">{message}</p>

          <div className="mt-8 grid gap-3 text-sm text-[#36576b] sm:grid-cols-3">
            <div className="rounded-2xl border border-[#d9e8ef] bg-[#f7fbfd] p-4">
              <ShieldCheck className="h-4 w-4 text-[#0f5f74]" />
              <p className="mt-2 font-bold text-[#163d56]">Seguranca preservada</p>
              <p className="mt-1 leading-6">A estrutura e os dados ficam protegidos durante os ajustes.</p>
            </div>
            <div className="rounded-2xl border border-[#d9e8ef] bg-[#f7fbfd] p-4">
              <Lock className="h-4 w-4 text-[#0f5f74]" />
              <p className="mt-2 font-bold text-[#163d56]">Acesso restrito</p>
              <p className="mt-1 leading-6">Apenas administradores autenticados conseguem operar normalmente.</p>
            </div>
            <div className="rounded-2xl border border-[#d9e8ef] bg-[#f7fbfd] p-4">
              <Wrench className="h-4 w-4 text-[#0f5f74]" />
              <p className="mt-2 font-bold text-[#163d56]">Retorno breve</p>
              <p className="mt-1 leading-6">Assim que concluir, o acesso publico volta automaticamente.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.ADMIN)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#123f59] px-6 text-sm font-bold text-white transition hover:bg-[#0f3247]"
            >
              Login de admin
            </Link>
            <Link
              to={ROUTES.SUPPORT}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#cddfe8] bg-white px-6 text-sm font-bold text-[#163d56] transition hover:bg-[#f4f9fc]"
            >
              Falar com suporte
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

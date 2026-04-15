import { Outlet } from "react-router-dom"
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react"

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(36,39,66,0.18),transparent_28%),linear-gradient(180deg,#f6fbfd_0%,#edf7fb_55%,#ffffff_100%)]">
      <div className="container grid min-h-screen items-center gap-10 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,#242742_0%,#365d87_100%)] p-10 text-white shadow-xl lg:block">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="mt-8 max-w-lg font-display text-4xl font-bold leading-tight">
            A tua area de estudo com acesso simples, seguro e organizado.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/80">
            Compra, acesso e acompanhamento no mesmo ambiente, com uma experiencia clara para quem quer aprender sem perder tempo.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, label: "Conta protegida" },
              { icon: Sparkles, label: "Conteudo organizado" },
              { icon: GraduationCap, label: "Rotina de estudo mais simples" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/12 p-4">
                <item.icon className="h-5 w-5" />
                <p className="mt-3 text-sm font-semibold">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/92 p-6 shadow-xl backdrop-blur sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

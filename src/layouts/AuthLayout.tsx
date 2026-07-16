import { Outlet } from "react-router-dom"
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react"
import {
  CookieConsentBanner,
  Footer,
  Navbar,
  ScrollToTop,
  SiteBrandingManager,
  SiteCacheControlManager,
  SiteThemeManager,
  SiteTrackingManager,
} from "@/components/common"

export function AuthLayout() {
  return (
    <div className="public-shell flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,rgba(36,39,66,0.18),transparent_28%),linear-gradient(180deg,#f6fbfd_0%,#edf7fb_55%,#ffffff_100%)]">
      <ScrollToTop />
      <SiteBrandingManager />
      <SiteCacheControlManager />
      <SiteThemeManager />
      <SiteTrackingManager />
      <Navbar />
      <main className="flex-1">
        <div className="container grid min-h-[calc(100vh-8rem)] items-center gap-10 py-6 sm:py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="hidden rounded-[2rem] border border-white/70 bg-[#242742] p-10 text-white shadow-xl lg:block">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="mt-8 max-w-lg font-display text-4xl font-bold leading-tight">
              O teu espaço de estudo simples e sem distrações
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/80">
              Acede às tuas sebentas e acompanha os teus cursos numa plataforma feita para te ajudar a estruturar a
              matéria e a alcançares os teus objetivos.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: "Acesso seguro" },
                { icon: Sparkles, label: "Matéria estruturada" },
                { icon: GraduationCap, label: "Estudo estratégico" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/12 p-4">
                  <item.icon className="h-5 w-5" />
                  <p className="mt-3 text-sm font-semibold">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-xl backdrop-blur sm:p-8">
            <Outlet />
          </div>
        </div>
      </main>
      <CookieConsentBanner />
      <Footer />
    </div>
  )
}

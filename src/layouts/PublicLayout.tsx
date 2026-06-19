import { Outlet, useLocation } from "react-router-dom"
import {
  CookieConsentBanner,
  Footer,
  Navbar,
  ScrollToTop,
  SiteAiPageEditorLauncher,
  SiteBrandingManager,
  SiteThemeManager,
  SiteTrackingManager,
} from "@/components/common"
import { ROUTES } from "@/lib/constants"

export function PublicLayout() {
  const location = useLocation()
  const isCheckout = location.pathname === ROUTES.CHECKOUT

  return (
    <div className="site-typography min-h-screen flex flex-col">
      <ScrollToTop />
      <SiteBrandingManager />
      <SiteThemeManager />
      <SiteTrackingManager />
      {isCheckout ? null : <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteAiPageEditorLauncher />
      <CookieConsentBanner />
      {isCheckout ? null : <Footer />}
    </div>
  )
}

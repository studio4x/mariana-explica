import { Outlet, useLocation } from "react-router-dom"
import { Navbar, Footer } from "@/components/common"
import { ROUTES } from "@/lib/constants"

export function PublicLayout() {
  const location = useLocation()
  const isCheckout = location.pathname === ROUTES.CHECKOUT

  return (
    <div className="min-h-screen flex flex-col">
      {isCheckout ? null : <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

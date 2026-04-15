import { LayoutDashboard, Package, ShoppingCart, Users } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { Navbar } from "@/components/common"
import { cn } from "@/lib/cn"
import { ROUTES } from "@/lib/constants"

const items = [
  { to: ROUTES.ADMIN, label: "Visão geral", icon: LayoutDashboard },
  { to: ROUTES.ADMIN_USERS, label: "Usuários", icon: Users },
  { to: ROUTES.ADMIN_PRODUCTS, label: "Produtos", icon: Package },
  { to: ROUTES.ADMIN_ORDERS, label: "Pedidos", icon: ShoppingCart },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="container grid gap-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border bg-white p-4 shadow-sm">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Operação
          </p>
          <nav className="grid gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.ADMIN}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-[#007BFF] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

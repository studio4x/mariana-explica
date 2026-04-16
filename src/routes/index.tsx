/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter } from "react-router-dom"
import {
  PublicLayout,
  DashboardLayout,
  AdminLayout,
  AuthLayout,
} from "@/layouts"
import { ProtectedRoute, AdminRoute } from "@/components/common"

const Home = lazy(() => import("@/pages/public").then((module) => ({ default: module.Home })))
const Products = lazy(() => import("@/pages/public").then((module) => ({ default: module.Products })))
const Product = lazy(() => import("@/pages/public").then((module) => ({ default: module.Product })))
const Checkout = lazy(() => import("@/pages/public").then((module) => ({ default: module.Checkout })))
const Login = lazy(() => import("@/pages/auth").then((module) => ({ default: module.Login })))
const Register = lazy(() => import("@/pages/auth").then((module) => ({ default: module.Register })))
const AuthCallback = lazy(() => import("@/pages/auth").then((module) => ({ default: module.AuthCallback })))
const ResetPassword = lazy(() =>
  import("@/pages/auth").then((module) => ({ default: module.ResetPassword })),
)
const Dashboard = lazy(() => import("@/pages/dashboard").then((module) => ({ default: module.Dashboard })))
const DashboardDownloads = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardDownloads })),
)
const DashboardNotifications = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardNotifications })),
)
const DashboardProductDetail = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardProductDetail })),
)
const DashboardProducts = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardProducts })),
)
const DashboardProfile = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardProfile })),
)
const DashboardSupport = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardSupport })),
)
const Admin = lazy(() => import("@/pages/admin").then((module) => ({ default: module.Admin })))
const AdminAffiliates = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminAffiliates })),
)
const AdminCoupons = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminCoupons })))
const AdminNotifications = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminNotifications })),
)
const AdminOperations = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminOperations })),
)
const AdminOrders = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminOrders })))
const AdminPayments = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminPayments })),
)
const AdminProducts = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminProducts })),
)
const AdminSupport = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminSupport })))
const AdminUsers = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminUsers })))

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<div className="p-8 text-center">A carregar...</div>}>
      {node}
    </Suspense>
  )
}

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <PublicLayout />,
      children: [
        {
          index: true,
          element: withSuspense(<Home />),
        },
        {
          path: "produtos",
          element: withSuspense(<Products />),
        },
        {
          path: "produto/:slug",
          element: withSuspense(<Product />),
        },
        {
          path: "checkout",
          element: withSuspense(<Checkout />),
        },
      ],
    },
    {
      path: "/",
      element: <AuthLayout />,
      children: [
        {
          path: "login",
          element: withSuspense(<Login />),
        },
        {
          path: "register",
          element: withSuspense(<Register />),
        },
        {
          path: "auth/callback",
          element: withSuspense(<AuthCallback />),
        },
        {
          path: "redefinir-senha",
          element: withSuspense(<ResetPassword />),
        },
      ],
    },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: withSuspense(<Dashboard />),
        },
        {
          path: "produtos",
          element: withSuspense(<DashboardProducts />),
        },
        {
          path: "produto/:id",
          element: withSuspense(<DashboardProductDetail />),
        },
        {
          path: "downloads",
          element: withSuspense(<DashboardDownloads />),
        },
        {
          path: "notificacoes",
          element: withSuspense(<DashboardNotifications />),
        },
        {
          path: "suporte",
          element: withSuspense(<DashboardSupport />),
        },
        {
          path: "perfil",
          element: withSuspense(<DashboardProfile />),
        },
      ],
    },
    {
      path: "/admin",
      element: (
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      ),
      children: [
        {
          index: true,
          element: withSuspense(<Admin />),
        },
        {
          path: "operacoes",
          element: withSuspense(<AdminOperations />),
        },
        {
          path: "usuarios",
          element: withSuspense(<AdminUsers />),
        },
        {
          path: "notificacoes",
          element: withSuspense(<AdminNotifications />),
        },
        {
          path: "produtos",
          element: withSuspense(<AdminProducts />),
        },
        {
          path: "pedidos",
          element: withSuspense(<AdminOrders />),
        },
        {
          path: "suporte",
          element: withSuspense(<AdminSupport />),
        },
        {
          path: "pagamentos",
          element: withSuspense(<AdminPayments />),
        },
        {
          path: "afiliados",
          element: withSuspense(<AdminAffiliates />),
        },
        {
          path: "cupons",
          element: withSuspense(<AdminCoupons />),
        },
      ],
    },
  ],
  {
    basename: import.meta.env.VITE_BASE_URL || "/",
  },
)

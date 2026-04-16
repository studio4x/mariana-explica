import { createBrowserRouter } from "react-router-dom"
import {
  PublicLayout,
  DashboardLayout,
  AdminLayout,
  AuthLayout,
} from "@/layouts"
import { Home, Products, Product, Checkout } from "@/pages/public"
import { Login, Register } from "@/pages/auth"
import {
  Dashboard,
  DashboardDownloads,
  DashboardNotifications,
  DashboardProductDetail,
  DashboardProducts,
  DashboardProfile,
  DashboardSupport,
} from "@/pages/dashboard"
import { Admin, AdminOrders, AdminPayments, AdminProducts, AdminUsers } from "@/pages/admin"
import { ProtectedRoute, AdminRoute } from "@/components/common"

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <PublicLayout />,
      children: [
        {
          index: true,
          element: <Home />,
        },
        {
          path: "produtos",
          element: <Products />,
        },
        {
          path: "produto/:slug",
          element: <Product />,
        },
        {
          path: "checkout",
          element: <Checkout />,
        },
      ],
    },
    {
      path: "/",
      element: <AuthLayout />,
      children: [
        {
          path: "login",
          element: <Login />,
        },
        {
          path: "register",
          element: <Register />,
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
          element: <Dashboard />,
        },
        {
          path: "produtos",
          element: <DashboardProducts />,
        },
        {
          path: "produto/:id",
          element: <DashboardProductDetail />,
        },
        {
          path: "downloads",
          element: <DashboardDownloads />,
        },
        {
          path: "notificacoes",
          element: <DashboardNotifications />,
        },
        {
          path: "suporte",
          element: <DashboardSupport />,
        },
        {
          path: "perfil",
          element: <DashboardProfile />,
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
          element: <Admin />,
        },
        {
          path: "usuarios",
          element: <AdminUsers />,
        },
        {
          path: "produtos",
          element: <AdminProducts />,
        },
        {
          path: "pedidos",
          element: <AdminOrders />,
        },
        {
          path: "pagamentos",
          element: <AdminPayments />,
        },
      ],
    },
  ],
  {
    basename: import.meta.env.VITE_BASE_URL || "/",
  },
)

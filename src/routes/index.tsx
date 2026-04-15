import { createBrowserRouter } from "react-router-dom"
import {
  PublicLayout,
  DashboardLayout,
  AdminLayout,
  AuthLayout,
} from "@/layouts"
import { Home, Products, Product, Checkout } from "@/pages/public"
import { Login, Register } from "@/pages/auth"
import { Dashboard } from "@/pages/dashboard"
import { Admin } from "@/pages/admin"
import { ProtectedRoute, AdminRoute } from "@/components/common"

export const router = createBrowserRouter([
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
    ],
  },
])

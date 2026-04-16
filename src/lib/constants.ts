// Application constants
export const APP_NAME = "Mariana Explica"
export const APP_DESCRIPTION =
  "Materiais claros para exames nacionais, compra simples e area do aluno organizada."

// Routes
export const ROUTES = {
  HOME: "/",
  PRODUCTS: "/produtos",
  PRODUCT: "/produto",
  CHECKOUT: "/checkout",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  DASHBOARD_PRODUCTS: "/dashboard/produtos",
  DASHBOARD_PRODUCT: "/dashboard/produto",
  DASHBOARD_DOWNLOADS: "/dashboard/downloads",
  DASHBOARD_NOTIFICATIONS: "/dashboard/notificacoes",
  DASHBOARD_SUPPORT: "/dashboard/suporte",
  DASHBOARD_PROFILE: "/dashboard/perfil",
  ADMIN: "/admin",
  ADMIN_USERS: "/admin/usuarios",
  ADMIN_PRODUCTS: "/admin/produtos",
  ADMIN_ORDERS: "/admin/pedidos",
} as const

// API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

// Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

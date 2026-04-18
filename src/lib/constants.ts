// Application constants
export const APP_NAME = "Mariana Explica"
export const APP_DESCRIPTION =
  "Cursos e materiais claros para exames nacionais, compra simples e area do aluno organizada."

// Routes
export const ROUTES = {
  HOME: "/",
  COURSES: "/cursos",
  COURSE: "/cursos",
  PRODUCTS: "/cursos",
  PRODUCT: "/cursos",
  CHECKOUT: "/checkout",
  LOGIN: "/login",
  REGISTER: "/register",
  CREATE_ACCOUNT: "/criar-conta",
  AUTH_CALLBACK: "/auth/callback",
  RECOVER_PASSWORD: "/recuperar-senha",
  RESET_PASSWORD: "/redefinir-senha",
  STUDENT_ROOT: "/aluno",
  STUDENT_DASHBOARD: "/aluno/dashboard",
  STUDENT_COURSES: "/aluno/cursos",
  STUDENT_COURSE: "/aluno/cursos",
  STUDENT_PLAYER: "/aluno/cursos",
  STUDENT_DOWNLOADS: "/aluno/downloads",
  STUDENT_NOTIFICATIONS: "/aluno/notificacoes",
  STUDENT_SUPPORT: "/aluno/suporte",
  STUDENT_PROFILE: "/aluno/perfil",
  DASHBOARD: "/aluno/dashboard",
  DASHBOARD_PRODUCTS: "/aluno/cursos",
  DASHBOARD_PRODUCT: "/aluno/cursos",
  DASHBOARD_DOWNLOADS: "/aluno/downloads",
  DASHBOARD_NOTIFICATIONS: "/aluno/notificacoes",
  DASHBOARD_SUPPORT: "/aluno/suporte",
  DASHBOARD_PROFILE: "/aluno/perfil",
  ADMIN: "/admin",
  ADMIN_OPERATIONS: "/admin/operacoes",
  ADMIN_PAYMENTS: "/admin/pagamentos",
  ADMIN_NOTIFICATIONS: "/admin/notificacoes",
  ADMIN_USERS: "/admin/usuarios",
  ADMIN_COURSES: "/admin/cursos",
  ADMIN_PRODUCTS: "/admin/cursos",
  ADMIN_ORDERS: "/admin/pedidos",
  ADMIN_SUPPORT: "/admin/suporte",
  ADMIN_AFFILIATES: "/admin/afiliados",
  ADMIN_COUPONS: "/admin/cupons",
} as const

// API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

// Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

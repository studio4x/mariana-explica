// Application constants
export const APP_NAME = "Mariana Explica"
export const APP_DESCRIPTION =
  "Materiais claros para exames nacionais, compra simples e area do aluno organizada."

// Routes
export const ROUTES = {
  HOME: "/",
  COURSES: "/materiais",
  COURSE: "/materiais",
  PRODUCTS: "/materiais",
  PRODUCT: "/materiais",
  CHECKOUT: "/checkout",
  CHECKOUT_SUCCESS: "/checkout/confirmacao",
  PRIVACY: "/privacidade",
  COOKIES: "/cookies",
  TERMS: "/termos-de-uso",
  SUPPORT: "/suporte",
  EXPLANATIONS: "/explicacoes",
  ABOUT: "/sobre",
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
  STUDENT_PAYMENTS: "/aluno/pagamentos",
  STUDENT_NOTIFICATIONS: "/aluno/notificacoes",
  STUDENT_SUPPORT: "/aluno/chamados",
  STUDENT_MESSAGES: "/aluno/chamados",
  STUDENT_PROFILE: "/aluno/perfil",
  DASHBOARD: "/aluno/dashboard",
  DASHBOARD_PRODUCTS: "/aluno/cursos",
  DASHBOARD_PRODUCT: "/aluno/cursos",
  DASHBOARD_DOWNLOADS: "/aluno/downloads",
  DASHBOARD_PAYMENTS: "/aluno/pagamentos",
  DASHBOARD_NOTIFICATIONS: "/aluno/notificacoes",
  DASHBOARD_SUPPORT: "/aluno/chamados",
  DASHBOARD_MESSAGES: "/aluno/chamados",
  DASHBOARD_PROFILE: "/aluno/perfil",
  ADMIN: "/admin",
  ADMIN_OPERATIONS: "/admin/configuracoes?tab=operacoes",
  ADMIN_PAYMENTS: "/admin/pagamentos",
  ADMIN_SETTINGS: "/admin/configuracoes",
  ADMIN_ACCOUNT: "/admin/minha-conta",
  ADMIN_NOTIFICATIONS: "/admin/notificacoes",
  ADMIN_USERS: "/admin/usuarios",
  ADMIN_COURSES: "/admin/cursos",
  ADMIN_PRODUCTS: "/admin/cursos",
  ADMIN_ORDERS: "/admin/pedidos",
  ADMIN_REVIEWS: "/admin/reviews",
  ADMIN_SUPPORT: "/admin/suporte",
  ADMIN_PUBLIC_FORMS: "/admin/formularios",
  ADMIN_FAQ: "/admin/perguntas-frequentes",
  ADMIN_AFFILIATES: "/admin/afiliados",
  ADMIN_COUPONS: "/admin/cupons",
  ADMIN_PAGE_EDITOR: "/admin/editor-paginas",
} as const

// API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

// Supabase
// Fallback público do projecto para evitar que builds sem VITE_* deixem o cliente "mock".
// Estes valores não concedem acesso administrativo.
const FALLBACK_SUPABASE_URL = "https://gookhgufsxeplelpdaua.supabase.co"
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb2toZ3Vmc3hlcGxlbHBkYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDM1OTYsImV4cCI6MjA5MTY3OTU5Nn0.9uw7Tk9R8-3tlPAJzRY8LxTC5TQMYVkHMf5JWsxqGjI"

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

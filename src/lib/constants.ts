// Constants da aplicação
export const APP_NAME = "Mariana Explica"
export const APP_DESCRIPTION = "Plataforma de venda e entrega de conteúdos educacionais digitais"

// Routes
export const ROUTES = {
  HOME: "/",
  PRODUCTS: "/produtos",
  PRODUCT: "/produto",
  CHECKOUT: "/checkout",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  ADMIN: "/admin",
} as const

// API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

// Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

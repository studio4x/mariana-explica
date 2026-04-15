import type { User } from "npm:@supabase/supabase-js@2"
import { forbidden, notFound, unauthorized } from "./errors.ts"
import { getBearerToken } from "./http.ts"
import { createServiceClient, createUserClient } from "./supabase.ts"

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: "student" | "affiliate" | "admin"
  is_admin: boolean
  status: "active" | "inactive" | "blocked" | "pending_review"
}

export interface AuthContext {
  token: string
  user: User
  profile: UserProfile
  serviceClient: ReturnType<typeof createServiceClient>
}

async function fetchProfile(serviceClient: ReturnType<typeof createServiceClient>, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,full_name,email,role,is_admin,status")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw notFound("Perfil não encontrado")
  }

  return data as UserProfile
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  const token = getBearerToken(req)
  if (!token) {
    throw unauthorized("Token de acesso ausente")
  }

  const userClient = createUserClient(token)
  const serviceClient = createServiceClient()
  const { data, error } = await userClient.auth.getUser(token)

  if (error) {
    throw unauthorized("Sessão inválida", error.message)
  }

  const user = data.user
  if (!user) {
    throw unauthorized("Usuário não autenticado")
  }

  const profile = await fetchProfile(serviceClient, user.id)
  return { token, user, profile, serviceClient }
}

export async function requireActiveUser(req: Request) {
  const context = await requireAuth(req)

  if (context.profile.status !== "active") {
    throw forbidden("Usuário bloqueado ou inativo")
  }

  return context
}

export async function requireAdmin(req: Request) {
  const context = await requireActiveUser(req)

  if (!context.profile.is_admin || context.profile.role !== "admin") {
    throw forbidden("Acesso administrativo negado")
  }

  return context
}


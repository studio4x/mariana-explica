import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"
import { internalError } from "./errors.ts"

function getSupabaseUrl() {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL")
  if (!url) {
    throw internalError("SUPABASE_URL não configurada")
  }

  return url
}

function getAnonKey() {
  const key = Deno.env.get("SUPABASE_ANON_KEY")
  if (!key) {
    throw internalError("SUPABASE_ANON_KEY não configurada")
  }

  return key
}

function getServiceRoleKey() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!key) {
    throw internalError("SUPABASE_SERVICE_ROLE_KEY não configurada")
  }

  return key
}

export function createServiceClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function createUserClient(token: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getAppBaseUrl() {
  return (
    Deno.env.get("APP_BASE_URL") ??
    Deno.env.get("SITE_URL") ??
    Deno.env.get("VITE_APP_URL") ??
    "https://www.mariana-explica.pt"
  )
}


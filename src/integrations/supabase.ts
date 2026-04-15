import { createClient } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

function createNoopQueryBuilder() {
  const builder = {
    select() {
      return builder
    },
    eq() {
      return builder
    },
    order() {
      return builder
    },
    limit() {
      return builder
    },
    maybeSingle: async () => ({ data: null, error: new Error("Supabase não configurado") }),
    single: async () => ({ data: null, error: new Error("Supabase não configurado") }),
  }

  return builder
}

function createNoopSupabaseClient() {
  const queryBuilder = createNoopQueryBuilder()

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase não configurado"),
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase não configurado"),
      }),
    },
    from: () => queryBuilder,
    functions: {
      invoke: async () => ({
        data: null,
        error: new Error("Supabase não configurado"),
      }),
    },
  }
}

export const supabase: any =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createNoopSupabaseClient()

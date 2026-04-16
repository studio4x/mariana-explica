import { createClient } from "@supabase/supabase-js"
import type { Session } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

type QueryResponse<T> = Promise<{ data: T | null; error: Error | null }>

interface NoopQueryBuilder {
  select(..._args: unknown[]): NoopQueryBuilder
  eq(..._args: unknown[]): NoopQueryBuilder
  in(..._args: unknown[]): NoopQueryBuilder
  order(..._args: unknown[]): NoopQueryBuilder
  limit(..._args: unknown[]): NoopQueryBuilder
  update(..._args: unknown[]): NoopQueryBuilder
  insert(..._args: unknown[]): NoopQueryBuilder
  delete(..._args: unknown[]): NoopQueryBuilder
  maybeSingle(): QueryResponse<unknown>
  single(): QueryResponse<unknown>
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
}

type SupabaseLike = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error: null }>
    refreshSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>
    onAuthStateChange: (
      callback: (event: string, session: Session | null) => void | Promise<void>,
    ) => {
      data: {
        subscription: {
          unsubscribe: () => void
        }
      }
    }
    signOut: () => Promise<{ error: null }>
    signInWithPassword: (..._args: unknown[]) => Promise<{ data: unknown; error: Error }>
    signUp: (..._args: unknown[]) => Promise<{ data: unknown; error: Error }>
    resetPasswordForEmail: (..._args: unknown[]) => Promise<{ data: unknown; error: Error | null }>
    updateUser: (..._args: unknown[]) => Promise<{ data: unknown; error: Error | null }>
    exchangeCodeForSession: (code: string) => Promise<{ data: unknown; error: Error | null }>
    verifyOtp: (..._args: unknown[]) => Promise<{ data: unknown; error: Error | null }>
    setSession: (..._args: unknown[]) => Promise<{ data: unknown; error: Error | null }>
  }
  from: (_table: string) => NoopQueryBuilder
  functions: {
    invoke: (
      name: string,
      options?: { body?: unknown; headers?: Record<string, string> },
    ) => Promise<{ data: unknown; error: Error | null }>
  }
}

function createNoopQueryBuilder(): NoopQueryBuilder {
  const builder: NoopQueryBuilder = {
    select(...args: unknown[]) {
      void args
      return builder
    },
    eq(...args: unknown[]) {
      void args
      return builder
    },
    in(...args: unknown[]) {
      void args
      return builder
    },
    order(...args: unknown[]) {
      void args
      return builder
    },
    limit(...args: unknown[]) {
      void args
      return builder
    },
    update(...args: unknown[]) {
      void args
      return builder
    },
    insert(...args: unknown[]) {
      void args
      return builder
    },
    delete(...args: unknown[]) {
      void args
      return builder
    },
    maybeSingle: async () => ({ data: null, error: new Error("Supabase nao configurado") }),
    single: async () => ({ data: null, error: new Error("Supabase nao configurado") }),
    then(onfulfilled, onrejected) {
      return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected)
    },
  }

  return builder
}

function createNoopSupabaseClient() {
  const queryBuilder = createNoopQueryBuilder()

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
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
        error: new Error("Supabase nao configurado"),
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase nao configurado"),
      }),
      resetPasswordForEmail: async () => ({
        data: null,
        error: new Error("Supabase nao configurado"),
      }),
      updateUser: async () => ({
        data: { user: null },
        error: new Error("Supabase nao configurado"),
      }),
      exchangeCodeForSession: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase nao configurado"),
      }),
      verifyOtp: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase nao configurado"),
      }),
      setSession: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase nao configurado"),
      }),
    },
    from: () => queryBuilder,
    functions: {
      invoke: async () => ({
        data: null,
        error: new Error("Supabase nao configurado"),
      }),
    },
  }
}

export const supabase: SupabaseLike =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? (createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as unknown as SupabaseLike)
    : createNoopSupabaseClient()

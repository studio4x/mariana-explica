import { createClient } from "@supabase/supabase-js"
import type { Session } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

type QueryResponse<T> = Promise<{ data: T | null; error: Error | null }>

interface RealtimeChannelLike {
  on: (...args: unknown[]) => RealtimeChannelLike
  subscribe: (callback?: (status: string) => void) => RealtimeChannelLike
}

interface StorageBucketLike {
  uploadToSignedUrl: (
    path: string,
    token: string,
    fileBody: Blob | ArrayBuffer | File | FormData | string,
    fileOptions?: { cacheControl?: string; contentType?: string; upsert?: boolean },
  ) => Promise<{ data: { path: string; fullPath: string } | null; error: Error | null }>
}

interface NoopQueryBuilder {
  select(..._args: unknown[]): NoopQueryBuilder
  eq(..._args: unknown[]): NoopQueryBuilder
  neq(..._args: unknown[]): NoopQueryBuilder
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
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>
  functions: {
    invoke: (
      name: string,
      options?: { body?: unknown; headers?: Record<string, string> },
    ) => Promise<{ data: unknown; error: Error | null }>
  }
  storage: {
    from: (bucket: string) => StorageBucketLike
  }
  channel: (topic: string) => RealtimeChannelLike
  removeChannel: (channel: unknown) => Promise<unknown> | unknown
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
    neq(...args: unknown[]) {
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
    rpc: async () => ({
      data: null,
      error: new Error("Supabase nao configurado"),
    }),
    functions: {
      invoke: async () => ({
        data: null,
        error: new Error("Supabase nao configurado"),
      }),
    },
    storage: {
      from: () => ({
        uploadToSignedUrl: async () => ({
          data: null,
          error: new Error("Supabase nao configurado"),
        }),
      }),
    },
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: () => channel,
      }
      return channel
    },
    removeChannel: async () => "ok",
  }
}

function createSerializedAuthClient(client: ReturnType<typeof createClient>): SupabaseLike {
  let authQueue: Promise<void> = Promise.resolve()

  const enqueueAuthOperation = <T,>(operation: () => Promise<T>) => {
    const run = authQueue.then(operation, operation)
    authQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const wrappedClient = Object.create(client) as typeof client
  wrappedClient.auth = {
    ...client.auth,
    getSession: () => enqueueAuthOperation(() => client.auth.getSession()),
    refreshSession: () => enqueueAuthOperation(() => client.auth.refreshSession()),
    exchangeCodeForSession: (code: string) =>
      enqueueAuthOperation(() => client.auth.exchangeCodeForSession(code)),
    verifyOtp: (...args: Parameters<typeof client.auth.verifyOtp>) =>
      enqueueAuthOperation(() => client.auth.verifyOtp(...args)),
    setSession: (...args: Parameters<typeof client.auth.setSession>) =>
      enqueueAuthOperation(() => client.auth.setSession(...args)),
    signInWithPassword: (...args: Parameters<typeof client.auth.signInWithPassword>) =>
      enqueueAuthOperation(() => client.auth.signInWithPassword(...args)),
    signUp: (...args: Parameters<typeof client.auth.signUp>) =>
      enqueueAuthOperation(() => client.auth.signUp(...args)),
    resetPasswordForEmail: (...args: Parameters<typeof client.auth.resetPasswordForEmail>) =>
      enqueueAuthOperation(() => client.auth.resetPasswordForEmail(...args)),
    updateUser: (...args: Parameters<typeof client.auth.updateUser>) =>
      enqueueAuthOperation(() => client.auth.updateUser(...args)),
    signOut: () => enqueueAuthOperation(() => client.auth.signOut()),
  } as typeof client.auth

  return wrappedClient as unknown as SupabaseLike
}

export const supabase: SupabaseLike =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createSerializedAuthClient(createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
    : createNoopSupabaseClient()

export const publicSupabase: SupabaseLike =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? (createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storageKey: "sb-mariana-explica-public-readonly",
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }) as unknown as SupabaseLike)
    : createNoopSupabaseClient()

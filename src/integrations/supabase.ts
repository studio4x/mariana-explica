import { createClient } from "@supabase/supabase-js"
import type { Session } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/constants"

type SupabaseLock = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>

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
    maybeSingle: async () => ({ data: null, error: new Error("Supabase não configurado") }),
    single: async () => ({ data: null, error: new Error("Supabase não configurado") }),
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
        error: new Error("Supabase não configurado"),
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase não configurado"),
      }),
      resetPasswordForEmail: async () => ({
        data: null,
        error: new Error("Supabase não configurado"),
      }),
      updateUser: async () => ({
        data: { user: null },
        error: new Error("Supabase não configurado"),
      }),
      exchangeCodeForSession: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase não configurado"),
      }),
      verifyOtp: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase não configurado"),
      }),
      setSession: async () => ({
        data: { session: null, user: null },
        error: new Error("Supabase não configurado"),
      }),
    },
    from: () => queryBuilder,
    rpc: async () => ({
      data: null,
      error: new Error("Supabase não configurado"),
    }),
    functions: {
      invoke: async () => ({
        data: null,
        error: new Error("Supabase não configurado"),
      }),
    },
    storage: {
      from: () => ({
        uploadToSignedUrl: async () => ({
          data: null,
          error: new Error("Supabase não configurado"),
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

function createSupabaseAuthLock(): SupabaseLock {
  const inTabQueue = new Map<string, Promise<unknown>>()

  return async (name, acquireTimeout, fn) => {
    const runWithInTabQueue = async () => {
      const previous = inTabQueue.get(name) ?? Promise.resolve()
      let releaseCurrent = () => {}
      const current = new Promise<void>((resolve) => {
        releaseCurrent = resolve
      })
      const queued = previous.then(() => current)
      inTabQueue.set(name, queued)

      try {
        await previous
        return await fn()
      } finally {
        releaseCurrent()
        if (inTabQueue.get(name) === queued) {
          inTabQueue.delete(name)
        }
      }
    }

    if (typeof window === "undefined" || typeof navigator === "undefined" || !("locks" in navigator)) {
      return runWithInTabQueue()
    }

    const safeTimeout = Number.isFinite(acquireTimeout) && acquireTimeout > 0 ? acquireTimeout : 2_500
    const startedAt = Date.now()
    let acquiredResult: Awaited<ReturnType<typeof fn>> | undefined

    while (Date.now() - startedAt < safeTimeout) {
      const didAcquire = await new Promise<boolean>((resolve) => {
        ;(navigator as Navigator & {
          locks?: {
            request: (
              lockName: string,
              options: { ifAvailable: boolean; mode: "exclusive" },
              callback: (lock: unknown | null) => Promise<void>,
            ) => Promise<void>
          }
        }).locks
          ?.request(
            `mariana-explica:${name}`,
            { ifAvailable: true, mode: "exclusive" },
            async (lock) => {
              if (!lock) {
                resolve(false)
                return
              }

              try {
                acquiredResult = await runWithInTabQueue()
              } finally {
                resolve(true)
              }
            },
          )
          .catch(() => resolve(false))
      })

      if (didAcquire) {
        return acquiredResult as Awaited<ReturnType<typeof fn>>
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 40))
    }

    return runWithInTabQueue()
  }
}

const supabaseAuthLock = createSupabaseAuthLock()

export const supabase: SupabaseLike =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? (createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          lock: supabaseAuthLock,
        },
      }) as unknown as SupabaseLike)
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

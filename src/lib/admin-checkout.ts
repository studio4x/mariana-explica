import { SUPABASE_URL } from "@/lib/constants"

export type CheckoutMode = "production" | "sandbox"

export const CHECKOUT_MODE_STORAGE_KEY = "mariana-explica.admin.checkout-mode"

export const CHECKOUT_MODES: Record<
  CheckoutMode,
  {
    label: string
    description: string
    accent: string
    notes: string[]
    checklist: Array<{
      name: string
      description: string
      status: "ready" | "manual"
    }>
  }
> = {
  production: {
    label: "Produção",
    description: "Ambiente real para checkout, webhook e grants em produção.",
    accent: "from-emerald-500 to-emerald-600",
    notes: [
      "Usar credenciais reais da Stripe e webhook de produção.",
      "Manter segredos apenas no backend e nas variáveis protegidas da Vercel/Supabase.",
      "Garantir que checkout, webhook e grants apontam para o mesmo ambiente.",
    ],
    checklist: [
      { name: "VITE_SUPABASE_URL", description: "URL pública do projeto Supabase.", status: "ready" },
      { name: "VITE_SUPABASE_ANON_KEY", description: "Chave pública do frontend.", status: "ready" },
      { name: "VITE_APP_URL", description: "URL pública da aplicação.", status: "ready" },
      { name: "VITE_STRIPE_PUBLIC_KEY", description: "Chave pública da Stripe para checkout.", status: "ready" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Segredo backend para operações administrativas.", status: "manual" },
      { name: "STRIPE_SECRET_KEY", description: "Secret key de produção configurada no backend.", status: "manual" },
      { name: "STRIPE_WEBHOOK_SECRET", description: "Webhook secret de produção configurado no backend.", status: "manual" },
      { name: "create-checkout", description: "Edge Function publicada.", status: "manual" },
      { name: "payment-webhook", description: "Edge Function publicada.", status: "manual" },
      { name: "claim-free-product", description: "Edge Function publicada.", status: "manual" },
      { name: "generate-asset-access", description: "Edge Function publicada.", status: "manual" },
    ],
  },
  sandbox: {
    label: "Sandbox",
    description: "Ambiente de teste para validar checkout, webhook e grants sem impacto comercial.",
    accent: "from-amber-500 to-amber-600",
    notes: [
      "Usar chaves de teste e webhook separado por ambiente.",
      "Validar replay de webhook e idempotência antes de mover para produção.",
      "Manter URLs e segredos separados do ambiente real.",
    ],
    checklist: [
      { name: "VITE_SUPABASE_URL", description: "URL pública do projeto Supabase.", status: "ready" },
      { name: "VITE_SUPABASE_ANON_KEY", description: "Chave pública do frontend.", status: "ready" },
      { name: "VITE_APP_URL", description: "URL pública da aplicação.", status: "ready" },
      { name: "VITE_STRIPE_PUBLIC_KEY", description: "Chave pública de teste da Stripe.", status: "ready" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Segredo backend para operações administrativas.", status: "manual" },
      { name: "STRIPE_SANDBOX_SECRET_KEY", description: "Secret key de teste isolada por ambiente.", status: "manual" },
      { name: "STRIPE_SANDBOX_WEBHOOK_SECRET", description: "Webhook secret de teste isolado por ambiente.", status: "manual" },
      { name: "create-checkout", description: "Edge Function publicada.", status: "manual" },
      { name: "payment-webhook", description: "Edge Function publicada.", status: "manual" },
      { name: "claim-free-product", description: "Edge Function publicada.", status: "manual" },
      { name: "generate-asset-access", description: "Edge Function publicada.", status: "manual" },
    ],
  },
}

export function getCheckoutEndpoints(appUrl: string) {
  const baseAppUrl = appUrl.replace(/\/$/, "")
  const baseSupabaseUrl = SUPABASE_URL.replace(/\/$/, "")

  return [
    {
      label: "Endpoint do checkout",
      value: baseAppUrl ? `${baseAppUrl}/checkout` : "/checkout",
      description: "Página pública que inicia a compra e chama a função backend.",
    },
    {
      label: "Função create-checkout",
      value: baseSupabaseUrl ? `${baseSupabaseUrl}/functions/v1/create-checkout` : "Definir VITE_SUPABASE_URL",
      description: "Edge Function que cria a sessão na Stripe.",
    },
    {
      label: "URL do webhook",
      value: baseSupabaseUrl ? `${baseSupabaseUrl}/functions/v1/payment-webhook` : "Definir VITE_SUPABASE_URL",
      description: "Endpoint registado na Stripe para confirmação e assinatura.",
    },
  ]
}

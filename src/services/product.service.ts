import { supabase } from "@/integrations/supabase"
import type { ProductDetails, ProductSummary } from "@/types/product.types"

const productSelect = `
  id,
  slug,
  title,
  short_description,
  description,
  product_type,
  status,
  price_cents,
  currency,
  cover_image_url,
  sales_page_enabled,
  requires_auth,
  is_featured,
  allow_affiliate,
  sort_order,
  published_at
`

export async function fetchPublishedProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ProductSummary[]
}

export async function fetchFeaturedProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .limit(3)

  if (error) {
    throw error
  }

  return (data ?? []) as ProductSummary[]
}

export async function fetchPublishedProductBySlug(slug: string): Promise<ProductSummary | null> {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as ProductSummary | null
}

export async function fetchPublishedProductDetailsBySlug(slug: string): Promise<ProductDetails | null> {
  const { data, error } = await supabase
    .from("products")
    .select(productSelect)
    .eq("status", "published")
    .eq("sales_page_enabled", true)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as ProductDetails | null
}

export function isFreeProduct(product: Pick<ProductSummary, "product_type" | "price_cents">) {
  return product.product_type === "free" || product.price_cents === 0
}

import { useQuery } from "@tanstack/react-query"
import {
  fetchFeaturedProducts,
  fetchPublishedProductBySlug,
  fetchPublishedProducts,
} from "@/services"

export function useFeaturedProducts() {
  return useQuery({
    queryKey: ["products", "featured"],
    queryFn: fetchFeaturedProducts,
  })
}

export function usePublishedProducts() {
  return useQuery({
    queryKey: ["products", "published"],
    queryFn: fetchPublishedProducts,
  })
}

export function usePublishedProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["products", "published", slug],
    queryFn: () => fetchPublishedProductBySlug(slug ?? ""),
    enabled: Boolean(slug),
  })
}


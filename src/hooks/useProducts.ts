import { useQuery } from "@tanstack/react-query"
import {
  fetchAdminPreviewProductBySlug,
  fetchAdminPreviewCourseOutlineByProductId,
  fetchFeaturedProducts,
  fetchPublishedCourseOutlineByProductId,
  fetchPublishedProductCategories,
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

export function usePublishedProductCategories() {
  return useQuery({
    queryKey: ["products", "categories"],
    queryFn: fetchPublishedProductCategories,
  })
}

export function usePublishedProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["products", "published", slug],
    queryFn: () => fetchPublishedProductBySlug(slug ?? ""),
    enabled: Boolean(slug),
  })
}

export function useAdminPreviewProductBySlug(slug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["products", "admin-preview", slug],
    queryFn: () => fetchAdminPreviewProductBySlug(slug ?? ""),
    enabled: enabled && Boolean(slug),
  })
}

export function usePublishedCourseOutlineByProductId(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["products", "outline", "published", productId],
    queryFn: () => fetchPublishedCourseOutlineByProductId(productId ?? ""),
    enabled: enabled && Boolean(productId),
  })
}

export function useAdminPreviewCourseOutlineByProductId(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["products", "outline", "admin-preview", productId],
    queryFn: () => fetchAdminPreviewCourseOutlineByProductId(productId ?? ""),
    enabled: enabled && Boolean(productId),
  })
}


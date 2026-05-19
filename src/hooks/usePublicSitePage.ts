import { useQuery } from "@tanstack/react-query"
import { fetchPublicSitePageBySlug } from "@/services"
import type { SitePageSlug } from "@/types/app.types"

export function usePublicSitePage(slug: SitePageSlug) {
  return useQuery({
    queryKey: ["site", "page", slug],
    queryFn: () => fetchPublicSitePageBySlug(slug),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}


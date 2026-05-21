import { useQuery } from "@tanstack/react-query"
import { fetchPublicSitePage } from "@/services"
import type { PublicSitePagePayload } from "@/types/app.types"

const PUBLIC_SITE_PAGE_STALE_TIME = 60_000

export function usePublicSitePage(slug: string | undefined) {
  return useQuery<PublicSitePagePayload | null>({
    queryKey: ["site", "page", slug],
    queryFn: () => fetchPublicSitePage(slug ?? ""),
    enabled: Boolean(slug),
    staleTime: PUBLIC_SITE_PAGE_STALE_TIME,
  })
}

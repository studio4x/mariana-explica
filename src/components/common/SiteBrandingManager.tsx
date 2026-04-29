import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPublicBrandingConfig } from "@/services"
import {
  BRANDING_UPDATED_EVENT,
  applySiteFavicon,
  buildVersionedAssetUrl,
} from "./site-branding"

export function SiteBrandingManager() {
  const queryClient = useQueryClient()
  const brandingConfigQuery = useQuery({
    queryKey: ["site", "branding"],
    queryFn: fetchPublicBrandingConfig,
    staleTime: 0,
    refetchOnMount: "always",
  })

  useEffect(() => {
    const branding = brandingConfigQuery.data
    const faviconUrl = buildVersionedAssetUrl(
      branding?.config_value.favicon.public_url,
      branding?.config_value.favicon.uploaded_at ?? branding?.updated_at ?? null,
    )

    applySiteFavicon(faviconUrl)
  }, [brandingConfigQuery.data])

  useEffect(() => {
    const refreshBranding = () => {
      void queryClient.invalidateQueries({ queryKey: ["site", "branding"] })
      void queryClient.refetchQueries({ queryKey: ["site", "branding"] })
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "mariana-explica:branding-updated") {
        refreshBranding()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(BRANDING_UPDATED_EVENT, refreshBranding)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(BRANDING_UPDATED_EVENT, refreshBranding)
    }
  }, [queryClient])

  return null
}

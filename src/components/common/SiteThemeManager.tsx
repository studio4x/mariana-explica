import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPublicSiteThemeConfig } from "@/services"
import { SITE_THEME_UPDATED_EVENT, applySiteTheme } from "./site-theme"

export function SiteThemeManager() {
  const queryClient = useQueryClient()
  const siteThemeQuery = useQuery({
    queryKey: ["site", "theme"],
    queryFn: fetchPublicSiteThemeConfig,
    staleTime: 0,
    refetchOnMount: "always",
  })

  useEffect(() => {
    applySiteTheme(siteThemeQuery.data)
  }, [siteThemeQuery.data])

  useEffect(() => {
    const refreshTheme = () => {
      void queryClient.invalidateQueries({ queryKey: ["site", "theme"] })
      void queryClient.refetchQueries({ queryKey: ["site", "theme"] })
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "mariana-explica:site-theme-updated") {
        refreshTheme()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(SITE_THEME_UPDATED_EVENT, refreshTheme)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(SITE_THEME_UPDATED_EVENT, refreshTheme)
    }
  }, [queryClient])

  return null
}

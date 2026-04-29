import { GraduationCap } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/cn"
import { APP_NAME } from "@/lib/constants"
import { fetchPublicBrandingConfig } from "@/services"
import { buildVersionedAssetUrl } from "./site-branding"

type SiteLogoVariant = "light" | "dark"

function getAssetUrl(
  config: Awaited<ReturnType<typeof fetchPublicBrandingConfig>> | undefined,
  variant: SiteLogoVariant,
) {
  if (!config) return null

  const asset = variant === "light" ? config.config_value.logo_light : config.config_value.logo_dark
  const url = asset.public_url?.trim()

  if (!url) {
    return null
  }

  return buildVersionedAssetUrl(url, asset.uploaded_at?.trim() || config.updated_at?.trim() || "")
}

export function SiteLogo({
  variant,
  className,
  imageClassName,
  fallbackTextClassName,
}: {
  variant: SiteLogoVariant
  className?: string
  imageClassName?: string
  fallbackTextClassName?: string
}) {
  const brandingConfigQuery = useQuery({
    queryKey: ["site", "branding"],
    queryFn: fetchPublicBrandingConfig,
    staleTime: 0,
    refetchOnMount: "always",
  })

  const logoUrl = getAssetUrl(brandingConfigQuery.data, variant)

  if (logoUrl) {
    return (
      <div className={cn("flex min-w-0 items-center", className)}>
        <img
          src={logoUrl}
          alt={APP_NAME}
          className={cn("h-12 max-w-[220px] object-contain object-left", imageClassName)}
        />
      </div>
    )
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="h-5 w-5" />
      </div>
      <p className={cn("truncate font-display text-lg font-bold text-slate-950", fallbackTextClassName)}>{APP_NAME}</p>
    </div>
  )
}

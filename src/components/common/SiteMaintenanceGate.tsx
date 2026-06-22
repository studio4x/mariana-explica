import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useAuth } from "@/hooks/useAuth"
import { fetchPublicSiteMaintenanceConfig } from "@/services"
import { MaintenancePage } from "@/pages/public/Maintenance"

export function SiteMaintenanceGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth()
  const maintenanceQuery = useQuery({
    queryKey: ["site", "maintenance"],
    queryFn: fetchPublicSiteMaintenanceConfig,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  })

  const maintenanceEnabled = maintenanceQuery.data?.config_value.enabled ?? false
  const maintenanceMessage =
    maintenanceQuery.data?.config_value.message ??
    "Estamos em manutencao para melhorar a tua experiência. Voltamos em breve."

  if (!maintenanceEnabled || isAdmin) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef7fb] px-4 text-center text-sm font-semibold text-slate-600">
        A verificar o teu acesso...
      </div>
    )
  }

  return <MaintenancePage message={maintenanceMessage} />
}

import { Outlet } from "react-router-dom"
import { Navbar } from "@/components/common"

export function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-6">
        <Outlet />
      </main>
    </div>
  )
}
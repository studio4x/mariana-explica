import { PageHeader } from "@/components/common"

export function Admin() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Administrativo"
        description="Gerencie usuários, produtos e configurações do sistema"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Total de Usuários</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Produtos Ativos</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Pedidos Hoje</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>
    </div>
  )
}
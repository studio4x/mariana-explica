import { PageHeader } from "@/components/common"

export function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Bem-vindo ao seu painel de controle"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Meus Produtos</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Em Andamento</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Concluídos</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium">Certificados</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>
    </div>
  )
}
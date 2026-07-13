import { Link2 } from "lucide-react"
import type { ModuleAssetSummary } from "@/types/app.types"

interface LessonAdditionalResourcesProps {
  assets: ModuleAssetSummary[]
  isOpening?: boolean
  onOpen: (assetId: string) => void
}

export function LessonAdditionalResources({ assets, isOpening = false, onOpen }: LessonAdditionalResourcesProps) {
  if (assets.length === 0) return null

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5 md:px-7">
        <p className="inline-flex rounded-full border border-[#009bc3] bg-[#eafaff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#007ea5]">
          Recursos adicionais da aula
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Acesse aqui os materiais complementares disponíveis para esta aula.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 px-6 py-7 md:px-7">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#009bc3] bg-white px-3 text-sm font-semibold text-[#007ea5] transition-colors hover:bg-[#eafaff] hover:text-[#006c8d] disabled:cursor-wait disabled:opacity-60"
            onClick={() => onOpen(asset.id)}
            disabled={isOpening}
            aria-label={`Abrir recurso ${asset.title}`}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {asset.title}
          </button>
        ))}
      </div>
    </section>
  )
}

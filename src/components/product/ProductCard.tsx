import { Link } from "react-router-dom"
import { ArrowRight, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui"
import { formatProductPrice } from "@/utils/currency"
import type { ProductSummary } from "@/types/product.types"

interface ProductCardProps {
  product: ProductSummary
  actionLabel?: string
  actionTo?: string
  onActionClick?: () => void
  isBusy?: boolean
  compact?: boolean
}

const productTypeLabel: Record<ProductSummary["product_type"], string> = {
  paid: "Pago",
  free: "Gratuito",
  hybrid: "Híbrido",
  external_service: "Serviço externo",
}

export function ProductCard({
  product,
  actionLabel = "Ver detalhes",
  actionTo,
  onActionClick,
  isBusy = false,
  compact = false,
}: ProductCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-[linear-gradient(135deg,#242742_0%,#2f5f8a_55%,#dff2f8_100%)]">
        {product.cover_image_url ? (
          <img
            src={product.cover_image_url}
            alt={product.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
            {productTypeLabel[product.product_type]}
          </span>
          {product.is_featured ? (
            <span className="rounded-full bg-amber-300/95 px-3 py-1 text-xs font-semibold text-amber-950">
              Destaque
            </span>
          ) : null}
        </div>
      </div>

      <div className={`flex flex-1 flex-col gap-4 p-6 ${compact ? "p-5" : ""}`}>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">{product.title}</h3>
          <p className="text-sm leading-6 text-slate-600">
            {product.short_description ?? product.description ?? "Conteúdo digital pronto para acessar."}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">A partir de</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatProductPrice(product.price_cents, product.currency)}
            </p>
          </div>

          {actionTo ? (
            <Button asChild>
              <Link to={actionTo}>
                {actionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : onActionClick ? (
            <Button onClick={onActionClick} disabled={isBusy}>
              {actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to={`/produto/${product.slug}`}>
                <LockKeyhole className="mr-2 h-4 w-4" />
                Detalhes
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

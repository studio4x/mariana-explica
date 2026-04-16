import { Link } from "react-router-dom"
import { ArrowRight, BadgeCheck, Clock3, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui"
import { formatProductPrice } from "@/utils/currency"
import type { ProductSummary } from "@/types/product.types"
import {
  getProductFamilyLabel,
  getProductNarrative,
  getProductTypeLabel,
} from "@/lib/product-presentation"

interface ProductCardProps {
  product: ProductSummary
  actionLabel?: string
  actionTo?: string
  onActionClick?: () => void
  isBusy?: boolean
  compact?: boolean
}

export function ProductCard({
  product,
  actionLabel = "Ver detalhes",
  actionTo,
  onActionClick,
  isBusy = false,
  compact = false,
}: ProductCardProps) {
  const narrative = getProductNarrative(product)
  const typeLabel = getProductTypeLabel(product.product_type)
  const familyLabel = getProductFamilyLabel(product)
  const priceLabel =
    product.product_type === "free"
      ? "Acesso gratuito"
      : product.product_type === "external_service"
        ? "Pedido orientado"
        : "Investimento"

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/92 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
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
            {typeLabel}
          </span>
          {product.is_featured ? (
            <span className="rounded-full bg-amber-300/95 px-3 py-1 text-xs font-semibold text-amber-950">
              Destaque
            </span>
          ) : null}
        </div>
        {!product.cover_image_url ? (
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">{familyLabel}</p>
            <p className="max-w-xs font-display text-2xl font-bold leading-tight">{product.title}</p>
          </div>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col gap-5 p-6 ${compact ? "p-5" : ""}`}>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{familyLabel}</p>
            <h3 className="font-display text-2xl font-bold tracking-tight text-slate-900">{product.title}</h3>
          </div>
          <p className="text-sm leading-7 text-slate-600">{narrative.cardSummary}</p>
        </div>

        <div className="grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50/80 px-4 py-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Beneficio principal</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{narrative.benefit}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50/80 px-4 py-3">
            <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Formato e entrega</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{narrative.formatLabel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Como acedes</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {narrative.accessLabel}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{priceLabel}</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatProductPrice(product.price_cents, product.currency)}
            </p>
          </div>

          {actionTo ? (
            <Button asChild className="rounded-full">
              <Link to={actionTo}>
                {actionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : onActionClick ? (
            <Button onClick={onActionClick} disabled={isBusy} className="rounded-full">
              {actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button asChild variant="outline" className="rounded-full">
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

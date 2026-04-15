import { cn } from "@/lib/cn"

interface StatusBadgeProps {
  label: string
  tone?: "neutral" | "success" | "warning" | "danger" | "info"
}

const toneClasses: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral: "border border-slate-200 bg-slate-100 text-slate-700",
  success: "border border-emerald-200 bg-emerald-100 text-emerald-700",
  warning: "border border-amber-200 bg-amber-100 text-amber-800",
  danger: "border border-rose-200 bg-rose-100 text-rose-700",
  info: "border border-sky-200 bg-sky-100 text-sky-700",
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase",
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  )
}

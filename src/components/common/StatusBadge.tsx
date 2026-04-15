import { cn } from "@/lib/cn"

interface StatusBadgeProps {
  label: string
  tone?: "neutral" | "success" | "warning" | "danger" | "info"
}

const toneClasses: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase",
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  )
}

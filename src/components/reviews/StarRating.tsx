import { Star } from "lucide-react"

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
}

const sizeClass = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
}

export function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value)
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            className={readonly ? "cursor-default" : "rounded-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-500"}
            aria-label={readonly ? undefined : `${star} estrelas`}
          >
            <Star
              className={`${sizeClass[size]} ${filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
            />
          </button>
        )
      })}
    </div>
  )
}

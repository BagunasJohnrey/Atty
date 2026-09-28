import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        active: "border-emerald-200 bg-emerald-100 text-emerald-800",
        upcoming: "border-amber-200 bg-amber-100 text-amber-900",
        closed: "border-slate-200 bg-slate-100 text-slate-600",
        success: "border-emerald-200 bg-emerald-100 text-emerald-800",
        warning: "border-orange-200 bg-orange-100 text-orange-900",
        error: "border-red-200 bg-red-100 text-red-800",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }

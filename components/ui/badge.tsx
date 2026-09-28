import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        active:
          "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/60 dark:text-emerald-300",
        upcoming:
          "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-300",
        closed:
          "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-400/20 dark:bg-slate-800/60 dark:text-slate-300",
        success:
          "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/60 dark:text-emerald-300",
        warning:
          "border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-400/30 dark:bg-orange-950/60 dark:text-orange-300",
        error:
          "border-red-200 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-950/60 dark:text-red-300",
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

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        active:
          "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
        upcoming:
          "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        closed:
          "border-border bg-muted text-muted-foreground",
        success:
          "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]",
        warning:
          "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        error:
          "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]",
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

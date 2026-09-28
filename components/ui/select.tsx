import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative block")}>
      <select
        data-slot="select"
        className={cn(
          "clay-input h-11 w-full appearance-none border-2 border-transparent bg-card pr-9 pl-4 text-sm outline-none",
          "text-foreground focus:border-ring disabled:cursor-not-allowed disabled:opacity-55",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </span>
  )
}

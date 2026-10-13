import * as React from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ref, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      data-slot="input"
      className={cn(
        "clay-input h-11 w-full border-2 border-transparent bg-card px-4 text-sm outline-none",
        "placeholder:text-muted-foreground/50 focus:border-ring",
        className
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)}
      {...props}
    />
  )
}

export function Textarea({ className, ref, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "clay-input w-full border-2 border-transparent bg-card px-4 py-3 text-sm outline-none",
        "placeholder:text-muted-foreground/50 focus:border-ring",
        className
      )}
      {...props}
    />
  )
}

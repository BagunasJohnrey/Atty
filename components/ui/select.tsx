"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Custom clay dropdown. Fully styled trigger + popup (no OS rendering),
 * with Base UI keyboard support, typeahead, and ARIA built in.
 */
export function ClaySelect({
  id,
  value,
  onChange,
  placeholder,
  options,
  allLabel,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: string[]
  allLabel: string
  className?: string
}) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(typeof v === "string" ? v : "")}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          "clay-input group flex h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm outline-none",
          "focus:border-ring data-[placeholder]:text-muted-foreground [&[aria-expanded=true]_svg]:rotate-180",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform"
          aria-hidden
        />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} className="z-50">
          <SelectPrimitive.Popup
            className={cn(
              "clay animate-clay-pop max-h-64 w-[var(--anchor-width)] overflow-y-auto p-2"
            )}
          >
            <SelectPrimitive.List>
              <SelectPrimitive.Item
                value=""
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-muted"
              >
                <SelectPrimitive.ItemText>{allLabel}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-4 text-primary" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option}
                  value={option}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-muted data-[selected]:font-semibold"
                >
                  <SelectPrimitive.ItemText>{option}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

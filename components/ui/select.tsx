"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Check, ChevronDown, X } from "lucide-react"
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

/**
 * Searchable clay dropdown for long option lists (Course facet).
 * Typed text stays visible in the input and filters the popup list.
 */
export function ClayCombobox({
  id,
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: string[]
  className?: string
}) {
  return (
    <ComboboxPrimitive.Root
      items={options}
      value={value || null}
      onValueChange={(v) => onChange(typeof v === "string" ? v : "")}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "clay-input flex h-11 w-full items-center gap-1 pr-2 pl-4 outline-none",
          "focus-within:border-ring",
          className
        )}
      >
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {value ? (
          <ComboboxPrimitive.Clear
            aria-label="Clear course filter"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </ComboboxPrimitive.Clear>
        ) : null}
        <ComboboxPrimitive.Trigger
          aria-label="Show all options"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="size-4" aria-hidden />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={6} className="z-50">
          <ComboboxPrimitive.Popup className="clay animate-clay-pop max-h-64 w-[var(--anchor-width)] overflow-y-auto p-2">
            <ComboboxPrimitive.Empty className="px-3 py-2.5 text-sm text-muted-foreground">
              No matches found.
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: string) => (
                <ComboboxPrimitive.Item
                  key={item}
                  value={item}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-muted data-[selected]:font-semibold"
                >
                  {item}
                  <ComboboxPrimitive.ItemIndicator>
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

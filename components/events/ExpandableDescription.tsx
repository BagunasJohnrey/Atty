"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A one-line description that expands to its full text when clicked.
 *
 * The toggle is only offered when the text actually overflows at the current
 * width, measured against the clamped element, so a short description does
 * not look interactive for no reason. A resize re-measures, which keeps the
 * affordance honest across breakpoints.
 */
export function ExpandableDescription({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [overflowing, setOverflowing] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      // While expanded the element shows everything, so the clamped height
      // is gone. Keep the last answer instead of resetting to "fits".
      if (expanded) return
      setOverflowing(element.scrollHeight > element.clientHeight + 1)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, text])

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={expanded}
      onClick={() => {
        if (overflowing) setExpanded((open) => !open)
      }}
      className={cn(
        "text-left text-sm text-muted-foreground",
        expanded ? "whitespace-pre-line" : "line-clamp-1",
        overflowing ? "cursor-pointer hover:text-foreground" : "cursor-default",
        className
      )}
    >
      {text}
    </button>
  )
}

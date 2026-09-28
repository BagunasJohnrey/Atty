"use client"

import * as React from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Opens the browser print dialog on mount so Save as PDF is one step. */
export function PrintButton() {
  const fired = React.useRef(false)

  React.useEffect(() => {
    if (fired.current) return
    fired.current = true
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Button className="clay-btn" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Print / Save as PDF
    </Button>
  )
}

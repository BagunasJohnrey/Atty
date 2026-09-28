"use client"

import * as React from "react"
import { Maximize, Minimize } from "lucide-react"
import { Button } from "@/components/ui/button"

function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange)
  return () => document.removeEventListener("fullscreenchange", onChange)
}

function getFullscreenSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function" &&
    // Fullscreen can be denied (e.g. embedded previews); hide the toggle
    // there instead of failing silently on click.
    document.fullscreenEnabled !== false
  )
}

function getFullscreenActive(): boolean {
  return typeof document !== "undefined" && document.fullscreenElement !== null
}

/**
 * Kiosk fullscreen toggle (Fullscreen API). Snapshots keep server and
 * first client render identical (hidden), so hydration never mismatches;
 * the button appears right after mount on supporting browsers.
 */
export function FullscreenToggle() {
  const supported = React.useSyncExternalStore(
    subscribeFullscreen,
    getFullscreenSupported,
    () => false
  )
  const active = React.useSyncExternalStore(
    subscribeFullscreen,
    getFullscreenActive,
    () => false
  )

  if (!supported) return null

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Fullscreen requires a user gesture; the click already is one,
      // so failures (e.g. iframe permissions) stay silent by design.
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={active ? "Exit fullscreen" : "Enter fullscreen"}
      aria-pressed={active}
      title={active ? "Exit fullscreen" : "Enter fullscreen"}
      className="clay-btn rounded-full"
      onClick={() => void toggle()}
    >
      {active ? (
        <Minimize className="size-4" aria-hidden />
      ) : (
        <Maximize className="size-4" aria-hidden />
      )}
    </Button>
  )
}

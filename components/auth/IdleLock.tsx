"use client"

import * as React from "react"
import { logout } from "@/lib/api-client"
import { IDLE_TIMEOUT_MINUTES } from "@/lib/auth/constants"

/**
 * Walk-away guard for shared kiosks: ends the session after sustained
 * inactivity and returns to login. The session cookie only covers full
 * browser exits; this covers the browser left open.
 *
 * Rendered once inside the authenticated shell (never on /login). Same
 * exit path as the manual Log out button: a hard navigation so no
 * authenticated view survives in any client cache.
 */
export function IdleLock() {
  React.useEffect(() => {
    const limit = IDLE_TIMEOUT_MINUTES * 60 * 1000
    let last = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined

    async function lock() {
      try {
        await logout()
      } finally {
        // A hard navigation, not a client-side push: same reasoning as the
        // manual Log out button — ending a session must discard every
        // client cache so the proxy makes a fresh auth decision.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login")
      }
    }

    function arm() {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => void lock(), limit)
    }

    function poke() {
      last = Date.now()
      arm()
    }

    function checkReturn() {
      // Sleep and background-tab throttling pause timers; an overdue
      // return locks immediately instead of granting extra time.
      if (Date.now() - last >= limit) void lock()
      else arm()
    }

    arm()
    window.addEventListener("pointerdown", poke)
    window.addEventListener("keydown", poke)
    window.addEventListener("wheel", poke, { passive: true })
    window.addEventListener("touchstart", poke, { passive: true })
    document.addEventListener("visibilitychange", checkReturn)
    window.addEventListener("focus", checkReturn)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      window.removeEventListener("pointerdown", poke)
      window.removeEventListener("keydown", poke)
      window.removeEventListener("wheel", poke)
      window.removeEventListener("touchstart", poke)
      document.removeEventListener("visibilitychange", checkReturn)
      window.removeEventListener("focus", checkReturn)
    }
  }, [])

  return null
}

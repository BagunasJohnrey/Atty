"use client"

import * as React from "react"

export function useOnline(): boolean {
  // Always start `true` so server prerender and first client render match.
  // The real `navigator.onLine` value is synced in an effect (after hydration).
  const [online, setOnline] = React.useState(true)
  React.useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])
  return online
}

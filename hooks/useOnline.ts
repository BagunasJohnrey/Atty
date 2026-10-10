"use client"

import * as React from "react"

export function useOnline(): boolean {
  // Always start `true` so server prerender and first client render match.
  // The real `navigator.onLine` value is synced in an effect (after hydration).
  const [online, setOnline] = React.useState(true)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe sync: first render must match the server (true); real value applies after mount.
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

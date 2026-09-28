"use client"

import * as React from "react"

interface CacheEntry<T> {
  data: T | null
  error: Error | null
  updatedAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

/**
 * Minimal stale-while-revalidate cache for reads.
 * Batch-friendly: dedupes in-flight requests by key.
 * Loading is derived from cache presence (no sync setState in effects).
 */
export function useCached<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  staleMs = 10_000
): { data: T | null; error: Error | null; loading: boolean; refresh: () => void } {
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  const fetcherRef = React.useRef(fetcher)

  React.useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const refresh = React.useCallback(() => {
    if (!key) return
    cache.delete(key)
    inflight.delete(key)
    force()
  }, [key])

  React.useEffect(() => {
    if (!key || !fetcherRef.current) return
    const currentKey = key
    const entry = cache.get(currentKey) as CacheEntry<T> | undefined
    const fresh = entry && Date.now() - entry.updatedAt < staleMs
    if (entry && fresh) return

    let cancelled = false
    let promise = inflight.get(currentKey) as Promise<T> | undefined
    if (!promise && fetcherRef.current) {
      const run = fetcherRef.current
      promise = run()
      inflight.set(currentKey, promise)
      force()
    }
    promise
      ?.then((data) => {
        inflight.delete(currentKey)
        cache.set(currentKey, { data, error: null, updatedAt: Date.now() })
        if (!cancelled) force()
      })
      .catch((error: Error) => {
        inflight.delete(currentKey)
        cache.set(currentKey, { data: null, error, updatedAt: Date.now() })
        if (!cancelled) force()
      })
    return () => {
      cancelled = true
    }
  }, [key, staleMs])

  const entry = (key ? cache.get(key) : undefined) as CacheEntry<T> | undefined
  const enabled = Boolean(key && fetcher)
  return {
    data: entry?.data ?? null,
    error: entry?.error ?? null,
    loading: enabled && !entry,
    refresh,
  }
}

export function invalidatePrefix(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}

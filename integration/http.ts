import { getAppsScriptConfig } from "./config"
import { AppsScriptError } from "./errors"
import type { ApiFailure, ApiResult, ApiSuccess } from "@/models/api"

const REQUEST_TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 2

let warmedUp = false

function isApiResult(value: unknown): value is ApiResult<object> {
  if (typeof value !== "object" || value === null) return false
  return (
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  )
}

/**
 * Sends an action to the Apps Script Web App and returns the success payload.
 *
 * Works around the one-time 302 redirect that Apps Script issues after each
 * redeploy: a GET warm-up resolves the redirect so the POST reaches the
 * executor directly.
 *
 * Each request carries a cache-busting query parameter so intermediaries
 * (including Next.js's fetch cache) can never serve a stale redirect target:
 * Apps Script ignores query parameters for doPost routing, which reads the
 * JSON body instead.
 *
 * @param action - The API action to execute.
 * @param params  - Additional request fields, merged under the action.
 */
export async function requestAppsScript<TPayload extends object>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<ApiSuccess<TPayload>> {
  const { url, secret } = getAppsScriptConfig()
  const body = JSON.stringify({ secret, action, ...params })

  if (!warmedUp) {
    await warmUp(url)
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await send(cacheBusted(url), body, action)
    const payload = parse(response, action)

    if (payload.success) {
      return payload as ApiSuccess<TPayload>
    }

    if (payload.code === "METHOD_NOT_ALLOWED" && attempt === 0) {
      warmedUp = false
      await warmUp(url)
      continue
    }

    throw new AppsScriptError(payload.code, payload.message, action)
  }

  throw new AppsScriptError(
    "UPSTREAM_UNAVAILABLE",
    "Apps Script request failed repeatedly.",
    action
  )
}

async function send(
  url: string,
  body: string,
  action: string
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    })
    const raw = await response.text()
    try {
      return parse(JSON.parse(raw), action)
    } catch (error) {
      if (error instanceof AppsScriptError) throw error
      console.error(
        `[apps-script] non-JSON upstream response: status=${response.status} ` +
          `url=${response.url.slice(0, 90)} preview=${raw.slice(0, 160).replace(/\s+/g, " ")}`
      )
      throw new AppsScriptError(
        "INVALID_RESPONSE",
        "Apps Script returned an unexpected response.",
        action
      )
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown network error"
    throw new AppsScriptError(
      "UPSTREAM_UNAVAILABLE",
      `Unable to reach Apps Script: ${detail}`,
      action
    )
  } finally {
    clearTimeout(timeout)
  }
}

function parse(value: unknown, action: string): ApiResult<object> {
  if (!isApiResult(value)) {
    throw new AppsScriptError(
      "INVALID_RESPONSE",
      "Apps Script returned an unexpected response.",
      action
    )
  }
  return value
}

async function warmUp(url: string): Promise<void> {
  try {
    await fetch(cacheBusted(url), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    })
  } catch {
    // The warm-up is best-effort; the POST below will retry on its own.
  } finally {
    warmedUp = true
  }
}

/**
 * Appends a unique query parameter so every request resolves a fresh
 * redirect chain instead of reusing a cached (and possibly expired) one.
 */
function cacheBusted(url: string): string {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}_r=${Date.now()}${Math.floor(Math.random() * 1000)}`
}

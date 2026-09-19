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
 * @param action - The API action to execute.
 * @param params  - Additional request fields, merged under the action.
 */
export async function requestAppsScript<TPayload extends object>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<ApiSuccess<TPayload>> {
  const { url, secret } = getAppsScriptConfig()
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  const body = JSON.stringify({ secret, action, ...params })

  if (!warmedUp) {
    await warmUp(url)
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await send(url, body, action)
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
    return await response.json()
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
    await fetch(url, { method: "GET", redirect: "follow", cache: "no-store" })
  } catch {
    // The warm-up is best-effort; the POST below will retry on its own.
  } finally {
    warmedUp = true
  }
}

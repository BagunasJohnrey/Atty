import { AppsScriptError } from "./errors"

/**
 * Server-only configuration for the Apps Script Web App.
 *
 * The Web App URL and the shared secret must never be exposed to the
 * browser. They are read from the server environment on every request.
 */
export interface AppsScriptConfig {
  url: string
  secret: string
}

export function getAppsScriptConfig(): AppsScriptConfig {
  const url = process.env.APPS_SCRIPT_URL
  const secret = process.env.APPS_SCRIPT_SECRET

  if (!url) {
    throw new AppsScriptError("CONFIGURATION_ERROR", "APPS_SCRIPT_URL is not set.", "config")
  }
  if (!secret) {
    throw new AppsScriptError("CONFIGURATION_ERROR", "APPS_SCRIPT_SECRET is not set.", "config")
  }

  return { url, secret }
}

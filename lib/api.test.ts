import { NextResponse } from "next/server"
import { describe, expect, it, vi } from "vitest"
import { AppsScriptError } from "@/integration/errors"
import {
  HttpError,
  optionalString,
  parseJsonBody,
  requireString,
  respondWith,
} from "./api"

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

describe("parseJsonBody", () => {
  it("parses a JSON object body", async () => {
    await expect(parseJsonBody(postJson({ srcode: "26-12345" }))).resolves.toEqual({
      srcode: "26-12345",
    })
  })

  it("rejects malformed JSON", async () => {
    const response = await respondWith(async () => {
      await parseJsonBody(postJson("{not-json"))
      return NextResponse.json({ success: true })
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "INVALID_JSON",
    })
  })

  it("rejects non-object bodies", async () => {
    const response = await respondWith(async () => {
      await parseJsonBody(postJson([1, 2, 3]))
      return NextResponse.json({ success: true })
    })
    expect(response.status).toBe(400)
  })
})

describe("requireString", () => {
  it("trims and returns the value", () => {
    expect(requireString({ name: "  EVT  " }, "name")).toBe("EVT")
  })

  it("throws HttpError for missing or blank fields", async () => {
    const response = await respondWith(async () => {
      requireString({ name: "   " }, "name")
      return NextResponse.json({ success: true })
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "INVALID_FIELD",
    })
  })
})

describe("optionalString", () => {
  it("returns empty string when missing or blank", () => {
    expect(optionalString({}, "location")).toBe("")
    expect(optionalString({ location: "   " }, "location")).toBe("")
  })

  it("trims present values", () => {
    expect(optionalString({ location: "  Gym  " }, "location")).toBe("Gym")
  })

  it("rejects non-string values", async () => {
    const response = await respondWith(async () => {
      optionalString({ location: 42 }, "location")
      return NextResponse.json({ success: true })
    })
    expect(response.status).toBe(400)
  })
})

describe("respondWith error mapping", () => {
  it("passes HttpError through with its status", async () => {
    const response = await respondWith(async () => {
      throw new HttpError(418, "TEAPOT", "Short and stout.")
    })
    expect(response.status).toBe(418)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "TEAPOT",
    })
  })

  it.each([
    ["DUPLICATE_ATTENDANCE", 409],
    ["EVENT_NOT_ACTIVE", 409],
    ["EVENT_NOT_FOUND", 404],
    ["SRCODE_NOT_FOUND", 404],
    ["CONFIGURATION_ERROR", 503],
    ["UPSTREAM_UNAVAILABLE", 502],
  ])("maps %s to HTTP %i", async (code, status) => {
    const response = await respondWith(async () => {
      throw new AppsScriptError(code, "upstream said no", "recordAttendance")
    })
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code,
    })
  })

  it("hides unexpected errors behind a 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const response = await respondWith(async () => {
        throw new Error("boom")
      })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        code: "INTERNAL_ERROR",
      })
    } finally {
      consoleSpy.mockRestore()
    }
  })
})

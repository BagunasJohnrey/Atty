import { beforeEach, describe, expect, it, vi } from "vitest"
import { SESSION_COOKIE } from "./constants"
import { createSession } from "./cookie"

const store = vi.hoisted(() => ({ calls: [] as unknown[][] }))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (...args: unknown[]) => {
      store.calls.push(args)
    },
    get: () => undefined,
    delete: () => {},
  }),
}))

describe("session cookie", () => {
  beforeEach(() => {
    store.calls.length = 0
    process.env.SESSION_SECRET = "s".repeat(32)
  })

  it("issues a session cookie that dies with the browser", async () => {
    await createSession()
    expect(store.calls).toHaveLength(1)
    const [name, token, options] = store.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(name).toBe(SESSION_COOKIE)
    expect(typeof token).toBe("string")
    // No maxAge/expires: the session ends when the browser exits, so a
    // closed laptop or kiosk never hands its login to the next person.
    expect("maxAge" in options).toBe(false)
    expect("expires" in options).toBe(false)
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
  })
})

/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IdleLock } from "./IdleLock"
import { logout } from "@/lib/api-client"
import { IDLE_TIMEOUT_MINUTES } from "@/lib/auth/constants"

vi.mock("@/lib/api-client", () => ({ logout: vi.fn() }))

const IDLE_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000

function assignStub() {
  const assign = vi.fn()
  Object.defineProperty(window, "location", {
    value: { assign },
    writable: true,
  })
  return assign
}

describe("IdleLock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("renders nothing", () => {
    const { container } = render(<IdleLock />)
    expect(container.innerHTML).toBe("")
  })

  it("locks out after the idle timeout", async () => {
    vi.mocked(logout).mockResolvedValue(undefined)
    const assign = assignStub()
    render(<IdleLock />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(logout).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith("/login")
  })

  it("resets the clock on interaction", async () => {
    vi.mocked(logout).mockResolvedValue(undefined)
    assignStub()
    render(<IdleLock />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000)
    })
    fireEvent.pointerDown(document)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000)
    })
    expect(logout).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(logout).toHaveBeenCalledTimes(1)
  })
})

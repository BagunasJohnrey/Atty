/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LockButton } from "./LockButton"
import { logout } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({ logout: vi.fn() }))

function assignStub() {
  const assign = vi.fn()
  Object.defineProperty(window, "location", {
    value: { assign },
    writable: true,
  })
  return assign
}

describe("LockButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("asks in a modal before logging out", async () => {
    vi.mocked(logout).mockResolvedValue(undefined)
    const assign = assignStub()
    render(<LockButton />)
    fireEvent.click(screen.getByRole("button", { name: /^log out$/i }))
    // Trigger only opens the modal — no logout yet.
    expect(logout).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "Log out?" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Yes, log out" }))
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1)
    })
    expect(assign).toHaveBeenCalledWith("/login")
  })

  it("cancels without logging out", async () => {
    render(<LockButton />)
    fireEvent.click(screen.getByRole("button", { name: /^log out$/i }))
    fireEvent.click(screen.getByRole("button", { name: "Stay" }))
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Log out?" })).toBeNull()
    })
    expect(logout).not.toHaveBeenCalled()
  })
})

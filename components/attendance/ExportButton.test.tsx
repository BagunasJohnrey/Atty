/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ExportButton } from "./ExportButton"

let searchQuery = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchQuery),
}))

describe("ExportButton", () => {
  afterEach(() => {
    cleanup()
    searchQuery = ""
    vi.clearAllMocks()
  })

  it("carries the live URL day filter in the print link", () => {
    searchQuery = "day=2026-10-12"
    render(<ExportButton eventId="EVT-1" filters={{}} />)
    const link = screen.getByRole("link", { name: /export pdf/i })
    expect(link.getAttribute("href")).toContain("day=2026-10-12")
  })

  it("omits day when no day is picked", () => {
    render(<ExportButton eventId="EVT-1" filters={{}} />)
    const link = screen.getByRole("link", { name: /export pdf/i })
    expect(link.getAttribute("href") ?? "").not.toContain("day=")
  })
})

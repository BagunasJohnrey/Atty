/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AttendanceFilters } from "./AttendanceFilters"
import type { FilterOptions } from "@/lib/attendance"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(""),
}))

const options: FilterOptions = {
  colleges: ["CICS"],
  programs: ["BSIT"],
  yearLevels: ["First Year"],
  genders: ["Male"],
  days: ["2026-10-10", "2026-10-11"],
}

describe("AttendanceFilters day", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("offers each event day by number", async () => {
    render(<AttendanceFilters eventId="EVT-1" options={options} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Day" }))
    expect(
      await screen.findByRole("option", { name: "Day 1 · Oct 10" })
    ).toBeTruthy()
    expect(
      await screen.findByRole("option", { name: "Day 2 · Oct 11" })
    ).toBeTruthy()
  })

  it("writes the picked day as its ISO value", async () => {
    render(<AttendanceFilters eventId="EVT-1" options={options} />)
    fireEvent.click(screen.getByRole("combobox", { name: "Day" }))
    const option = await screen.findByRole("option", { name: "Day 2 · Oct 11" })
    fireEvent.pointerDown(option)
    fireEvent.click(option)
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("day=2026-10-11"),
      expect.anything()
    )
  })

  it("offers department and course as searchable comboboxes", () => {
    render(<AttendanceFilters eventId="EVT-1" options={options} />)
    expect(screen.getByRole("combobox", { name: "Department" }).tagName).toBe(
      "INPUT"
    )
    expect(screen.getByRole("combobox", { name: "Course" }).tagName).toBe(
      "INPUT"
    )
  })

  it("hides the day picker for single-day lists", () => {
    render(
      <AttendanceFilters
        eventId="EVT-1"
        options={{ ...options, days: ["2026-10-10"] }}
      />
    )
    expect(screen.queryByRole("combobox", { name: "Day" })).toBeNull()
  })
})

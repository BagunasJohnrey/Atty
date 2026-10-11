/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DayFilter } from "./DayFilter"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(""),
}))

const days = ["2026-10-10", "2026-10-11"]

describe("DayFilter", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("offers each event day by number", async () => {
    render(<DayFilter days={days} basePath="/events/EVT-1" />)
    fireEvent.click(screen.getByRole("combobox", { name: "Day" }))
    expect(await screen.findByRole("option", { name: "Day 1 · Oct 10" })).toBeTruthy()
    expect(await screen.findByRole("option", { name: "Day 2 · Oct 11" })).toBeTruthy()
  })

  it("writes the picked day as its ISO value", async () => {
    render(
      <DayFilter days={days} basePath="/events/EVT-1/report/print" />
    )
    fireEvent.click(screen.getByRole("combobox", { name: "Day" }))
    const option = await screen.findByRole("option", { name: "Day 2 · Oct 11" })
    fireEvent.pointerDown(option)
    fireEvent.click(option)
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("/events/EVT-1/report/print?"),
      expect.anything()
    )
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("day=2026-10-11"),
      expect.anything()
    )
  })

  it("hides for single-day lists", () => {
    render(<DayFilter days={["2026-10-10"]} basePath="/events/EVT-1" />)
    expect(screen.queryByRole("combobox", { name: "Day" })).toBeNull()
  })

  it("lays label and picker side by side when inline", () => {
    const { container } = render(
      <DayFilter days={days} basePath="/events/EVT-1" layout="inline" />
    )
    const row = container.querySelector(".flex-row")
    expect(row).toBeTruthy()
    expect(
      row?.contains(screen.getByRole("combobox", { name: "Day" }))
    ).toBe(true)
  })

  it("matches button styling in the button variant", () => {
    render(
      <DayFilter days={days} basePath="/events/EVT-1" variant="button" />
    )
    const trigger = screen.getByRole("combobox", { name: "Day" })
    expect(trigger.className).toContain("rounded-full")
    expect(trigger.className).toMatch(/h-9/)
  })
})

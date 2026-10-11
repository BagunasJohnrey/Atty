/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { StatCards } from "./StatCards"

function upcomingCard(): HTMLElement | null {
  render(<StatCards active={1} upcoming={2} closed={3} />)
  return screen.getByText("Upcoming events").closest('[data-slot="card"]')
}

describe("StatCards upcoming tile", () => {
  afterEach(cleanup)

  it("constrains the upcoming card width on mobile", () => {
    // Full-bleed single-column cards look oversized on phones; the
    // upcoming tile caps its width (reset at sm+ where the grid fits).
    const card = upcomingCard()
    expect(card?.className ?? "").toContain("max-w-md")
  })

  it("nudges the upcoming icon 5px left", () => {
    const card = upcomingCard()
    const iconWrap = card?.querySelector("svg")?.parentElement
    expect(iconWrap?.className ?? "").toContain("-translate-x-[5px]")
  })
})

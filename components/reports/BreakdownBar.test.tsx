/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BreakdownBar } from "./BreakdownBar"

const LONG_LABEL = "COLLEGE OF INFORMATICS AND COMPUTING SCIENCES"

describe("BreakdownBar overflow", () => {
  afterEach(cleanup)

  it("lets long labels shrink instead of pushing counts out", () => {
    render(
      <div style={{ width: 200 }}>
        <BreakdownBar label={LONG_LABEL} count={2} total={2} tone="indigo" />
      </div>
    )
    const label = screen.getByText(LONG_LABEL)
    expect(label.className).toContain("truncate")
    // Without min-w-0 a flex child never shrinks, so truncate can never
    // engage and the count is pushed out of the card on narrow screens.
    expect(label.className).toContain("min-w-0")
  })
})

/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CategoryChart } from "./CategoryChart"

const LONG = "COLLEGE OF INFORMATICS AND COMPUTING SCIENCES"

describe("CategoryChart overflow", () => {
  afterEach(cleanup)

  it("lets the card shrink inside narrow grids instead of overflowing", () => {
    const { container } = render(
      <div style={{ width: 200 }}>
        <CategoryChart title="By department" entries={[[LONG, 17]]} total={20} />
      </div>
    )
    // Without min-w-0 the card keeps its content width and overflows its
    // grid cell on phones, overlapping the neighbouring card.
    const card = container.querySelector("h4")?.parentElement
    expect(card?.className ?? "").toContain("min-w-0")
    expect(screen.getByText(LONG)).toBeTruthy()
  })
})

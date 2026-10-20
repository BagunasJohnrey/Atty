/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ExpandableDescription } from "./ExpandableDescription"

const text =
  "TALENTOPIA '26: Discover, Develop and Perform is a talent showcase."

function stubHeights(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  })
}

function clearHeights() {
  delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
}

describe("ExpandableDescription", () => {
  afterEach(() => {
    cleanup()
    clearHeights()
  })

  it("expands and collapses when the clamped text overflows", () => {
    stubHeights(60, 20)
    render(<ExpandableDescription text={text} />)
    const button = screen.getByRole("button", { name: text })
    expect(button.getAttribute("aria-expanded")).toBe("false")

    fireEvent.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("true")

    fireEvent.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("false")
  })

  it("stays put when the text already fits on one line", () => {
    stubHeights(20, 20)
    render(<ExpandableDescription text={text} />)
    const button = screen.getByRole("button", { name: text })

    fireEvent.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("false")
  })
})

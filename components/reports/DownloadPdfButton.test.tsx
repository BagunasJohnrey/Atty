/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DownloadPdfButton } from "./DownloadPdfButton"

const meta = {
  name: "Phase2 Verify",
  date: "2026-10-02",
  time: "12:00 pm - 1:00 am",
  location: "sa gate",
}

describe("DownloadPdfButton", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("downloads a one-click PDF named after the event", async () => {
    const create = vi.fn(() => "blob:pdf")
    const revoke = vi.fn()
    window.URL.createObjectURL = create as typeof URL.createObjectURL
    window.URL.revokeObjectURL = revoke as typeof URL.revokeObjectURL
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    )
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(
        new Response(new Blob([png], { type: "image/png" }), {
          status: 200,
        })
      )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    const created: HTMLAnchorElement[] = []
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation(
      ((tagName: string, options?: ElementCreationOptions) => {
        const el = origCreate(tagName, options)
        if (tagName === "a") created.push(el as HTMLAnchorElement)
        return el
      }) as typeof document.createElement
    )

    render(
      <DownloadPdfButton
        eventMeta={meta}
        orgName="Org"
        orgEmail="org@example.edu"
        rows={[
          {
            key: "a",
            srcode: "23-16300",
            name: "BAGUNAS, JOHN REY V.",
            yearLevel: "FOURTH YEAR",
            program: "BSIT",
          },
        ]}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(click).toHaveBeenCalledTimes(1)
    expect(created[0]?.download).toBe(
      "2026-10-02_AttendanceReport_Phase2-Verify.pdf"
    )
    expect(revoke).toHaveBeenCalledTimes(1)
  })

  it("still downloads text-only when the logo fetch fails", async () => {
    const create = vi.fn(() => "blob:pdf")
    window.URL.createObjectURL = create as typeof URL.createObjectURL
    window.URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("offline"))
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    render(
      <DownloadPdfButton
        eventMeta={meta}
        orgName="Org"
        orgEmail="org@example.edu"
        rows={[]}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(click).toHaveBeenCalledTimes(1)
  })
})

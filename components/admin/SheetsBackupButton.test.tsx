/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SheetsBackupButton } from "./SheetsBackupButton"
import { ToastProvider } from "@/components/ui/toast"

const summary = {
  events: { inserted: 0, updated: 1, untouched: 6, sheetOnly: 0 },
  perEvent: { "EVT-001": { inserted: 0, updated: 0, untouched: 1, sheetOnly: 0 } },
  errors: [],
}

function renderButton() {
  render(
    <ToastProvider>
      <SheetsBackupButton />
    </ToastProvider>
  )
}

describe("SheetsBackupButton", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("posts a manual backup and reports the result", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, summary }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: /back up to sheets/i }))
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith("/api/admin/backup", {
        method: "POST",
      })
    )
    await waitFor(() =>
      expect(screen.getByText(/sheets backup complete/i)).toBeTruthy()
    )
  })

  it("reports a failed backup without crashing", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("offline"))
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: /back up to sheets/i }))
    await waitFor(() =>
      expect(screen.getByText(/offline/i)).toBeTruthy()
    )
  })
})

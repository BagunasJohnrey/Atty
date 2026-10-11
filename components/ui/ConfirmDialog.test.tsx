/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConfirmDialog } from "./ConfirmDialog"

function renderDialog(props?: Partial<Parameters<typeof ConfirmDialog>[0]>) {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn()
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete event?"
      message="This cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      {...props}
    />
  )
  return { onOpenChange, onConfirm }
}

describe("ConfirmDialog", () => {
  afterEach(cleanup)

  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Delete event?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
      />
    )
    expect(screen.queryByRole("heading", { name: "Delete event?" })).toBeNull()
  })

  it("confirms explicitly", () => {
    const { onConfirm, onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("cancels without confirming", () => {
    const { onConfirm, onOpenChange } = renderDialog({ cancelLabel: "Keep" })
    fireEvent.click(screen.getByRole("button", { name: "Keep" }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })
})

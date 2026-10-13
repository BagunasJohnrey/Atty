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
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizationFormDialog } from "./OrganizationFormDialog"
import { ToastProvider } from "@/components/ui/toast"
import { ApiError, createOrganization } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  ApiError: class ApiError extends Error {
    code: string
    status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.name = "ApiError"
      this.code = code
      this.status = status
    }
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

function open() {
  render(
    <ToastProvider>
      <OrganizationFormDialog />
    </ToastProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: /add organizer/i }))
}

describe("OrganizationFormDialog", () => {
  it("submits the name and email", async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      success: true,
      organization: {
        id: "ORG-001",
        name: "Batangas State University",
        email: "sscbalayan@g.batstate-u.edu.ph",
      },
    })
    open()
    fireEvent.change(screen.getByLabelText("Organizer name"), {
      target: { value: "Batangas State University" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sscbalayan@g.batstate-u.edu.ph" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create organizer$/i }))
    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledTimes(1)
    })
    expect(createOrganization).toHaveBeenCalledWith({
      name: "Batangas State University",
      email: "sscbalayan@g.batstate-u.edu.ph",
    })
  })

  it("keeps typed values when save fails so the operator can retry", async () => {
    vi.mocked(createOrganization).mockRejectedValue(
      new ApiError("INTERNAL_ERROR", "Could not create organizer.", 500)
    )
    open()
    fireEvent.change(screen.getByLabelText("Organizer name"), {
      target: { value: "My Test Org" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "TEST@EXAMPLE.COM" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create organizer$/i }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy()
    })
    expect(
      (screen.getByLabelText("Organizer name") as HTMLInputElement).value
    ).toBe("My Test Org")
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "TEST@EXAMPLE.COM"
    )
  })

  it("refuses a blank name without calling", async () => {
    open()
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sscbalayan@g.batstate-u.edu.ph" },
    })
    // Submit the form directly: a click on the submit button runs jsdom's
    // native constraint validation first, and the required name input would
    // block the submit before the handler runs. Dispatching submit exercises
    // the handler's trim-and-refuse check itself (same approach as
    // LoginForm.test.tsx).
    fireEvent.submit(
      screen.getByLabelText("Email").closest("form") as HTMLFormElement
    )
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy()
    })
    expect(createOrganization).not.toHaveBeenCalled()
  })
})

describe("OrganizationFormDialog dismissal", () => {
  it("closes from the X button", async () => {
    open()
    expect(screen.getByRole("heading", { name: "Add organizer" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }))
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Add organizer" })
      ).toBeNull()
    })
  })

  it("stays open on outside clicks", async () => {
    open()
    expect(screen.getByRole("heading", { name: "Add organizer" })).toBeTruthy()
    // Base UI only treats presses on the dialog's own backdrop as
    // outside-press; pressing anywhere else never reaches the dialog.
    const backdrop = document.querySelector('[class*="bg-black"]')
    expect(backdrop).toBeTruthy()
    fireEvent.pointerDown(backdrop as Element)
    fireEvent.click(backdrop as Element)
    expect(screen.getByRole("heading", { name: "Add organizer" })).toBeTruthy()
  })
})

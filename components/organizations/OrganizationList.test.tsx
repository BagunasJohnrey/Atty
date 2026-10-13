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
import { OrganizationList } from "./OrganizationList"
import { ToastProvider } from "@/components/ui/toast"
import {
  createOrganization,
  deleteOrganization,
  updateOrganization,
} from "@/lib/api-client"
import type { Organization } from "@/models/organization"

vi.mock("@/lib/api-client", () => ({
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

const alpha: Organization = {
  id: "ORG-001",
  name: "Alpha Org",
  email: "alpha@example.edu",
}

function renderList(initial: Organization[] = [alpha], error: string | null = null) {
  return render(
    <ToastProvider>
      <OrganizationList initial={initial} error={error} />
    </ToastProvider>
  )
}

describe("OrganizationList", () => {
  it("renders the initial organizers", () => {
    renderList()
    expect(
      screen.getByRole("heading", { name: "Alpha Org" })
    ).toBeTruthy()
  })

  it("shows the empty state with no organizers", () => {
    renderList([])
    expect(screen.getByText("No organizers yet. Add the first one.")).toBeTruthy()
  })

  it("shows a load error instead of the list", () => {
    renderList([], "Could not load organizers.")
    expect(screen.getByRole("alert").textContent).toContain(
      "Could not load organizers."
    )
    expect(screen.queryByText("No organizers yet.")).toBeNull()
  })

  it("shows a created organizer instantly from the response", async () => {
    const gamma: Organization = {
      id: "ORG-003",
      name: "Gamma Org",
      email: "gamma@example.edu",
    }
    vi.mocked(createOrganization).mockResolvedValue({
      success: true,
      organization: gamma,
    })
    renderList([])
    fireEvent.click(screen.getByRole("button", { name: /add organizer/i }))
    fireEvent.change(screen.getByLabelText("Organizer name"), {
      target: { value: "Gamma Org" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gamma@example.edu" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create organizer$/i }))
    // No waiting for a server re-read: the card appears from the response.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Gamma Org" })).toBeTruthy()
    })
    expect(screen.queryByText("No organizers yet.")).toBeNull()
  })

  it("shows an edited name instantly from the response", async () => {
    vi.mocked(updateOrganization).mockResolvedValue({
      success: true,
      organization: { ...alpha, name: "Alpha Renamed" },
    })
    renderList()
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }))
    fireEvent.change(screen.getByLabelText("Organizer name"), {
      target: { value: "Alpha Renamed" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }))
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Alpha Renamed" })
      ).toBeTruthy()
    })
    expect(screen.queryByRole("heading", { name: "Alpha Org" })).toBeNull()
  })

  it("removes a deleted organizer instantly after confirming", async () => {
    vi.mocked(deleteOrganization).mockResolvedValue({
      success: true,
      organization: alpha,
    })
    renderList()
    // Only the card's Delete exists before the modal opens.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(
      screen.getByRole("heading", { name: "Delete organizer?" })
    ).toBeTruthy()
    // The confirm button renders last (dialog portal at the body end).
    const deletes = screen.getAllByRole("button", { name: "Delete" })
    fireEvent.click(deletes[deletes.length - 1])
    await waitFor(() => {
      expect(deleteOrganization).toHaveBeenCalledWith("ORG-001")
    })
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Alpha Org" })).toBeNull()
    })
  })
})

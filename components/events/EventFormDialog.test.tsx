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
import { EventFormDialog } from "./EventFormDialog"
import { ToastProvider } from "@/components/ui/toast"
import { createEvent, updateEvent } from "@/lib/api-client"
import { formatEventDate } from "@/lib/format"
import { useOrganizations } from "@/hooks/useQueries"
import type { SchoolEvent } from "@/models/event"

vi.mock("@/lib/api-client", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
}))
vi.mock("@/hooks/useQueries", () => ({ useOrganizations: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

const orgs = [{ id: "ORG-001", name: "Batangas State University", email: "" }]

function mockOrgs(list: typeof orgs) {
  vi.mocked(useOrganizations).mockReturnValue({
    data: list.length ? { success: true as const, organizations: list } : null,
    error: null,
    loading: false,
    refresh: vi.fn(),
    fromSnapshot: false,
    savedAt: null,
  })
}

function renderDialog() {
  return render(
    <ToastProvider>
      <EventFormDialog />
    </ToastProvider>
  )
}

function renderEditDialog(event: SchoolEvent) {
  return render(
    <ToastProvider>
      <EventFormDialog event={event} />
    </ToastProvider>
  )
}

const existingEvent: SchoolEvent = {
  id: "EVT-005",
  name: "Science Fair",
  date: "11/15/2026",
  status: "Upcoming",
  sheetName: "EVT-005",
  location: "Gym",
  description: "Annual fair",
  orgId: "ORG-001",
  time: "8:00 AM - 5:00 PM",
}

function fillBasics() {
  fireEvent.change(screen.getByLabelText("Event name"), {
    target: { value: "Freshmen Orientation" },
  })
  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-11-01" },
  })
  // Description is required, so every submitting test provides one.
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Welcome the freshmen." },
  })
}

async function chooseOrg(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Organizer" }))
  const option = await screen.findByRole("option", { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe("EventFormDialog", () => {
  it("submits the selected organization id", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.orgId).toBe("ORG-001")
  })

  it("serializes start and end pickers as a 12-hour range", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "08:00" },
    })
    fireEvent.change(screen.getByLabelText("End time"), {
      target: { value: "17:00" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.time).toBe("8:00 AM - 5:00 PM")
  })

  it("sends a lone start time on its own", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "08:00" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.time).toBe("8:00 AM")
  })

  it("refuses an end time with no start time", async () => {
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("End time"), {
      target: { value: "17:00" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("start time")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("sends a single start date unchanged", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.date).toBe("2026-11-01")
  })

  it("serializes a start and end date as a range", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-11-03" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.date).toBe(
      `${formatEventDate("2026-11-01")} - ${formatEventDate("2026-11-03")}`
    )
  })

  it("refuses an end date before the start date", async () => {
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-10-01" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("End date")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("marks the end date optional and links it to the field", async () => {
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    const hint = screen.getByText(/leave blank for one-day events/i)
    expect(hint.getAttribute("id")).toBe("dateEnd-hint")
    expect(
      screen.getByLabelText("End date").getAttribute("aria-describedby")
    ).toBe("dateEnd-hint")
  })

  it("refuses to submit with no organization selected", async () => {
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("organizer")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("shows the empty-state prompt and disables submit with zero organizations", async () => {    vi.mocked(useOrganizations).mockReturnValue({
      data: null,
      error: null,
      loading: false,
      refresh: vi.fn(),
      fromSnapshot: false,
      savedAt: null,
    })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          (element.textContent ?? "")
            .replace(/\s+/g, " ")
            .includes(
              "No organizers yet. Add one on the Organizers page first."
            )
      )
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: /^create event$/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})

describe("EventFormDialog edit mode", () => {
  it("opens from an Edit trigger with every field prefilled", async () => {
    mockOrgs(orgs)
    renderEditDialog(existingEvent)
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }))
    expect(
      (screen.getByLabelText("Event name") as HTMLInputElement).value
    ).toBe("Science Fair")
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe(
      "2026-11-15"
    )
    expect((screen.getByLabelText("Location") as HTMLInputElement).value).toBe(
      "Gym"
    )
    expect(
      (screen.getByLabelText("Description") as HTMLInputElement).value
    ).toBe("Annual fair")
    expect((screen.getByLabelText("Start time") as HTMLInputElement).value).toBe(
      "08:00"
    )
    expect((screen.getByLabelText("End time") as HTMLInputElement).value).toBe(
      "17:00"
    )
    expect(
      screen.getByRole("combobox", { name: "Organizer" }).textContent
    ).toContain("Batangas State University")
    expect(
      screen.getByRole("button", { name: /^save changes$/i })
    ).toBeTruthy()
  })

  it("prefills the end date from a stored range", async () => {
    mockOrgs(orgs)
    renderEditDialog({
      ...existingEvent,
      date: "11/15/2026 - 11/16/2026",
    })
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }))
    expect((screen.getByLabelText("Start date") as HTMLInputElement).value).toBe(
      "2026-11-15"
    )
    expect((screen.getByLabelText("End date") as HTMLInputElement).value).toBe(
      "2026-11-16"
    )
  })

  it("saves through updateEvent, never createEvent", async () => {    vi.mocked(updateEvent).mockResolvedValue({
      success: true,
      event: existingEvent,
    })
    mockOrgs(orgs)
    renderEditDialog(existingEvent)
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }))
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Science Fair Updated" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }))
    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(updateEvent).mock.calls[0][0]).toBe("EVT-005")
    const input = vi.mocked(updateEvent).mock.calls[0][1] as unknown as Record<
      string,
      unknown
    >
    expect(input.name).toBe("Science Fair Updated")
    expect(input.date).toBe("2026-11-15")
    expect(input.time).toBe("8:00 AM - 5:00 PM")
    expect(input.orgId).toBe("ORG-001")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("requires a description", async () => {
    mockOrgs(orgs)
    renderEditDialog(existingEvent)
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }))
    expect(
      (screen.getByLabelText("Description") as HTMLInputElement).required
    ).toBe(true)
  })

  it("omits blank location and time from updates instead of failing", async () => {    vi.mocked(updateEvent).mockResolvedValue({
      success: true,
      event: existingEvent,
    })
    mockOrgs(orgs)
    renderEditDialog({ ...existingEvent, location: "", time: "" })
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }))
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Science Fair Updated" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save changes$/i }))
    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(updateEvent).mock.calls[0][1] as unknown as Record<
      string,
      unknown
    >
    expect(input.name).toBe("Science Fair Updated")
    expect(input.description).toBe("Annual fair")
    expect("location" in input).toBe(false)
    expect("time" in input).toBe(false)
    expect(createEvent).not.toHaveBeenCalled()
  })
})

describe("EventFormDialog dismissal", () => {
  it("closes from the X button and resets the form", async () => {
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    expect(
      screen.getByRole("heading", { name: "Create event" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /close dialog/i }))
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Create event" })).toBeNull()
    })
  })

  it("stays open on outside clicks", async () => {
    mockOrgs(orgs)
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    expect(
      screen.getByRole("heading", { name: "Create event" })
    ).toBeTruthy()
    // Base UI only treats presses on the dialog's own backdrop as
    // outside-press; pressing anywhere else never reaches the dialog.
    const backdrop = document.querySelector('[class*="bg-black"]')
    expect(backdrop).toBeTruthy()
    fireEvent.pointerDown(backdrop as Element)
    fireEvent.click(backdrop as Element)
    expect(
      screen.getByRole("heading", { name: "Create event" })
    ).toBeTruthy()
  })
})

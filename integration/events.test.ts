import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SchoolEvent } from "@/models/event"
import {
  closeEvent,
  createEvent,
  deleteEvent,
  getEvent,
  getEvents,
  openEvent,
  updateEvent,
} from "./events"
import { requestAppsScript } from "./http"
import {
  closeEventNeon,
  createEventNeon,
  deleteEventNeon,
  getEventNeon,
  getEventsNeon,
  openEventNeon,
  updateEventNeon,
} from "./neon"

vi.mock("./http", () => ({
  requestAppsScript: vi.fn(),
}))
vi.mock("./neon", () => ({
  closeEventNeon: vi.fn(),
  createEventNeon: vi.fn(),
  deleteEventNeon: vi.fn(),
  getEventNeon: vi.fn(),
  getEventsNeon: vi.fn(),
  openEventNeon: vi.fn(),
  updateEventNeon: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)
const neonMocks = {
  getEvents: vi.mocked(getEventsNeon),
  getEvent: vi.mocked(getEventNeon),
  create: vi.mocked(createEventNeon),
  close: vi.mocked(closeEventNeon),
  open: vi.mocked(openEventNeon),
  update: vi.mocked(updateEventNeon),
  remove: vi.mocked(deleteEventNeon),
}

const sampleEvent: SchoolEvent = {
  id: "EVT-001",
  name: "Freshmen Orientation",
  date: "09/20/2026",
  status: "Active",
  sheetName: "EVT-001",
  location: "Gymnasium",
  description: "Welcome event.",
  orgId: "ORG-001",
  time: "12:00 pm - 5:00 pm",
}

beforeEach(() => {
  requestMock.mockReset()
  Object.values(neonMocks).forEach((m) => m.mockReset())
  delete process.env.NEON_EVENTS
})

function mockSuccess(payload: object): void {
  requestMock.mockResolvedValue({ success: true, ...payload } as never)
}

describe("events integration", () => {
  it("lists events via getEvents", async () => {
    mockSuccess({ events: [sampleEvent] })
    await expect(getEvents()).resolves.toEqual([sampleEvent])
    expect(requestMock).toHaveBeenCalledWith("getEvents")
  })

  it("fetches a single event via getEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(getEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("getEvent", {
      eventId: "EVT-001",
    })
  })

  it("creates an event via createEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(
      createEvent({
        name: sampleEvent.name,
        date: "2026-09-20",
        location: "Gymnasium",
        description: "Welcome event.",
      })
    ).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("createEvent", {
      name: sampleEvent.name,
      date: "2026-09-20",
      location: "Gymnasium",
      description: "Welcome event.",
      orgId: "",
      time: "",
    })
  })

  it("defaults missing location/description/orgId/time to empty strings", async () => {
    mockSuccess({
      event: {
        ...sampleEvent,
        location: "",
        description: "",
        orgId: "",
        time: "",
      },
    })
    await createEvent({ name: sampleEvent.name, date: "2026-09-20" })
    expect(requestMock).toHaveBeenCalledWith("createEvent", {
      name: sampleEvent.name,
      date: "2026-09-20",
      location: "",
      description: "",
      orgId: "",
      time: "",
    })
  })

  it("forwards an orgId and time range when supplied", async () => {
    mockSuccess({ event: sampleEvent })
    await createEvent({
      name: sampleEvent.name,
      date: "2026-09-20",
      orgId: "ORG-001",
      time: "12:00 pm - 5:00 pm",
    })
    expect(requestMock).toHaveBeenCalledWith("createEvent", {
      name: sampleEvent.name,
      date: "2026-09-20",
      location: "",
      description: "",
      orgId: "ORG-001",
      time: "12:00 pm - 5:00 pm",
    })
  })

  it("closes an event via closeEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(closeEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("closeEvent", {
      eventId: "EVT-001",
    })
  })

  it("opens an event via openEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(openEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("openEvent", {
      eventId: "EVT-001",
    })
  })

  it("propagates upstream errors", async () => {
    requestMock.mockRejectedValue(new Error("EVENT_NOT_FOUND"))
    await expect(getEvent("EVT-999")).rejects.toThrow("EVENT_NOT_FOUND")
  })

  it("updates an event via updateEvent", async () => {
    mockSuccess({ event: { ...sampleEvent, location: "Auditorium" } })
    await expect(
      updateEvent("EVT-001", { location: "Auditorium", status: "Active" })
    ).resolves.toMatchObject({ location: "Auditorium" })
    expect(requestMock).toHaveBeenCalledWith("updateEvent", {
      eventId: "EVT-001",
      location: "Auditorium",
      status: "Active",
    })
  })

  it("deletes an event via deleteEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(deleteEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("deleteEvent", {
      eventId: "EVT-001",
    })
  })
})

describe("events cutover", () => {
  beforeEach(() => {
    process.env.NEON_EVENTS = "neon"
    neonMocks.getEvents.mockResolvedValue([sampleEvent])
    neonMocks.getEvent.mockResolvedValue(sampleEvent)
    neonMocks.create.mockResolvedValue(sampleEvent)
    neonMocks.close.mockResolvedValue(sampleEvent)
    neonMocks.open.mockResolvedValue(sampleEvent)
    neonMocks.update.mockResolvedValue(sampleEvent)
  })

  afterEach(() => {
    delete process.env.NEON_EVENTS
  })

  it("reads the event list from Neon when flagged", async () => {
    await expect(getEvents()).resolves.toEqual([sampleEvent])
    expect(neonMocks.getEvents).toHaveBeenCalledTimes(1)
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("reads one event from Neon when flagged", async () => {
    await expect(getEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(neonMocks.getEvent).toHaveBeenCalledWith("EVT-001")
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("creates via Neon with script-path defaults when flagged", async () => {
    await createEvent({ name: "X", date: "2026-09-20" })
    expect(neonMocks.create).toHaveBeenCalledWith({
      name: "X",
      date: "2026-09-20",
      location: "",
      description: "",
      orgId: "",
      time: "",
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("closes, opens, and updates via Neon when flagged", async () => {
    await closeEvent("EVT-001")
    expect(neonMocks.close).toHaveBeenCalledWith("EVT-001")
    await openEvent("EVT-001")
    expect(neonMocks.open).toHaveBeenCalledWith("EVT-001")
    await updateEvent("EVT-001", { location: "Hall" })
    expect(neonMocks.update).toHaveBeenCalledWith("EVT-001", {
      location: "Hall",
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it("deletes via Neon when flagged", async () => {
    neonMocks.remove.mockResolvedValue(sampleEvent)
    await expect(deleteEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(neonMocks.remove).toHaveBeenCalledWith("EVT-001")
    expect(requestMock).not.toHaveBeenCalled()
  })
})

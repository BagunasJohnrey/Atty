import { describe, expect, it } from "vitest"
import type { SchoolEvent } from "@/models/event"
import {
  eventDays,
  eventStartTime,
  isDayWithinEvent,
  outsideEventDatesMessage,
  parseEventStatusParam,
  sortEventsForListing,
} from "./events"

function event(overrides: Partial<SchoolEvent> & { id: string }): SchoolEvent {
  return {
    name: "Event",
    date: "2026-11-01",
    status: "Upcoming",
    sheetName: "Sheet",
    location: "",
    description: "",
    orgId: "",
    time: "",
    ...overrides,
  }
}

describe("parseEventStatusParam", () => {
  it("accepts known statuses", () => {
    expect(parseEventStatusParam("Active")).toBe("Active")
    expect(parseEventStatusParam("Closed")).toBe("Closed")
  })

  it("falls back to All for missing or junk values", () => {
    expect(parseEventStatusParam(undefined)).toBe("All")
    expect(parseEventStatusParam("All")).toBe("All")
    expect(parseEventStatusParam("incoming")).toBe("All")
  })
})

describe("eventDays", () => {
  it("lists the single day of a one-day event", () => {
    expect(eventDays("2026-11-01")).toEqual(["2026-11-01"])
    expect(eventDays("11/01/2026")).toEqual(["2026-11-01"])
  })

  it("enumerates every day of a stored range", () => {
    expect(eventDays("11/15/2026 - 11/17/2026")).toEqual([
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
    ])
    expect(
      eventDays("November 15, 2026 - November 16, 2026")
    ).toEqual(["2026-11-15", "2026-11-16"])
  })

  it("returns nothing useful for junk", () => {
    expect(eventDays("")).toEqual([])
    expect(eventDays("someday")).toEqual([])
  })
})

describe("isDayWithinEvent", () => {
  it("accepts the single day of a one-day event", () => {
    expect(isDayWithinEvent("10/11/2026", "2026-10-11")).toBe(true)
    expect(isDayWithinEvent("10/11/2026", "2026-10-12")).toBe(false)
  })

  it("accepts every day of a stored range, edges included", () => {
    const range = "10/11/2026 - 10/12/2026"
    expect(isDayWithinEvent(range, "2026-10-11")).toBe(true)
    expect(isDayWithinEvent(range, "2026-10-12")).toBe(true)
    expect(isDayWithinEvent(range, "2026-10-10")).toBe(false)
    expect(isDayWithinEvent(range, "2026-10-13")).toBe(false)
  })

  it("fails open for unparseable event dates", () => {
    expect(isDayWithinEvent("", "2026-10-11")).toBe(true)
    expect(isDayWithinEvent("someday", "2026-10-11")).toBe(true)
  })

  it("names the event and its dates in the refusal message", () => {
    const message = outsideEventDatesMessage(
      event({ id: "a", name: "Ascend", date: "10/11/2026 - 10/12/2026" })
    )
    expect(message).toContain("Ascend")
    expect(message).toContain("10/11/2026 - 10/12/2026")
  })
})

describe("eventStartTime", () => {  it("reads a single ISO date", () => {
    expect(eventStartTime(event({ id: "a", date: "2026-11-01" }))).toBe(
      new Date("2026-11-01").getTime()
    )
  })

  it("reads the first date of a pretty range", () => {
    expect(
      eventStartTime(
        event({ id: "b", date: "November 1, 2026 - November 3, 2026" })
      )
    ).toBe(new Date("November 1, 2026").getTime())
  })

  it("sinks unparseable dates to the end", () => {
    expect(eventStartTime(event({ id: "c", date: "someday" }))).toBe(
      Number.POSITIVE_INFINITY
    )
  })
})

describe("sortEventsForListing", () => {
  it("groups Active, then Upcoming, then Closed", () => {
    const sorted = sortEventsForListing([
      event({ id: "closed", status: "Closed", date: "2026-01-01" }),
      event({ id: "upcoming", status: "Upcoming", date: "2026-12-01" }),
      event({ id: "active", status: "Active", date: "2026-10-01" }),
    ])
    expect(sorted.map((e) => e.id)).toEqual(["active", "upcoming", "closed"])
  })

  it("orders upcoming soonest-first and closed most-recent-first", () => {
    const sorted = sortEventsForListing([
      event({ id: "far", status: "Upcoming", date: "2026-12-01" }),
      event({ id: "near", status: "Upcoming", date: "2026-10-15" }),
      event({ id: "old", status: "Closed", date: "2026-01-01" }),
      event({ id: "recent", status: "Closed", date: "2026-09-01" }),
    ])
    expect(sorted.map((e) => e.id)).toEqual(["near", "far", "recent", "old"])
  })

  it("does not mutate the input", () => {
    const input = [
      event({ id: "b", status: "Closed", date: "2026-01-01" }),
      event({ id: "a", status: "Active", date: "2026-10-01" }),
    ]
    sortEventsForListing(input)
    expect(input[0].id).toBe("b")
  })
})

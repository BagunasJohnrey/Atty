import { beforeEach, describe, expect, it, vi } from "vitest"

const revalidateTag = vi.fn()
const unstableCacheArgs: {
  tags: string[]
  revalidate: number | false
}[] = []

vi.mock("next/cache", () => ({
  revalidateTag,
  unstable_cache: (_fn: unknown, _keys: unknown, options?: { tags?: string[]; revalidate?: number | false }) => {
    unstableCacheArgs.push({
      tags: options?.tags ?? [],
      revalidate: options?.revalidate ?? false,
    })
    return async (...args: unknown[]) => ({ fn: _fn, args })
  },
}))

vi.mock("./events", () => ({
  getEvents: vi.fn(),
  getEvent: vi.fn(),
}))
vi.mock("./attendance", () => ({
  getAttendance: vi.fn(),
}))
vi.mock("./reports", () => ({
  getAttendanceReport: vi.fn(),
}))

beforeEach(() => {
  revalidateTag.mockReset()
  unstableCacheArgs.length = 0
})

describe("read cache tags", () => {
  it("tags the event list so every event mutation can expire it", async () => {
    const { getEventsCached, EVENTS_TAG } = await import("./cached")
    await getEventsCached()
    expect(unstableCacheArgs[0]?.tags).toContain(EVENTS_TAG)
  })

  it("carries the event-scoped tag on a single event read", async () => {
    const { getEventCachedFor, eventTag } = await import("./cached")
    await getEventCachedFor("EVT-001")
    expect(unstableCacheArgs[0]?.tags).toContain(eventTag("EVT-001"))
  })

  it("carries attendance and report tags on an attendance read", async () => {
    const { getAttendanceCachedFor, attendanceTag, reportTag } = await import(
      "./cached"
    )
    await getAttendanceCachedFor("EVT-001")
    expect(unstableCacheArgs[0]?.tags).toEqual(
      expect.arrayContaining([attendanceTag("EVT-001"), reportTag("EVT-001")])
    )
  })

  it("keys the cache by event id so events do not share an entry", async () => {
    const { getEventCachedFor } = await import("./cached")
    const a = await getEventCachedFor("EVT-001")
    const b = await getEventCachedFor("EVT-002")
    expect(a).not.toEqual(b)
  })
})

describe("mutation invalidation", () => {
  it("expires the shared event list on any event write", async () => {
    const { EVENTS_TAG } = await import("./cached")
    const { expireEvents } = await import("./invalidate")
    expireEvents()
    expect(revalidateTag).toHaveBeenCalledWith(EVENTS_TAG, { expire: 0 })
  })

  it("expires both list and event scope for a single event write", async () => {
    const { EVENTS_TAG, eventTag } = await import("./cached")
    const { expireEvent } = await import("./invalidate")
    expireEvent("EVT-001")
    expect(revalidateTag).toHaveBeenCalledWith(EVENTS_TAG, { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith(eventTag("EVT-001"), { expire: 0 })
  })

  it("expires attendance and report reads when attendance is recorded", async () => {
    const { attendanceTag, reportTag } = await import("./cached")
    const { expireAttendance } = await import("./invalidate")
    expireAttendance("EVT-001")
    expect(revalidateTag).toHaveBeenCalledWith(attendanceTag("EVT-001"), {
      expire: 0,
    })
    expect(revalidateTag).toHaveBeenCalledWith(reportTag("EVT-001"), {
      expire: 0,
    })
  })

  it("does not leak one event's expiry into another event's tags", async () => {
    const { eventTag } = await import("./cached")
    const { expireEvent } = await import("./invalidate")
    expireEvent("EVT-001")
    expect(revalidateTag).not.toHaveBeenCalledWith(
      eventTag("EVT-002"),
      expect.anything()
    )
  })

  it("expires immediately rather than serving a stale copy first", async () => {
    // A "max" profile would make revalidateTag stale-while-revalidate: the
    // next read would be served the old count and a just-recorded student
    // would look missing on the attendance board. { expire: 0 } must be
    // used instead so the read blocks and returns current data.
    const { expireAttendance, expireEvent, expireEvents } = await import(
      "./invalidate"
    )
    expireEvents()
    expireEvent("EVT-001")
    expireAttendance("EVT-001")
    expect(revalidateTag).toHaveBeenCalled()
    for (const call of revalidateTag.mock.calls) {
      expect(call[1]).toEqual({ expire: 0 })
      expect(call[1]).not.toBe("max")
    }
  })
})


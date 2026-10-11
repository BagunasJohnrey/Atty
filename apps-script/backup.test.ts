import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Backup upsert tests: Neon → Sheets mirror for events + attendance.
 *
 * Runs the real `.gs` sources against a fake Sheets API (same approach as
 * `attendance.test.ts`). Students are out of scope: the roster moves yearly
 * and is never part of this backup.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const scriptDir = path.resolve(here, "../apps-script")

const LOAD_ORDER = [
  "config.gs",
  "responses.gs",
  "models.gs",
  "sheets.gs",
  "students.gs",
  "organizations.gs",
  "events.gs",
  "attendance.gs",
  "reports.gs",
  "validators.gs",
  "auth.gs",
  "backup.gs",
]

type SeedSheet = (string | number)[][]

interface FakeOptions {
  events?: SeedSheet
  sheets?: Record<string, SeedSheet>
}

function loadScripts(options: FakeOptions = {}): {
  api: Record<string, any>
  rows: (name: string) => SeedSheet
} {
  const events = options.events ?? [
    [
      "Event ID",
      "Event Name",
      "Event Date",
      "Status",
      "Sheet Name",
      "Location",
      "Description",
      "Org ID",
      "Time",
    ],
    [
      "EVT-001",
      "Old Name",
      "09/20/2026",
      "Active",
      "EVT-001",
      "Gym",
      "Welcome",
      "ORG-001",
      "12:00 pm - 5:00 am",
    ],
    [
      "EVT-002",
      "Sheet Only",
      "09/21/2026",
      "Closed",
      "EVT-002",
      "Hall",
      "Done",
      "ORG-001",
      "",
    ],
  ]
  const store: Record<string, SeedSheet> = {
    Events: events.map((r) => r.slice()),
    EVT_001: [["Timestamp", "SRCODE"], ["09/20/2026 08:01:23", "26-12345"]],
  }
  for (const [name, rows] of Object.entries(options.sheets ?? {})) {
    store[name.replace(/-/g, "_")] = rows.map((r) => r.slice())
  }
  const keyFor = (name: string) => name.replace(/-/g, "_")

  function makeSheet(name: string) {
    const rows = () => store[keyFor(name)]
    return {
      getLastRow: () => rows().length,
      getLastColumn: () => rows()[0]?.length ?? 0,
      getDataRange: () => ({ getValues: () => rows().map((r) => r.slice()) }),
      getRange: (
        row: number,
        column: number,
        numRows?: number,
        numCols?: number
      ) => ({
        getValues: () => {
          const all = rows()
          const out: SeedSheet = []
          const height = numRows ?? 1
          const width = numCols ?? 1
          for (let r = 0; r < height; r++) {
            const source = all[row - 1 + r]
            if (!source) {
              out.push(new Array(width).fill(""))
              continue
            }
            const line: SeedSheet[number] = []
            for (let c = 0; c < width; c++) {
              line.push(source[column - 1 + c] ?? "")
            }
            out.push(line)
          }
          return out
        },
        getValue: () => rows()[row - 1]?.[column - 1] ?? "",
        setValue: (value: string) => {
          const all = rows()
          while (all.length < row) all.push([])
          all[row - 1][column - 1] = value
        },
      }),
      appendRow: (values: SeedSheet[number]) => {
        store[keyFor(name)].push(values.slice())
      },
    }
  }

  const spreadsheet = () => ({
    getSheetByName: (n: string) => (keyFor(n) in store ? makeSheet(n) : null),
    insertSheet: (n: string) => {
      store[keyFor(n)] = [["Timestamp", "SRCODE"]]
      return makeSheet(n)
    },
  })

  const sandbox: Record<string, any> = {
    console,
    JSON,
    Date,
    parseInt,
    String,
    Number,
    Math,
    Object,
    Array,
    Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: spreadsheet,
      openById: spreadsheet,
    },
    CacheService: {
      getScriptCache: () => {
        throw new Error("CacheService must not be used on a request path.")
      },
    },
    Utilities: {
      // Manila wall time via UTC arithmetic, so results never depend on the
      // runner's local timezone (mirrors Session.getScriptTimeZone()).
      formatDate: (value: Date, _tz?: string, format?: string) => {
        const manila = new Date(value.getTime() + 8 * 3600 * 1000)
        const date =
          `${String(manila.getUTCMonth() + 1).padStart(2, "0")}/${String(
            manila.getUTCDate()
          ).padStart(2, "0")}/${manila.getUTCFullYear()}`
        if (format && format.includes("HH")) {
          return (
            `${date} ${String(manila.getUTCHours()).padStart(2, "0")}:` +
            `${String(manila.getUTCMinutes()).padStart(2, "0")}:` +
            `${String(manila.getUTCSeconds()).padStart(2, "0")}`
          )
        }
        return date
      },
    },
    Session: { getScriptTimeZone: () => "Asia/Manila" },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => "test-secret",
        setProperty: () => {},
      }),
    },
  }

  const vm = require("node:vm") as typeof import("node:vm")
  const context = vm.createContext(sandbox)
  for (const file of LOAD_ORDER) {
    vm.runInContext(readFileSync(path.join(scriptDir, file), "utf8"), context, {
      filename: file,
    })
  }
  return { api: sandbox as Record<string, any>, rows: (n: string) => store[keyFor(n)] }
}

describe("Backup.upsertEvents", () => {
  it("updates changed fields, appends new events, never deletes sheet-only rows", () => {
    const h = loadScripts()
    const report = h.api.Backup.upsertEvents([
      {
        id: "EVT-001",
        name: "New Name",
        date: "09/20/2026",
        status: "Active",
        sheetName: "EVT-001",
        location: "Gym",
        description: "Welcome",
        orgId: "ORG-001",
        time: "12:00 pm - 5:00 am",
      },
      {
        id: "EVT-003",
        name: "Added",
        date: "10/02/2026",
        status: "Upcoming",
        sheetName: "EVT-003",
        location: "Gate",
        description: "",
        orgId: "ORG-001",
        time: "",
      },
    ])
    expect(report).toEqual({ inserted: 1, updated: 1, untouched: 0, sheetOnly: 1 })
    // Updated in place (row 2), not appended.
    expect(h.rows("Events")[1][1]).toBe("New Name")
    expect(h.rows("Events")).toHaveLength(4)
    // Sheet-only row intact.
    expect(h.rows("Events")[2][0]).toBe("EVT-002")
    // New event appended with all nine columns.
    expect(h.rows("Events")[3].slice(0, 9)).toEqual([
      "EVT-003",
      "Added",
      "10/02/2026",
      "Upcoming",
      "EVT-003",
      "Gate",
      "",
      "ORG-001",
      "",
    ])
  })

  it("counts identical events as untouched", () => {
    const h = loadScripts()
    const report = h.api.Backup.upsertEvents([
      {
        id: "EVT-002",
        name: "Sheet Only",
        date: "09/21/2026",
        status: "Closed",
        sheetName: "EVT-002",
        location: "Hall",
        description: "Done",
        orgId: "ORG-001",
        time: "",
      },
    ])
    expect(report).toEqual({ inserted: 0, updated: 0, untouched: 1, sheetOnly: 1 })
    expect(h.rows("Events")).toHaveLength(3)
  })

  it("rejects a non-array payload", () => {
    const h = loadScripts()
    expect(() => h.api.Backup.handleBackupEvents({})).toThrow()
    expect(() => h.api.Backup.handleBackupEvents({ events: "nope" })).toThrow()
  })
})

describe("Backup.upsertAttendance", () => {
  it("appends new scans, updates changed timestamps, keeps sheet-only rows", () => {
    const h = loadScripts({
      sheets: {
        "EVT-001": [
          ["Timestamp", "SRCODE"],
          ["09/20/2026 08:01:23", "26-12345"],
          ["09/20/2026 08:05:00", "26-12346"],
          ["09/20/2026 08:09:00", "26-99999"],
        ],
      },
    })
    const report = h.api.Backup.upsertAttendance("EVT-001", [
      // Same instant as the sheet row, different string shape → untouched.
      { srcode: "26-12345", scannedAt: "2026-09-20T08:01:23+08:00" },
      // Changed instant → updated in place.
      { srcode: "26-12346", scannedAt: "2026-09-20T09:00:00+08:00" },
      // New scan → appended.
      { srcode: "26-10000", scannedAt: "2026-09-20T10:00:00+08:00" },
    ])
    expect(report).toEqual({
      inserted: 1,
      updated: 1,
      untouched: 1,
      sheetOnly: 1,
      skipped: false,
    })
    const rows = h.rows("EVT-001")
    expect(rows).toHaveLength(5)
    // Updated in place on its original row, new scan appended last — both
    // in sheet timestamp format, never raw ISO.
    expect(rows[2][0]).toBe("09/20/2026 09:00:00")
    expect(rows[4]).toEqual(["09/20/2026 10:00:00", "26-10000"])
    // Sheet-only row intact.
    expect(rows[3]).toEqual(["09/20/2026 08:09:00", "26-99999"])
  })
})

describe("Backup.sheetTimestamp", () => {
  it("renders instants in sheet format", () => {
    const h = loadScripts()
    expect(h.api.Backup.sheetTimestamp("2026-09-20T09:00:00+08:00")).toBe(
      "09/20/2026 09:00:00"
    )
    expect(h.api.Backup.sheetTimestamp("09/20/2026 09:00:00")).toBe(
      "09/20/2026 09:00:00"
    )
  })

  it("leaves unparseable values verbatim instead of destroying data", () => {
    const h = loadScripts()
    expect(h.api.Backup.sheetTimestamp("someday")).toBe("someday")
    expect(h.api.Backup.sheetTimestamp("")).toBe("")
  })

  it("leaves the tab untouched when there is nothing to back up", () => {
    const h = loadScripts()
    const before = h.rows("EVT-001").map((r) => r.slice())
    const report = h.api.Backup.upsertAttendance("EVT-001", [])
    expect(report.skipped).toBe(true)
    expect(h.rows("EVT-001")).toEqual(before)
  })

  it("throws for an unknown event", () => {
    const h = loadScripts()
    expect(() => h.api.Backup.upsertAttendance("EVT-999", [])).toThrow()
  })
})

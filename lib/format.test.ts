import { describe, expect, it } from "vitest"
import {
  formatDayLabel,
  formatSrcodeInput,
  formatTimeInput,
  isValidSrcodeFormat,
  manilaDayKey,
  normalizeSrcode,
  SRCODE_MAX_LENGTH,
  toDateInputValue,
  toTimeInputValue,
} from "./format"

describe("isValidSrcodeFormat", () => {
  it("accepts the 00-00000 shape", () => {
    expect(isValidSrcodeFormat("23-19300")).toBe(true)
    expect(isValidSrcodeFormat("26-12345")).toBe(true)
    expect(isValidSrcodeFormat("  23-19300  ")).toBe(true)
  })

  it("rejects malformed codes", () => {
    expect(isValidSrcodeFormat("")).toBe(false)
    expect(isValidSrcodeFormat("2319300")).toBe(false)
    expect(isValidSrcodeFormat("2-19300")).toBe(false)
    expect(isValidSrcodeFormat("23-1930")).toBe(false)
    expect(isValidSrcodeFormat("23-193000")).toBe(false)
    expect(isValidSrcodeFormat("AB-12345")).toBe(false)
    expect(isValidSrcodeFormat("23 19300")).toBe(false)
  })

  it("caps input length at the full code length", () => {
    expect(SRCODE_MAX_LENGTH).toBe("23-19300".length)
    expect(normalizeSrcode(" 23-19300 ")).toBe("23-19300")
  })
})

describe("formatSrcodeInput", () => {
  it("inserts the dash after the second digit while typing", () => {
    expect(formatSrcodeInput("")).toBe("")
    expect(formatSrcodeInput("2")).toBe("2")
    expect(formatSrcodeInput("26")).toBe("26")
    expect(formatSrcodeInput("261")).toBe("26-1")
    expect(formatSrcodeInput("2612345")).toBe("26-12345")
  })

  it("leaves complete codes untouched and truncates overflow", () => {
    expect(formatSrcodeInput("26-12345")).toBe("26-12345")
    expect(formatSrcodeInput("26-12345678")).toBe("26-12345")
  })

  it("drops non-digits, keeping any digits typed", () => {
    expect(formatSrcodeInput("ab26cd1")).toBe("26-1")
    expect(formatSrcodeInput("2-6-1")).toBe("26-1")
  })
})

describe("formatTimeInput", () => {
  it("converts 24-hour picker values to 12-hour display", () => {
    expect(formatTimeInput("08:00")).toBe("8:00 AM")
    expect(formatTimeInput("12:00")).toBe("12:00 PM")
    expect(formatTimeInput("00:30")).toBe("12:30 AM")
    expect(formatTimeInput("13:05")).toBe("1:05 PM")
    expect(formatTimeInput("23:59")).toBe("11:59 PM")
  })

  it("passes anything else through untouched", () => {
    expect(formatTimeInput("")).toBe("")
    expect(formatTimeInput("8:00 AM")).toBe("8:00 AM")
    expect(formatTimeInput("25:00")).toBe("25:00")
    expect(formatTimeInput("12:99")).toBe("12:99")
  })
})

describe("toDateInputValue", () => {
  it("passes ISO dates through for date-picker inputs", () => {
    expect(toDateInputValue("2026-11-01")).toBe("2026-11-01")
  })

  it("converts zero-padded MM/DD/YYYY storage to picker values", () => {
    expect(toDateInputValue("11/01/2026")).toBe("2026-11-01")
    expect(toDateInputValue("01/03/2026")).toBe("2026-01-03")
  })

  it("takes the start half of a stored range", () => {
    expect(toDateInputValue("11/01/2026 - 11/03/2026")).toBe("2026-11-01")
    expect(
      toDateInputValue("November 1, 2026 - November 3, 2026")
    ).toBe("2026-11-01")
  })

  it("returns blank when the stored value is not a date", () => {
    expect(toDateInputValue("")).toBe("")
    expect(toDateInputValue("sometime soon")).toBe("")
  })
})

describe("toTimeInputValue", () => {  it("converts 12-hour display times back to picker values", () => {
    expect(toTimeInputValue("8:00 AM")).toBe("08:00")
    expect(toTimeInputValue("5:00 PM")).toBe("17:00")
    expect(toTimeInputValue("12:00 PM")).toBe("12:00")
    expect(toTimeInputValue("12:30 AM")).toBe("00:30")
  })

  it("accepts lowercase meridiems from verbatim storage", () => {
    expect(toTimeInputValue("12:00 pm - 5:00 pm".split(" - ")[0])).toBe("12:00")
  })

  it("returns blank when the stored value is not a time", () => {
    expect(toTimeInputValue("")).toBe("")
    expect(toTimeInputValue("08:00")).toBe("")
    expect(toTimeInputValue("morning")).toBe("")
  })
})

describe("formatDayLabel", () => {
  it("numbers event days with short month labels", () => {
    expect(formatDayLabel("2026-10-11", 0)).toBe("Day 1 · Oct 11")
    expect(formatDayLabel("2026-10-12", 1)).toBe("Day 2 · Oct 12")
    expect(formatDayLabel("2026-01-03", 9)).toBe("Day 10 · Jan 3")
  })
})

describe("manilaDayKey", () => {  it("keys by the Manila calendar day across the midnight boundary", () => {
    // 23:59 Manila.
    expect(manilaDayKey(new Date("2026-10-11T15:59:00Z"))).toBe("2026-10-11")
    // 00:01 Manila, next day.
    expect(manilaDayKey(new Date("2026-10-11T16:01:00Z"))).toBe("2026-10-12")
  })

  it("accepts ISO strings", () => {
    expect(manilaDayKey("2026-10-11T08:00:00+08:00")).toBe("2026-10-11")
  })
})

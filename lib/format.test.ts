import { describe, expect, it } from "vitest"
import {
  formatSrcodeInput,
  formatTimeInput,
  isValidSrcodeFormat,
  normalizeSrcode,
  SRCODE_MAX_LENGTH,
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

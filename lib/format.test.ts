import { describe, expect, it } from "vitest"
import { isValidSrcodeFormat, normalizeSrcode, SRCODE_MAX_LENGTH } from "./format"

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

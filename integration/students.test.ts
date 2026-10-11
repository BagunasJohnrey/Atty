import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppsScriptError } from "./errors"
import { requestAppsScript } from "./http"
import { lookupStudentNeon } from "./neon"
import { clearStudentLookupCache, lookupStudent } from "./students"

vi.mock("./http", () => ({ requestAppsScript: vi.fn() }))
vi.mock("./neon", () => ({ lookupStudentNeon: vi.fn() }))

const requestMock = vi.mocked(requestAppsScript)
const neonMock = vi.mocked(lookupStudentNeon)

const student = {
  srcode: "26-12345",
  name: "Juan Dela Cruz",
  college: "CICS",
  program: "BSIT",
  yearLevel: "First Year",
  gender: "Male",
}

const OLD_FLAG = process.env.NEON_STUDENTS

beforeEach(() => {
  requestMock.mockReset()
  neonMock.mockReset()
  clearStudentLookupCache()
  delete process.env.NEON_STUDENTS
  requestMock.mockResolvedValue({ success: true, student } as never)
  neonMock.mockResolvedValue(student)
})

describe("lookupStudent cutover", () => {
  it("uses Apps Script by default", async () => {
    await expect(lookupStudent("26-12345")).resolves.toEqual(student)
    expect(requestMock).toHaveBeenCalledWith("lookupStudent", {
      srcode: "26-12345",
    })
    expect(neonMock).not.toHaveBeenCalled()
    process.env.NEON_STUDENTS = OLD_FLAG as string
  })

  it("uses Neon when NEON_STUDENTS=neon", async () => {
    process.env.NEON_STUDENTS = "neon"
    try {
      await expect(lookupStudent("26-12345")).resolves.toEqual(student)
      expect(neonMock).toHaveBeenCalledWith("26-12345")
      expect(requestMock).not.toHaveBeenCalled()
    } finally {
      delete process.env.NEON_STUDENTS
    }
  })

  it("falls back to Apps Script on any other flag value", async () => {
    process.env.NEON_STUDENTS = "sometimes"
    try {
      await expect(lookupStudent("26-12345")).resolves.toEqual(student)
      expect(requestMock).toHaveBeenCalled()
      expect(neonMock).not.toHaveBeenCalled()
    } finally {
      delete process.env.NEON_STUDENTS
    }
  })

  it("serves repeat lookups from cache without re-querying", async () => {
    process.env.NEON_STUDENTS = "neon"
    try {
      await lookupStudent("26-12345")
      await lookupStudent("26-12345")
      expect(neonMock).toHaveBeenCalledTimes(1)
    } finally {
      delete process.env.NEON_STUDENTS
    }
  })

  it("keeps the not-found contract on the Neon path", async () => {
    process.env.NEON_STUDENTS = "neon"
    try {
      neonMock.mockRejectedValue(
        new AppsScriptError(
          "SRCODE_NOT_FOUND",
          "SRCODE not found in the Masterlist.",
          "lookupStudent"
        )
      )
      await expect(lookupStudent("00-00000")).rejects.toMatchObject({
        code: "SRCODE_NOT_FOUND",
      })
    } finally {
      delete process.env.NEON_STUDENTS
    }
  })
})

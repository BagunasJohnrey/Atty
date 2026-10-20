import { describe, expect, it } from "vitest"
import {
  hasReportFilters,
  matchesReportFilters,
  normalizeReportFilters,
  parseReportFilters,
  reportFiltersKey,
} from "./filters"

const record = {
  college: "College of Informatics",
  program: "BSIT",
  yearLevel: "First Year",
  gender: "Male",
}

describe("report filters", () => {
  it("parses the four facet params and ignores everything else", () => {
    const params = new URLSearchParams(
      "college=CICS&program=BSIT&yearLevel=First+Year&gender=Male&day=2026-10-10&q=juan"
    )
    expect(parseReportFilters(params)).toEqual({
      college: "cics",
      program: "bsit",
      yearLevel: "first year",
      gender: "male",
    })
  })

  it("drops blank and whitespace-only values", () => {
    expect(
      normalizeReportFilters({ college: "  ", program: "", gender: " Male " })
    ).toEqual({ gender: "male" })
  })

  it("reports whether any facet is active", () => {
    expect(hasReportFilters({})).toBe(false)
    expect(hasReportFilters({ college: "   " })).toBe(false)
    expect(hasReportFilters({ college: "CICS" })).toBe(true)
  })

  it("keys equal filters identically regardless of casing and order", () => {
    expect(reportFiltersKey({ college: "CICS", gender: "Male" })).toBe(
      reportFiltersKey({ gender: " male ", college: "cics" })
    )
    expect(reportFiltersKey({})).toBe(reportFiltersKey(undefined))
  })

  it("matches facets case-insensitively with no partial matches", () => {
    expect(
      matchesReportFilters(record, { college: "college of informatics" })
    ).toBe(true)
    expect(
      matchesReportFilters(record, { program: "bsit", gender: "male" })
    ).toBe(true)
    expect(matchesReportFilters(record, { college: "cics" })).toBe(false)
    expect(matchesReportFilters(record, {})).toBe(true)
  })
})

import { describe, expect, it } from "vitest"
import {
  invoiceRemaining,
  invoiceStatusAfterPayment,
  monthBounds,
  monthsInRange,
  parsePositiveAmount,
} from "./finance"

describe("invoiceRemaining", () => {
  it("subtracts paid, never negative (overpayment clamped)", () => {
    expect(invoiceRemaining(2500, 0)).toBe(2500)
    expect(invoiceRemaining(2500, 1000)).toBe(1500)
    expect(invoiceRemaining(2500, 2500)).toBe(0)
    expect(invoiceRemaining(2500, 3000)).toBe(0)
  })
})

describe("invoiceStatusAfterPayment", () => {
  it("transitions PENDING → PARTIAL → PAID", () => {
    expect(invoiceStatusAfterPayment(2500, 0)).toBe("PENDING")
    expect(invoiceStatusAfterPayment(2500, 1)).toBe("PARTIAL")
    expect(invoiceStatusAfterPayment(2500, 2499)).toBe("PARTIAL")
    expect(invoiceStatusAfterPayment(2500, 2500)).toBe("PAID")
  })
})

describe("parsePositiveAmount", () => {
  it("accepts positive numbers and numeric strings", () => {
    expect(parsePositiveAmount(2500)).toBe(2500)
    expect(parsePositiveAmount("2500")).toBe(2500)
    expect(parsePositiveAmount("2500.5")).toBe(2500.5)
  })

  it("rejects zero, negatives, NaN and garbage", () => {
    expect(parsePositiveAmount(0)).toBeNull()
    expect(parsePositiveAmount(-5)).toBeNull()
    expect(parsePositiveAmount("abc")).toBeNull()
    expect(parsePositiveAmount("")).toBeNull()
    expect(parsePositiveAmount(null)).toBeNull()
    expect(parsePositiveAmount(undefined)).toBeNull()
    expect(parsePositiveAmount(NaN)).toBeNull()
  })
})

describe("monthBounds", () => {
  it("returns UTC bounds for valid months", () => {
    const b = monthBounds("2026-09")
    expect(b?.start.toISOString()).toBe("2026-09-01T00:00:00.000Z")
    expect(b?.end.toISOString()).toBe("2026-10-01T00:00:00.000Z")
  })

  it("rejects invalid months", () => {
    expect(monthBounds("2026-13")).toBeNull()
    expect(monthBounds("2026-00")).toBeNull()
    expect(monthBounds("sep-2026")).toBeNull()
    expect(monthBounds("")).toBeNull()
  })
})

describe("monthsInRange (academic years spanning two calendar years)", () => {
  it("lists every overlapped month Sep→Jun", () => {
    const months = monthsInRange(new Date(Date.UTC(2026, 8, 15)), new Date(Date.UTC(2027, 5, 30)))
    expect(months[0]).toBe("2026-09")
    expect(months[months.length - 1]).toBe("2027-06")
    expect(months).toHaveLength(10)
    // A February invoice and an October invoice share the academic year.
    expect(months).toContain("2026-10")
    expect(months).toContain("2027-02")
  })
})

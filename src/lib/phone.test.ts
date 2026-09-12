import { describe, expect, it } from "vitest"
import {
  normalizePhone,
  isValidPhone,
  toInternationalFormat,
  maskPhone,
} from "./phone"
import { generateOtpCode, hashOtp } from "./otp"
import { formatVonagePhone, vonageMessageType } from "./vonage"

describe("normalizePhone (Mauritania-first)", () => {
  it("accepts 8-digit national numbers", () => {
    expect(normalizePhone("46123456")).toBe("46123456")
    expect(normalizePhone("46 12 34 56")).toBe("46123456")
    expect(normalizePhone("46-12-34-56")).toBe("46123456")
  })

  it("strips the +222 country code", () => {
    expect(normalizePhone("+22246123456")).toBe("46123456")
    expect(normalizePhone("22246123456")).toBe("46123456")
  })

  it("rejects emails and garbage", () => {
    expect(normalizePhone("teacher@school.com")).toBeNull()
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
    expect(normalizePhone("123")).toBeNull()
  })

  it("keeps other international numbers intact", () => {
    expect(normalizePhone("+33612345678")).toBe("33612345678")
  })
})

describe("isValidPhone", () => {
  it("validates usable login numbers", () => {
    expect(isValidPhone("46123456")).toBe(true)
    expect(isValidPhone("+22246123456")).toBe(true)
    expect(isValidPhone("not-a-number")).toBe(false)
  })
})

describe("toInternationalFormat", () => {
  it("produces +222 format for Mauritanian numbers", () => {
    expect(toInternationalFormat("46123456")).toBe("+22246123456")
    expect(toInternationalFormat("+22246123456")).toBe("+22246123456")
  })

  it("returns null for invalid input", () => {
    expect(toInternationalFormat("abc")).toBeNull()
  })
})

describe("maskPhone", () => {
  it("never exposes the full number", () => {
    const masked = maskPhone("46123456")
    expect(masked).not.toContain("46123456")
    expect(masked).toContain("46")
    expect(masked).toContain("56")
    expect(maskPhone(null)).toBe("••••")
  })
})

describe("OTP helpers", () => {
  it("generates 6-digit numeric codes", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtpCode()
      expect(code).toMatch(/^\d{6}$/)
    }
  })

  it("hashes deterministically", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"))
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"))
  })
})

describe("formatVonagePhone", () => {
  it("produces E.164 digits without +", () => {
    expect(formatVonagePhone("46123456")).toBe("22246123456")
    expect(formatVonagePhone("+22246123456")).toBe("22246123456")
    expect(formatVonagePhone("22246123456")).toBe("22246123456")
  })

  it("rejects invalid numbers", () => {
    expect(formatVonagePhone("abc")).toBeNull()
    expect(formatVonagePhone("")).toBeNull()
  })
})

describe("vonageMessageType", () => {
  it("uses unicode for Arabic, text for Latin", () => {
    expect(vonageMessageType("رمز التفعيل: 123456")).toBe("unicode")
    expect(vonageMessageType("Your code: 123456")).toBe("text")
  })
})

import { describe, expect, it, beforeEach } from "vitest"
import { checkRateLimit } from "./rate-limit"

describe("checkRateLimit", () => {
  it("allows requests within the limit", () => {
    const result = checkRateLimit("test-user-1", { namespace: "test", max: 5, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("blocks requests exceeding the limit", () => {
    const key = "test-block-user"
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { namespace: "test-limit", max: 3, windowSeconds: 60 })
    }
    const result = checkRateLimit(key, { namespace: "test-limit", max: 3, windowSeconds: 60 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("different namespaces are independent", () => {
    const key = "shared-key"
    checkRateLimit(key, { namespace: "ns-a", max: 1, windowSeconds: 60 })
    const result = checkRateLimit(key, { namespace: "ns-b", max: 5, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("returns a valid resetAt timestamp", () => {
    const before = Date.now()
    const result = checkRateLimit("timestamp-user", { namespace: "ts", max: 10, windowSeconds: 60 })
    expect(result.resetAt).toBeGreaterThanOrEqual(before)
    expect(result.resetAt).toBeLessThanOrEqual(before + 61000)
  })
})

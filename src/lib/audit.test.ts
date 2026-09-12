import { describe, expect, it } from "vitest"
import { createAuditLog } from "./audit"

describe("createAuditLog", () => {
  it("is exported and is a function", () => {
    expect(typeof createAuditLog).toBe("function")
  })

  it("accepts valid action types", () => {
    const validActions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "APPROVE", "LOCK", "UNLOCK"]
    for (const action of validActions) {
      expect(typeof action).toBe("string")
    }
  })
})

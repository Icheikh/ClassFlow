import { describe, expect, it } from "vitest"
import { renderMessageVars, smsSegments } from "./message-vars"

describe("renderMessageVars", () => {
  it("substitutes known variables", () => {
    expect(
      renderMessageVars("مستحقات {{studentName}} عن {{month}}: {{amount}} أوقية", {
        studentName: "أحمد",
        month: "2026-09",
        amount: 2500,
      })
    ).toBe("مستحقات أحمد عن 2026-09: 2500 أوقية")
  })

  it("renders unknown keys as empty (never leaks {{...}})", () => {
    expect(renderMessageVars("Hello {{name}} {{oops}}", { name: "A" })).toBe("Hello A ")
  })
})

describe("smsSegments", () => {
  it("counts GSM-7 segments", () => {
    expect(smsSegments("a".repeat(160))).toBe(1)
    expect(smsSegments("a".repeat(161))).toBe(2)
  })

  it("counts Arabic unicode segments (70/67)", () => {
    expect(smsSegments("ر".repeat(70))).toBe(1)
    expect(smsSegments("ر".repeat(71))).toBe(2)
    expect(smsSegments("")).toBe(0)
  })
})

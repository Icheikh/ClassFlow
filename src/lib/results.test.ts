import { describe, expect, it } from "vitest"
import {
  computeSubjectAverage,
  getTermRuleConfig,
  isAssessmentTypeAllowedForTerm,
  normalizeScore,
} from "./results"

describe("normalizeScore", () => {
  it("scales score to 20", () => {
    expect(normalizeScore(15, 20)).toBe(15)
    expect(normalizeScore(7.5, 10)).toBe(15)
    expect(normalizeScore(0, 20)).toBe(0)
  })
  it("scales negative and over-max without clamp", () => {
    expect(normalizeScore(-5, 20)).toBe(-5)
    expect(normalizeScore(30, 20)).toBe(30)
  })
})

describe("getTermRuleConfig", () => {
  it("returns term1 config for order 1", () => {
    const rule = {
      term1TestWeight: 3, term1ExamWeight: 1, term1Denominator: 4, term1RequireTest: true, term1RequireExam: true,
      term2TestWeight: 3, term2ExamWeight: 2, term2Denominator: 5, term2RequireTest: true, term2RequireExam: true,
      term3TestWeight: 3, term3ExamWeight: 3, term3Denominator: 6, term3RequireTest: true, term3RequireExam: true,
      testWeight: 3, exam1Weight: 1, exam2Weight: 2, exam3Weight: 3, denominator: 9,
      requireTest: true, requireExam1: true, requireExam2: true, requireExam3: true,
    }
    const cfg = getTermRuleConfig(rule, 1)
    expect(cfg.testWeight).toBe(3)
    expect(cfg.examWeight).toBe(1)
    expect(cfg.denominator).toBe(4)
  })
})

describe("isAssessmentTypeAllowedForTerm", () => {
  it("allows TEST in term 1", () => {
    expect(isAssessmentTypeAllowedForTerm("TEST", 1)).toBe(true)
  })
  it("disallows EXAM_3 in term 1", () => {
    expect(isAssessmentTypeAllowedForTerm("EXAM_3", 1)).toBe(false)
  })
})

describe("computeSubjectAverage - basic", () => {
  it("placeholder", () => {
    expect(true).toBe(true)
  })
})

import { describe, expect, it } from "vitest"
import {
  computeSubjectAverage,
  computeClassroomResults,
  computeClassroomPublicationReadiness,
  getTermRuleConfig,
  isAssessmentTypeAllowedForTerm,
  normalizeScore,
  resolveCoefficient,
  ASSESSMENT_TYPES,
  type ResultRuleConfig,
} from "./results"

const defaultRule: ResultRuleConfig = {
  term1TestWeight: 3, term1ExamWeight: 1, term1Denominator: 4, term1RequireTest: true, term1RequireExam: true,
  term2TestWeight: 3, term2ExamWeight: 2, term2Denominator: 5, term2RequireTest: true, term2RequireExam: true,
  term3TestWeight: 3, term3ExamWeight: 3, term3Denominator: 6, term3RequireTest: true, term3RequireExam: true,
  testWeight: 3, exam1Weight: 1, exam2Weight: 2, exam3Weight: 3, denominator: 9,
  requireTest: true, requireExam1: true, requireExam2: true, requireExam3: true,
}

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
  it("returns null for zero maxScore", () => {
    expect(normalizeScore(10, 0)).toBeNull()
  })
  it("returns null for non-finite inputs", () => {
    expect(normalizeScore(NaN, 20)).toBeNull()
    expect(normalizeScore(10, Infinity)).toBeNull()
  })
})

describe("getTermRuleConfig", () => {
  it("returns term1 config for order 1", () => {
    const cfg = getTermRuleConfig(defaultRule, 1)
    expect(cfg.testWeight).toBe(3)
    expect(cfg.examWeight).toBe(1)
    expect(cfg.denominator).toBe(4)
  })
  it("returns term2 config for order 2", () => {
    const cfg = getTermRuleConfig(defaultRule, 2)
    expect(cfg.testWeight).toBe(3)
    expect(cfg.examWeight).toBe(2)
    expect(cfg.denominator).toBe(5)
  })
  it("returns term3 config for order 3", () => {
    const cfg = getTermRuleConfig(defaultRule, 3)
    expect(cfg.testWeight).toBe(3)
    expect(cfg.examWeight).toBe(3)
    expect(cfg.denominator).toBe(6)
  })
})

describe("isAssessmentTypeAllowedForTerm", () => {
  it("allows TEST in term 1", () => {
    expect(isAssessmentTypeAllowedForTerm("TEST", 1)).toBe(true)
  })
  it("allows EXAM_1 in term 1", () => {
    expect(isAssessmentTypeAllowedForTerm("EXAM_1", 1)).toBe(true)
  })
  it("disallows EXAM_2 in term 1", () => {
    expect(isAssessmentTypeAllowedForTerm("EXAM_2", 1)).toBe(false)
  })
  it("disallows EXAM_3 in term 1", () => {
    expect(isAssessmentTypeAllowedForTerm("EXAM_3", 1)).toBe(false)
  })
  it("allows EXAM_2 in term 2", () => {
    expect(isAssessmentTypeAllowedForTerm("EXAM_2", 2)).toBe(true)
  })
  it("allows EXAM_3 in term 3", () => {
    expect(isAssessmentTypeAllowedForTerm("EXAM_3", 3)).toBe(true)
  })
  it("allows TEST in all terms", () => {
    expect(isAssessmentTypeAllowedForTerm("TEST", 1)).toBe(true)
    expect(isAssessmentTypeAllowedForTerm("TEST", 2)).toBe(true)
    expect(isAssessmentTypeAllowedForTerm("TEST", 3)).toBe(true)
  })
})

describe("resolveCoefficient", () => {
  const coefficients = [
    { subjectId: "s1", levelId: "l1", streamId: null, classroomId: "c1", coefficient: 3 },
    { subjectId: "s1", levelId: "l1", streamId: "st1", classroomId: null, coefficient: 2 },
    { subjectId: "s1", levelId: "l1", streamId: null, classroomId: null, coefficient: 1 },
  ]

  it("returns classroom-specific coefficient", () => {
    const result = resolveCoefficient({
      subjectId: "s1", classroomId: "c1", levelId: "l1", streamId: "st1", coefficients,
    })
    expect(result).toBe(3)
  })

  it("returns stream-specific coefficient when no classroom match", () => {
    const result = resolveCoefficient({
      subjectId: "s1", classroomId: "c2", levelId: "l1", streamId: "st1", coefficients,
    })
    expect(result).toBe(2)
  })

  it("returns level-specific coefficient when no stream/classroom match", () => {
    const result = resolveCoefficient({
      subjectId: "s1", classroomId: "c2", levelId: "l1", streamId: null, coefficients,
    })
    expect(result).toBe(1)
  })

  it("returns default 1 when no match", () => {
    const result = resolveCoefficient({
      subjectId: "s99", classroomId: "c99", levelId: "l99", streamId: null, coefficients,
    })
    expect(result).toBe(1)
  })
})

describe("computeSubjectAverage", () => {
  it("computes term 1 average with test and exam", () => {
    const assessments = [
      { subjectId: "s1", type: "TEST", termOrder: 1, maxScore: 20, scores: [{ studentId: "st1", score: 16 }] },
      { subjectId: "s1", type: "EXAM_1", termOrder: 1, maxScore: 20, scores: [{ studentId: "st1", score: 14 }] },
    ]
    const result = computeSubjectAverage({ assessments, studentId: "st1", rule: defaultRule, termOrder: 1 })
    // test avg = 16, exam avg = 14, weighted = (16*3 + 14*1) / 4 = 62/4 = 15.5
    expect(result.finalAverage).toBe(15.5)
    expect(result.testAverage).toBe(16)
    expect(result.exam1Average).toBe(14)
  })

  it("returns null when required exam is missing", () => {
    const assessments = [
      { subjectId: "s1", type: "TEST", termOrder: 1, maxScore: 20, scores: [{ studentId: "st1", score: 16 }] },
    ]
    const result = computeSubjectAverage({ assessments, studentId: "st1", rule: defaultRule, termOrder: 1 })
    expect(result.finalAverage).toBeNull()
  })

  it("returns null for student with no scores", () => {
    const assessments = [
      { subjectId: "s1", type: "TEST", termOrder: 1, maxScore: 20, scores: [{ studentId: "st2", score: 16 }] },
    ]
    const result = computeSubjectAverage({ assessments, studentId: "st1", rule: defaultRule, termOrder: 1 })
    expect(result.finalAverage).toBeNull()
  })

  it("computes cumulative term 3 average using all exams", () => {
    const assessments = [
      { subjectId: "s1", type: "TEST", termOrder: 1, maxScore: 20, scores: [{ studentId: "st1", score: 16 }] },
      { subjectId: "s1", type: "TEST", termOrder: 2, maxScore: 20, scores: [{ studentId: "st1", score: 18 }] },
      { subjectId: "s1", type: "TEST", termOrder: 3, maxScore: 20, scores: [{ studentId: "st1", score: 14 }] },
      { subjectId: "s1", type: "EXAM_1", termOrder: 1, maxScore: 20, scores: [{ studentId: "st1", score: 12 }] },
      { subjectId: "s1", type: "EXAM_2", termOrder: 2, maxScore: 20, scores: [{ studentId: "st1", score: 10 }] },
      { subjectId: "s1", type: "EXAM_3", termOrder: 3, maxScore: 20, scores: [{ studentId: "st1", score: 15 }] },
    ]
    const result = computeSubjectAverage({ assessments, studentId: "st1", rule: defaultRule, termOrder: 3 })
    // cumulative test avg = (16+18+14)/3 = 16
    // weighted = (16*3 + 12*1 + 10*2 + 15*3) / 9 = (48+12+20+45)/9 = 125/9 ≈ 13.89
    expect(result.testAverage).toBe(16)
    expect(result.exam1Average).toBe(12)
    expect(result.exam2Average).toBe(10)
    expect(result.exam3Average).toBe(15)
    expect(result.finalAverage).toBeCloseTo(13.89, 1)
  })
})

describe("computeClassroomResults", () => {
  it("ranks students by average", () => {
    const students = [
      { id: "st1", firstName: "أحمد", lastName: "محمد" },
      { id: "st2", firstName: "سارة", lastName: "علي" },
    ]
    const assessments = [
      { subjectId: "s1", type: "TEST", termOrder: 1, maxScore: 20, scores: [
        { studentId: "st1", score: 16 },
        { studentId: "st2", score: 18 },
      ]},
      { subjectId: "s1", type: "EXAM_1", termOrder: 1, maxScore: 20, scores: [
        { studentId: "st1", score: 14 },
        { studentId: "st2", score: 16 },
      ]},
    ]
    const coefficients = [
      { subjectId: "s1", levelId: "l1", streamId: null, classroomId: null, coefficient: 2 },
    ]
    const results = computeClassroomResults({
      students, assessments, coefficients,
      classroomId: "c1", levelId: "l1", streamId: null,
      rule: defaultRule, termOrder: 1,
    })
    expect(results[0].studentId).toBe("st2") // sara scored higher
    expect(results[0].rank).toBe(1)
    expect(results[1].rank).toBe(2)
  })

  it("handles empty students", () => {
    const results = computeClassroomResults({
      students: [], assessments: [], coefficients: [],
      classroomId: "c1", levelId: "l1", streamId: null,
      rule: defaultRule, termOrder: 1,
    })
    expect(results).toHaveLength(0)
  })
})

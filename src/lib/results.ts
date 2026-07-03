export const ASSESSMENT_TYPES = {
  TEST: "TEST",
  EXAM_1: "EXAM_1",
  EXAM_2: "EXAM_2",
  EXAM_3: "EXAM_3",
} as const

export const RESULT_PUBLICATION_STATUSES = {
  OPEN: "OPEN",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
} as const

type AssessmentType = (typeof ASSESSMENT_TYPES)[keyof typeof ASSESSMENT_TYPES]

export type ResultRuleConfig = {
  testWeight: number
  exam1Weight: number
  exam2Weight: number
  exam3Weight: number
  denominator: number
  requireTest: boolean
  requireExam1: boolean
  requireExam2: boolean
  requireExam3: boolean
}

type ScoreRow = {
  studentId: string
  score: number
}

type AssessmentRow = {
  subjectId: string
  type: AssessmentType | string
  maxScore: number
  scores: ScoreRow[]
}

type CoefficientRule = {
  subjectId: string
  levelId: string
  streamId: string | null
  classroomId: string | null
  coefficient: number
}

type StudentIdentity = {
  id: string
  firstName: string
  lastName: string
}

export type StudentResultSummary = {
  studentId: string
  studentName: string
  totalWeightedScore: number
  totalCoefficients: number
  average: number | null
  rank: number | null
  subjectResults: {
    subjectId: string
    testAverage: number | null
    exam1Average: number | null
    exam2Average: number | null
    exam3Average: number | null
    finalAverage: number | null
    coefficient: number
    weightedScore: number
  }[]
}

function roundScore(value: number, precision = 2) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function normalizeScore(score: number, maxScore: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null
  return (score / maxScore) * 20
}

export function computeAssessmentAverage(
  assessments: AssessmentRow[],
  studentId: string,
  type: AssessmentType | string
) {
  const normalizedScores = assessments
    .filter((assessment) => normalizeAssessmentType(assessment.type) === type)
    .map((assessment) => {
      const row = assessment.scores.find((score) => score.studentId === studentId)
      if (!row) return null
      return normalizeScore(row.score, assessment.maxScore)
    })
    .filter((score): score is number => score != null)

  const result = average(normalizedScores)
  return result == null ? null : roundScore(result)
}

export function normalizeAssessmentType(type: string) {
  if (type === "EXAM") return ASSESSMENT_TYPES.EXAM_1
  return type
}

export function computeSubjectAverage(options: {
  assessments: AssessmentRow[]
  studentId: string
  rule: ResultRuleConfig
}) {
  const testAverage = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.TEST)
  const exam1Average = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.EXAM_1)
  const exam2Average = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.EXAM_2)
  const exam3Average = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.EXAM_3)

  if (
    (options.rule.requireTest && testAverage == null) ||
    (options.rule.requireExam1 && exam1Average == null) ||
    (options.rule.requireExam2 && exam2Average == null) ||
    (options.rule.requireExam3 && exam3Average == null)
  ) {
    return {
      testAverage,
      exam1Average,
      exam2Average,
      exam3Average,
      finalAverage: null,
    }
  }

  const weightedSum =
    ((testAverage ?? 0) * options.rule.testWeight) +
    ((exam1Average ?? 0) * options.rule.exam1Weight) +
    ((exam2Average ?? 0) * options.rule.exam2Weight) +
    ((exam3Average ?? 0) * options.rule.exam3Weight)

  const denominator = options.rule.denominator > 0
    ? options.rule.denominator
    : options.rule.testWeight + options.rule.exam1Weight + options.rule.exam2Weight + options.rule.exam3Weight

  const finalAverage = denominator > 0 ? weightedSum / denominator : 0
  return {
    testAverage,
    exam1Average,
    exam2Average,
    exam3Average,
    finalAverage: roundScore(finalAverage),
  }
}

export function resolveCoefficient(options: {
  subjectId: string
  classroomId: string
  levelId: string
  streamId: string | null
  coefficients: CoefficientRule[]
}) {
  const classroomSpecific = options.coefficients.find((rule) =>
    rule.subjectId === options.subjectId && rule.classroomId === options.classroomId
  )
  if (classroomSpecific) return classroomSpecific.coefficient

  const streamSpecific = options.coefficients.find((rule) =>
    rule.subjectId === options.subjectId &&
    rule.levelId === options.levelId &&
    rule.streamId === options.streamId &&
    rule.classroomId == null
  )
  if (streamSpecific) return streamSpecific.coefficient

  const levelSpecific = options.coefficients.find((rule) =>
    rule.subjectId === options.subjectId &&
    rule.levelId === options.levelId &&
    rule.streamId == null &&
    rule.classroomId == null
  )
  return levelSpecific?.coefficient ?? 1
}

export function computeClassroomResults(options: {
  students: StudentIdentity[]
  assessments: AssessmentRow[]
  coefficients: CoefficientRule[]
  classroomId: string
  levelId: string
  streamId: string | null
  rule: ResultRuleConfig
}) {
  const subjectIds = [...new Set(options.assessments.map((assessment) => assessment.subjectId))]

  const rows: StudentResultSummary[] = options.students.map((student) => {
    const subjectResults = subjectIds.map((subjectId) => {
      const subjectAssessments = options.assessments.filter((assessment) => assessment.subjectId === subjectId)
      const averages = computeSubjectAverage({
        assessments: subjectAssessments,
        studentId: student.id,
        rule: options.rule,
      })

      const coefficient = resolveCoefficient({
        subjectId,
        classroomId: options.classroomId,
        levelId: options.levelId,
        streamId: options.streamId,
        coefficients: options.coefficients,
      })

      const weightedScore = averages.finalAverage == null ? 0 : roundScore(averages.finalAverage * coefficient)

      return {
        subjectId,
        testAverage: averages.testAverage,
        exam1Average: averages.exam1Average,
        exam2Average: averages.exam2Average,
        exam3Average: averages.exam3Average,
        finalAverage: averages.finalAverage,
        coefficient,
        weightedScore,
      }
    }).filter((subject) => subject.finalAverage != null)

    const totalWeightedScore = roundScore(subjectResults.reduce((sum, subject) => sum + subject.weightedScore, 0))
    const totalCoefficients = roundScore(subjectResults.reduce((sum, subject) => sum + subject.coefficient, 0))
    const averageScore = totalCoefficients > 0 ? roundScore(totalWeightedScore / totalCoefficients) : null

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      totalWeightedScore,
      totalCoefficients,
      average: averageScore,
      rank: null,
      subjectResults,
    }
  })

  const sorted = rows
    .slice()
    .sort((left, right) => {
      if (left.average == null && right.average == null) {
        return left.studentName.localeCompare(right.studentName, "ar")
      }
      if (left.average == null) return 1
      if (right.average == null) return -1
      return right.average - left.average || left.studentName.localeCompare(right.studentName, "ar")
    })
    .map((row, index, array) => {
      if (row.average == null) {
        return { ...row, rank: null }
      }

      const computedBefore = array.slice(0, index).filter((item) => item.average != null).length
      return { ...row, rank: computedBefore + 1 }
    })

  return sorted
}

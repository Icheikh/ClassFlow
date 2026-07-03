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

type SubjectIdentity = {
  id: string
  nameAr: string
}

export type ClassroomPublicationReadiness = {
  publishable: boolean
  studentsCount: number
  fullyComputedStudents: number
  assignedSubjectsCount: number
  readySubjectsCount: number
  missingCoefficientSubjects: {
    subjectId: string
    subjectName: string
  }[]
  incompleteSubjects: {
    subjectId: string
    subjectName: string
    readyStudents: number
    studentsCount: number
    missingAssessmentTypes: string[]
  }[]
}

export type TermAssessmentRequirement = {
  type: AssessmentType | string
  label: string
  required: boolean
  weight: number
  minimumCount: number
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

function getAssessmentLabel(type: AssessmentType | string) {
  if (type === ASSESSMENT_TYPES.TEST) return "الاختبارات"
  if (type === ASSESSMENT_TYPES.EXAM_1) return "الامتحان الأول"
  if (type === ASSESSMENT_TYPES.EXAM_2) return "الامتحان الثاني"
  if (type === ASSESSMENT_TYPES.EXAM_3) return "الامتحان الأخير"
  return type
}

export function getTermExamType(termOrder?: number | null) {
  if (termOrder === 1) return ASSESSMENT_TYPES.EXAM_1
  if (termOrder === 2) return ASSESSMENT_TYPES.EXAM_2
  return ASSESSMENT_TYPES.EXAM_3
}

export function getTermAssessmentRequirements(rule: ResultRuleConfig, termOrder?: number | null): TermAssessmentRequirement[] {
  const examType = getTermExamType(termOrder)
  const examWeight =
    examType === ASSESSMENT_TYPES.EXAM_1
      ? rule.exam1Weight
      : examType === ASSESSMENT_TYPES.EXAM_2
        ? rule.exam2Weight
        : rule.exam3Weight
  const examRequired =
    examType === ASSESSMENT_TYPES.EXAM_1
      ? rule.requireExam1
      : examType === ASSESSMENT_TYPES.EXAM_2
        ? rule.requireExam2
        : rule.requireExam3

  return [
    {
      type: ASSESSMENT_TYPES.TEST,
      label: getAssessmentLabel(ASSESSMENT_TYPES.TEST),
      required: rule.requireTest,
      weight: rule.testWeight,
      minimumCount: rule.requireTest ? 1 : 0,
    },
    {
      type: examType,
      label: getAssessmentLabel(examType),
      required: examRequired,
      weight: examWeight,
      minimumCount: examRequired ? 1 : 0,
    },
  ]
}

export function isAssessmentTypeAllowedForTerm(type: string, termOrder?: number | null) {
  const normalizedType = normalizeAssessmentType(type)
  const allowedTypes = new Set(getTermAssessmentRequirements({
    testWeight: 3,
    exam1Weight: 1,
    exam2Weight: 2,
    exam3Weight: 3,
    denominator: 9,
    requireTest: true,
    requireExam1: true,
    requireExam2: true,
    requireExam3: true,
  }, termOrder).map((item) => item.type))

  return allowedTypes.has(normalizedType)
}

export function buildTermCalculationNote(rule: ResultRuleConfig, termOrder?: number | null) {
  const requirements = getTermAssessmentRequirements(rule, termOrder)
  const numerator = requirements
    .filter((item) => item.weight > 0)
    .map((item) => `${item.label} × ${item.weight}`)
    .join(" + ")
  const denominator = requirements.reduce((sum, item) => sum + item.weight, 0)
  return `في هذا الفصل: (${numerator}) ÷ ${denominator}`
}

export function buildTermAssessmentPolicyNote(rule: ResultRuleConfig, termOrder?: number | null) {
  const currentExam = getTermAssessmentRequirements(rule, termOrder).find((item) => item.type !== ASSESSMENT_TYPES.TEST)
  return `في كل فصل يجب تسجيل اختبار واحد على الأقل ويمكن إضافة أكثر من اختبار، ثم ${currentExam?.label || "امتحان الفصل"} لهذا الفصل.`
}

export function computeSubjectAverage(options: {
  assessments: AssessmentRow[]
  studentId: string
  rule: ResultRuleConfig
  termOrder?: number | null
}) {
  const testAverage = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.TEST)
  const exam1Average = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.EXAM_1)
  const exam2Average = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.EXAM_2)
  const exam3Average = computeAssessmentAverage(options.assessments, options.studentId, ASSESSMENT_TYPES.EXAM_3)

  if (options.termOrder != null) {
    const termRequirements = getTermAssessmentRequirements(options.rule, options.termOrder)
    const termExamType = getTermExamType(options.termOrder)
    const termExamAverage =
      termExamType === ASSESSMENT_TYPES.EXAM_1
        ? exam1Average
        : termExamType === ASSESSMENT_TYPES.EXAM_2
          ? exam2Average
          : exam3Average

    const hasMissingRequired = termRequirements.some((item) => {
      if (!item.required) return false
      if (item.type === ASSESSMENT_TYPES.TEST) return testAverage == null
      return termExamAverage == null
    })

    if (hasMissingRequired) {
      return {
        testAverage,
        exam1Average,
        exam2Average,
        exam3Average,
        finalAverage: null,
      }
    }

    const denominator = termRequirements.reduce((sum, item) => {
      if (item.type === ASSESSMENT_TYPES.TEST) {
        return testAverage != null ? sum + item.weight : sum
      }
      return termExamAverage != null ? sum + item.weight : sum
    }, 0)

    const weightedSum =
      ((testAverage ?? 0) * options.rule.testWeight) +
      ((termExamAverage ?? 0) * (termRequirements.find((item) => item.type === termExamType)?.weight || 0))

    return {
      testAverage,
      exam1Average,
      exam2Average,
      exam3Average,
      finalAverage: denominator > 0 ? roundScore(weightedSum / denominator) : null,
    }
  }

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
  return resolveCoefficientRule(options).coefficient
}

export function resolveCoefficientRule(options: {
  subjectId: string
  classroomId: string
  levelId: string
  streamId: string | null
  coefficients: CoefficientRule[]
}) {
  const classroomSpecific = options.coefficients.find((rule) =>
    rule.subjectId === options.subjectId && rule.classroomId === options.classroomId
  )
  if (classroomSpecific) {
    return {
      coefficient: classroomSpecific.coefficient,
      source: "CLASSROOM" as const,
      matched: true,
    }
  }

  const streamSpecific = options.coefficients.find((rule) =>
    rule.subjectId === options.subjectId &&
    rule.levelId === options.levelId &&
    rule.streamId === options.streamId &&
    rule.classroomId == null
  )
  if (streamSpecific) {
    return {
      coefficient: streamSpecific.coefficient,
      source: "STREAM" as const,
      matched: true,
    }
  }

  const levelSpecific = options.coefficients.find((rule) =>
    rule.subjectId === options.subjectId &&
    rule.levelId === options.levelId &&
    rule.streamId == null &&
    rule.classroomId == null
  )
  if (levelSpecific) {
    return {
      coefficient: levelSpecific.coefficient,
      source: "LEVEL" as const,
      matched: true,
    }
  }

  return {
    coefficient: 1,
    source: "DEFAULT" as const,
    matched: false,
  }
}

export function computeClassroomPublicationReadiness(options: {
  students: StudentIdentity[]
  assessments: AssessmentRow[]
  coefficients: CoefficientRule[]
  classroomId: string
  levelId: string
  streamId: string | null
  rule: ResultRuleConfig
  subjects: SubjectIdentity[]
  termOrder?: number | null
}): ClassroomPublicationReadiness {
  const readinessByStudent = new Map(options.students.map((student) => [student.id, true]))
  const missingCoefficientSubjects: ClassroomPublicationReadiness["missingCoefficientSubjects"] = []
  const incompleteSubjects: ClassroomPublicationReadiness["incompleteSubjects"] = []
  let readySubjectsCount = 0

  for (const subject of options.subjects) {
    const subjectAssessments = options.assessments.filter((assessment) => assessment.subjectId === subject.id)
    const coefficient = resolveCoefficientRule({
      subjectId: subject.id,
      classroomId: options.classroomId,
      levelId: options.levelId,
      streamId: options.streamId,
      coefficients: options.coefficients,
    })

    if (!coefficient.matched) {
      missingCoefficientSubjects.push({
        subjectId: subject.id,
        subjectName: subject.nameAr,
      })
    }

    const readyStudents = options.students.reduce((count, student) => {
      const averages = computeSubjectAverage({
        assessments: subjectAssessments,
        studentId: student.id,
        rule: options.rule,
        termOrder: options.termOrder,
      })

      if (averages.finalAverage == null || !coefficient.matched) {
        readinessByStudent.set(student.id, false)
        return count
      }

      return count + 1
    }, 0)

    const missingAssessmentTypes = getTermAssessmentRequirements(options.rule, options.termOrder)
      .filter((item) => item.required)
      .filter((item) => !subjectAssessments.some((assessment) => normalizeAssessmentType(assessment.type) === item.type))
      .map((item) => item.label)

    if (coefficient.matched && readyStudents === options.students.length && options.students.length > 0) {
      readySubjectsCount += 1
    } else {
      incompleteSubjects.push({
        subjectId: subject.id,
        subjectName: subject.nameAr,
        readyStudents,
        studentsCount: options.students.length,
        missingAssessmentTypes,
      })
    }
  }

  const fullyComputedStudents = options.students.filter((student) => readinessByStudent.get(student.id)).length
  const publishable =
    options.students.length > 0 &&
    options.subjects.length > 0 &&
    missingCoefficientSubjects.length === 0 &&
    incompleteSubjects.length === 0 &&
    fullyComputedStudents === options.students.length

  return {
    publishable,
    studentsCount: options.students.length,
    fullyComputedStudents,
    assignedSubjectsCount: options.subjects.length,
    readySubjectsCount,
    missingCoefficientSubjects,
    incompleteSubjects,
  }
}

export function computeClassroomResults(options: {
  students: StudentIdentity[]
  assessments: AssessmentRow[]
  coefficients: CoefficientRule[]
  classroomId: string
  levelId: string
  streamId: string | null
  rule: ResultRuleConfig
  termOrder?: number | null
}) {
  const subjectIds = [...new Set(options.assessments.map((assessment) => assessment.subjectId))]

  const rows: StudentResultSummary[] = options.students.map((student) => {
    const subjectResults = subjectIds.map((subjectId) => {
      const subjectAssessments = options.assessments.filter((assessment) => assessment.subjectId === subjectId)
      const averages = computeSubjectAverage({
        assessments: subjectAssessments,
        studentId: student.id,
        rule: options.rule,
        termOrder: options.termOrder,
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

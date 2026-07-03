const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

function normalizeAssessmentType(type, label) {
  if (type !== "EXAM") return type
  if (label.includes("الثالث")) return "EXAM_3"
  if (label.includes("الثاني")) return "EXAM_2"
  return "EXAM_1"
}

async function main() {
  const grades = await prisma.grade.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })

  const groups = new Map()

  for (const grade of grades) {
    const dateKey = grade.date.toISOString().slice(0, 10)
    const key = [
      grade.schoolId,
      grade.academicYearId,
      grade.termId,
      grade.classroomId,
      grade.subjectId,
      grade.teacherId,
      grade.assessmentType,
      grade.label,
      grade.maxScore,
      dateKey,
    ].join("::")

    if (!groups.has(key)) {
      groups.set(key, {
        schoolId: grade.schoolId,
        academicYearId: grade.academicYearId,
        termId: grade.termId,
        classroomId: grade.classroomId,
        subjectId: grade.subjectId,
        teacherId: grade.teacherId,
        type: normalizeAssessmentType(grade.assessmentType, grade.label),
        title: grade.label,
        maxScore: grade.maxScore,
        status: grade.status,
        date: grade.date,
        scores: [],
      })
    }

    groups.get(key).scores.push({
      schoolId: grade.schoolId,
      studentId: grade.studentId,
      score: grade.score,
      status: grade.status,
    })
  }

  let created = 0
  for (const group of groups.values()) {
    const existing = await prisma.assessment.findFirst({
      where: {
        schoolId: group.schoolId,
        academicYearId: group.academicYearId,
        termId: group.termId,
        classroomId: group.classroomId,
        subjectId: group.subjectId,
        teacherId: group.teacherId,
        type: group.type,
        title: group.title,
        date: group.date,
      },
      select: { id: true },
    })

    if (existing) continue

    await prisma.assessment.create({
      data: {
        schoolId: group.schoolId,
        academicYearId: group.academicYearId,
        termId: group.termId,
        classroomId: group.classroomId,
        subjectId: group.subjectId,
        teacherId: group.teacherId,
        type: group.type,
        title: group.title,
        maxScore: group.maxScore,
        status: group.status,
        date: group.date,
        scores: {
          create: group.scores,
        },
      },
    })
    created += 1
  }

  console.log(`Backfilled ${created} assessments from ${grades.length} grade rows.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

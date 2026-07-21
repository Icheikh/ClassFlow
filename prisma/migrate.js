// Migration Script: Restructure classrooms, levels, and students
// Run: node prisma/migrate.js
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const schoolId = (await prisma.school.findFirst({ where: { slug: "al-noor" } }))?.id
  if (!schoolId) { console.error("❌ School not found"); process.exit(1) }

  const activeYear = await prisma.academicYear.findFirst({ where: { schoolId, isActive: true } })
  if (!activeYear) { console.error("❌ No active academic year"); process.exit(1) }

  console.log("🗑️  Deleting existing data...")

  // Delete in dependency order
  await prisma.grade.deleteMany({ where: { schoolId } })
  await prisma.attendance.deleteMany({ where: { schoolId } })
  await prisma.studentParent.deleteMany({ where: { schoolId } })
  await prisma.enrollment.deleteMany({ where: { schoolId } })
  await prisma.lesson.deleteMany({ where: { schoolId } })
  await prisma.scheduleAttendance.deleteMany({ where: { schoolId } })
  await prisma.teacherAttendance.deleteMany({ where: { schoolId } })
  await prisma.notification.deleteMany({ where: { schoolId } })
  await prisma.payment.deleteMany({ where: { schoolId } })
  await prisma.student.deleteMany({ where: { schoolId } })
  await prisma.schedule.deleteMany({ where: { schoolId } })
  await prisma.teacherAssignment.deleteMany({ where: { schoolId } })
  await prisma.classroom.deleteMany({ where: { schoolId } })
  await prisma.subjectCoefficient.deleteMany({ where: { schoolId } })
  await prisma.stream.deleteMany({ where: { schoolId } })

  // Update high school levels (1AS→السنة الأولى ثانوي, 2AS→السنة الثانية, 3AS→السنة الثالثة)
  const stages = await prisma.educationStage.findMany({ where: { schoolId } })
  const highStage = stages.find((s) => s.name === "الثانوية")
  const middleStage = stages.find((s) => s.name === "الإعدادية")

  if (!highStage || !middleStage) { console.error("❌ Stages not found"); process.exit(1) }

  // Get or create levels
  const midLevels = [
    { name: "1AS", order: 1 },
    { name: "2AS", order: 2 },
    { name: "3AS", order: 3 },
    { name: "4AS", order: 4 },
  ]

  const highLevels = [
    { name: "5", order: 5 },
    { name: "6", order: 6 },
    { name: "7", order: 7 },
  ]

  // Delete old levels
  await prisma.level.deleteMany({ where: { schoolId } })

  // Create new middle school levels
  const createdMidLevels = []
  for (const lv of midLevels) {
    const level = await prisma.level.create({
      data: { schoolId, stageId: middleStage.id, name: lv.name, order: lv.order },
    })
    createdMidLevels.push(level)
  }

  // Create new high school levels
  const createdHighLevels = []
  for (const lv of highLevels) {
    const level = await prisma.level.create({
      data: { schoolId, stageId: highStage.id, name: lv.name, order: lv.order },
    })
    createdHighLevels.push(level)
  }

  // Map level names to IDs
  const levelMap = {}
  for (const l of [...createdMidLevels, ...createdHighLevels]) {
    levelMap[l.name] = l
  }

  console.log("✅ Levels created")
  console.log("🏫 Creating classrooms...")

  // Classroom definitions: [name, levelName]
  const classroomDefs = [
    // Middle school
    ["1AS1", "1AS"], ["1AS2", "1AS"],
    ["2AS1", "2AS"], ["2AS2", "2AS"],
    ["3AS1", "3AS"], ["3AS2", "3AS"],
    ["4AS1", "4AS"], ["4AS2", "4AS"], ["4AS3", "4AS"],
    // High school
    ["5A", "5"], ["5C", "5"], ["5D", "5"],
    ["6C1", "6"], ["6C2", "6"], ["6A", "6"], ["6D1", "6"], ["6D2", "6"],
    ["7C", "7"], ["7D1", "7"], ["7D2", "7"],
  ]

  const classrooms = []
  for (const [name, levelName] of classroomDefs) {
    const c = await prisma.classroom.create({
      data: { schoolId, levelId: levelMap[levelName].id, name, capacity: 40 },
    })
    classrooms.push(c)
  }

  console.log(`✅ ${classrooms.length} classrooms created`)

  // === Create Teacher Assignments for existing teacher ===
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId },
    include: { user: true },
  })

  if (teacher) {
    const subjects = await prisma.subject.findMany({ where: { schoolId } })
    const arabic = subjects.find((s) => s.code === "ARAB")
    const math = subjects.find((s) => s.code === "MATH")
    const french = subjects.find((s) => s.code === "FREN")
    const physics = subjects.find((s) => s.code === "PHYS")
    const biology = subjects.find((s) => s.code === "SVT")

    // Assign each subject to some classrooms
    if (arabic) {
      for (const c of classrooms.filter((c) => c.name.startsWith("1AS") || c.name.startsWith("2AS"))) {
        await prisma.teacherAssignment.create({
          data: { schoolId, teacherId: teacher.id, subjectId: arabic.id, classroomId: c.id, academicYearId: activeYear.id, hourlyRate: 250, weeklyHours: 4 },
        })
      }
    }
    if (math) {
      for (const c of classrooms.filter((c) => c.name.startsWith("3AS") || c.name.startsWith("4AS"))) {
        await prisma.teacherAssignment.create({
          data: { schoolId, teacherId: teacher.id, subjectId: math.id, classroomId: c.id, academicYearId: activeYear.id, hourlyRate: 300, weeklyHours: 5 },
        })
      }
    }
    if (french) {
      for (const c of classrooms.filter((c) => c.name.startsWith("5") || c.name.startsWith("6"))) {
        await prisma.teacherAssignment.create({
          data: { schoolId, teacherId: teacher.id, subjectId: french.id, classroomId: c.id, academicYearId: activeYear.id, hourlyRate: 250, weeklyHours: 3 },
        })
      }
    }

    console.log(`✅ Teacher assignments created for ${teacher.user.name}`)
  }

  // === Create Students (10 per classroom) ===
  console.log("👨‍🎓 Creating students...")

  const firstNames = [
    "أحمد", "محمد", "فاطمة", "عائشة", "عبد الله",
    "مريم", "إبراهيم", "خديجة", "يوسف", "سارة",
    "عمر", "حواء", "علي", "آمنة", "خالد",
    "نورة", "سعيد", "لينا", "موسى", "هند",
  ]

  const lastNames = [
    "ولد محمد", "بنت أحمد", "ولد سيدي", "بنت عمر", "ولد الشيخ",
    "بنت عبد الله", "ولد الحسن", "بنت محمد", "ولد أحمد", "بنت عبد الرحمن",
    "ولد الحسين", "بنت سعيد", "ولد المختار", "بنت الحسن", "ولد إبراهيم",
    "بنت يوسف", "ولد عبد القادر", "بنت موسى", "ولد سالم", "بنت خالد",
  ]

  let totalStudents = 0
  for (const c of classrooms) {
    for (let i = 0; i < 10; i++) {
      const firstName = firstNames[(totalStudents + i) % firstNames.length]
      const lastName = lastNames[(totalStudents + i) % lastNames.length]
      const gender = i % 2 === 0 ? "MALE" : "FEMALE"
      const studentNumber = `${c.name}-${String(i + 1).padStart(2, "0")}`

      const student = await prisma.student.create({
        data: {
          schoolId,
          firstName, lastName, gender,
          studentNumber,
          isActive: true,
        },
      })

      await prisma.enrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicYearId: activeYear.id,
          classroomId: c.id,
          status: "ACTIVE",
        },
      })

      totalStudents++
    }
  }

  console.log(`✅ ${totalStudents} students created and enrolled`)

  // Update billing count
  await prisma.school.update({
    where: { id: schoolId },
    data: { billingStudentCount: totalStudents },
  })

  console.log("\n🎉 Migration complete!")
  console.log(`   ${classrooms.length} classrooms`)
  console.log(`   ${totalStudents} students`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

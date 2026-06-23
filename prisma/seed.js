const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10)

  // ============================================================
  // SCHOOL 1: مدرسة النور (ابتدائي + إعدادي + ثانوي)
  // ============================================================
  const school1 = await prisma.school.create({
    data: {
      name: "مدرسة النور",
      slug: "al-noor",
      address: "نواكشوط، موريتانيا",
      phone: "+222 12345678",
      email: "info@alnoor.edu",
      subscriptionStatus: "TRIAL",
      billingStudentCount: 25,
    },
  })

  // --- Education Stages ---
  const primary = await prisma.educationStage.create({
    data: { schoolId: school1.id, name: "الابتدائية", order: 1 },
  })
  const middle = await prisma.educationStage.create({
    data: { schoolId: school1.id, name: "الإعدادية", order: 2 },
  })
  const high = await prisma.educationStage.create({
    data: { schoolId: school1.id, name: "الثانوية", order: 3 },
  })

  // --- Levels ---
  // Primary: 1-6
  const primaryLevels = []
  for (let i = 1; i <= 6; i++) {
    primaryLevels.push(await prisma.level.create({
      data: { schoolId: school1.id, stageId: primary.id, name: `السنة ${i} ابتدائي`, order: i },
    }))
  }
  // Middle: 1-4 (7ème to 10ème)
  const middleLevels = []
  for (let i = 1; i <= 4; i++) {
    middleLevels.push(await prisma.level.create({
      data: { schoolId: school1.id, stageId: middle.id, name: `السنة ${i} إعدادي`, order: i },
    }))
  }
  // High: 5-7 (1AS, 2AS, 3AS)
  const highLevels = []
  const highNames = ["1AS", "2AS", "3AS"]
  for (let i = 0; i < 3; i++) {
    highLevels.push(await prisma.level.create({
      data: { schoolId: school1.id, stageId: high.id, name: highNames[i], order: 5 + i },
    }))
  }

  // --- Streams (for 2AS and 3AS) ---
  const streamMath = await prisma.stream.create({
    data: { schoolId: school1.id, levelId: highLevels[2].id, name: "علوم رياضية", code: "SM" },
  })
  const streamBio = await prisma.stream.create({
    data: { schoolId: school1.id, levelId: highLevels[2].id, name: "علوم تجريبية", code: "SE" },
  })
  const streamArts = await prisma.stream.create({
    data: { schoolId: school1.id, levelId: highLevels[2].id, name: "آداب وعلوم إنسانية", code: "L" },
  })

  // --- Academic Year ---
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school1.id,
      name: "2026/2027",
      startsAt: new Date("2026-10-01"),
      endsAt: new Date("2027-06-30"),
      isActive: true,
    },
  })

  // --- Terms ---
  const term1 = await prisma.term.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear.id,
      name: "الفصل الأول",
      startsAt: new Date("2026-10-01"),
      endsAt: new Date("2026-12-31"),
      order: 1,
      isActive: true,
    },
  })
  await prisma.term.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear.id,
      name: "الفصل الثاني",
      startsAt: new Date("2027-01-05"),
      endsAt: new Date("2027-03-31"),
      order: 2,
    },
  })
  await prisma.term.create({
    data: {
      schoolId: school1.id,
      academicYearId: academicYear.id,
      name: "الفصل الثالث",
      startsAt: new Date("2027-04-01"),
      endsAt: new Date("2027-06-30"),
      order: 3,
    },
  })

  // --- Subjects ---
  const subjects = await Promise.all([
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "الرياضيات", nameFr: "Mathématiques", code: "MATH" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "اللغة العربية", nameFr: "Arabe", code: "ARAB" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "اللغة الفرنسية", nameFr: "Français", code: "FREN" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "الفيزياء", nameFr: "Physique", code: "PHYS" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "العلوم الطبيعية", nameFr: "SVT", code: "SVT" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "التربية الإسلامية", nameFr: "Éducation Islamique", code: "ISLA" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "التاريخ والجغرافيا", nameFr: "Histoire-Géo", code: "HG" } }),
    prisma.subject.create({ data: { schoolId: school1.id, nameAr: "الفلسفة", nameFr: "Philosophie", code: "PHIL" } }),
  ])

  // --- Subject Coefficients for 3AS ---
  // علوم رياضية
  const coefMap = {
    SM: { MATH: 7, PHYS: 6, ARAB: 2, FREN: 2, SVT: 3, ISLA: 1, HG: 1, PHIL: 1 },
    SE: { MATH: 5, PHYS: 5, ARAB: 3, FREN: 3, SVT: 7, ISLA: 1, HG: 1, PHIL: 1 },
    L:  { MATH: 2, PHYS: 2, ARAB: 6, FREN: 5, SVT: 2, ISLA: 2, HG: 3, PHIL: 4 },
  }
  for (const [streamCode, coefs] of Object.entries(coefMap)) {
    const stream = streamCode === "SM" ? streamMath : streamCode === "SE" ? streamBio : streamArts
    for (const subject of subjects) {
      const coef = coefs[subject.code]
      if (coef) {
        await prisma.subjectCoefficient.create({
          data: {
            schoolId: school1.id,
            academicYearId: academicYear.id,
            levelId: highLevels[2].id,
            streamId: stream.id,
            subjectId: subject.id,
            coefficient: coef,
          },
        })
      }
    }
  }

  // --- Classrooms ---
  // 3AS1 (علوم رياضية), 3AS2 (علوم تجريبية), 3AS3 (آداب)
  const classroom3AS1 = await prisma.classroom.create({
    data: { schoolId: school1.id, levelId: highLevels[2].id, streamId: streamMath.id, name: "3AS1", capacity: 40 },
  })
  const classroom3AS2 = await prisma.classroom.create({
    data: { schoolId: school1.id, levelId: highLevels[2].id, streamId: streamBio.id, name: "3AS2", capacity: 35 },
  })
  const classroom3AS3 = await prisma.classroom.create({
    data: { schoolId: school1.id, levelId: highLevels[2].id, streamId: streamArts.id, name: "3AS3", capacity: 30 },
  })
  // 1AS1 (مشترك)
  const classroom1AS1 = await prisma.classroom.create({
    data: { schoolId: school1.id, levelId: highLevels[0].id, name: "1AS1", capacity: 45 },
  })
  // إعدادي
  const classroom8eme = await prisma.classroom.create({
    data: { schoolId: school1.id, levelId: middleLevels[1].id, name: "8ème A", capacity: 40 },
  })

  // ============================================================
  // USERS
  // ============================================================
  const admin = await prisma.user.create({
    data: { email: "admin@alnoor.edu", passwordHash, name: "أحمد محمد (مدير)", role: "SCHOOL_ADMIN", schoolId: school1.id },
  })
  const teacherUser = await prisma.user.create({
    data: { email: "teacher@alnoor.edu", passwordHash, name: "خالد ولد أحمد (أستاذ)", role: "TEACHER", schoolId: school1.id },
  })
  const accountant = await prisma.user.create({
    data: { email: "accountant@alnoor.edu", passwordHash, name: "محمد عبد الله (محاسب)", role: "ACCOUNTANT", schoolId: school1.id },
  })
  const supervisor = await prisma.user.create({
    data: { email: "supervisor@alnoor.edu", passwordHash, name: "سعيد المختار (مدير دروس)", role: "SUPERVISOR", schoolId: school1.id },
  })
  const parentUser = await prisma.user.create({
    data: { email: "parent@alnoor.edu", passwordHash, name: "عبد الرحمن (ولي أمر)", role: "PARENT", schoolId: school1.id },
  })

  // --- Teacher ---
  const teacher = await prisma.teacher.create({
    data: { userId: teacherUser.id, schoolId: school1.id, phone: "+222 11223344", status: "ACTIVE" },
  })

  // --- Parent ---
  const parent = await prisma.parent.create({
    data: { userId: parentUser.id, schoolId: school1.id, phone: "+222 55667788", preferredLanguage: "ar" },
  })

  // --- Teacher Assignments (teacher teaches Math in 3AS1, 3AS2, 1AS1) ---
  const mathSubject = subjects.find((s) => s.code === "MATH")
  for (const classroom of [classroom3AS1, classroom3AS2, classroom1AS1]) {
    await prisma.teacherAssignment.create({
      data: {
        schoolId: school1.id,
        teacherId: teacher.id,
        subjectId: mathSubject.id,
        classroomId: classroom.id,
        academicYearId: academicYear.id,
        isActive: true,
      },
    })
  }

  // --- Students + Enrollments ---
  const studentNames = [
    "أحمد ولد محمد", "فاطمة بنت أحمد", "محمد الأمين", "عائشة بنت عمر",
    "عبد الله ولد سيدي", "مريم بنت عبد الله", "إبراهيم ولد الشيخ", "حواء بنت محمد",
    "موسى ولد الحسن", "خديجة بنت أحمد", "يحيى ولد محمد", "آمنة بنت عبد الرحمن",
    "إسماعيل ولد عمر", "سكينة بنت محمد", "علي ولد الحسين",
  ]

  const students = []
  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i]
    const [firstName, ...lastNameParts] = name.split(" ")
    const lastName = lastNameParts.join(" ")

    const student = await prisma.student.create({
      data: {
        firstName, lastName, schoolId: school1.id,
        gender: i % 2 === 0 ? "M" : "F",
        studentNumber: `AL-${String(i + 1).padStart(4, "0")}`,
      },
    })
    students.push(student)

    // Enroll in classroom (first 5 in 3AS1, next 5 in 3AS2, rest in 1AS1)
    const classroom = i < 5 ? classroom3AS1 : i < 10 ? classroom3AS2 : classroom1AS1
    await prisma.enrollment.create({
      data: {
        schoolId: school1.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        classroomId: classroom.id,
        status: "ACTIVE",
      },
    })
  }

  // --- Link first student to parent ---
  if (students.length > 0) {
    await prisma.studentParent.create({
      data: {
        schoolId: school1.id,
        studentId: students[0].id,
        parentId: parent.id,
        relationship: "الأب",
        isPrimary: true,
        receiveNotifications: true,
      },
    })
  }

  // ============================================================
  // SCHOOL 2: مدرسة الفتح (إعدادي فقط — لاختبار العزل)
  // ============================================================
  const school2 = await prisma.school.create({
    data: {
      name: "مدرسة الفتح",
      slug: "al-fath",
      address: "نواذيبو، موريتانيا",
      phone: "+222 87654321",
      email: "info@alfath.edu",
    },
  })

  const stage2 = await prisma.educationStage.create({
    data: { schoolId: school2.id, name: "الإعدادية", order: 1 },
  })
  const level2 = await prisma.level.create({
    data: { schoolId: school2.id, stageId: stage2.id, name: "السنة 1 إعدادي", order: 1 },
  })
  const year2 = await prisma.academicYear.create({
    data: { schoolId: school2.id, name: "2026/2027", startsAt: new Date("2026-10-01"), endsAt: new Date("2027-06-30"), isActive: true },
  })
  const classroom2 = await prisma.classroom.create({
    data: { schoolId: school2.id, levelId: level2.id, name: "1AC1", capacity: 30 },
  })

  const admin2 = await prisma.user.create({
    data: { email: "admin@alfath.edu", passwordHash, name: "عمر سعيد (مدير)", role: "SCHOOL_ADMIN", schoolId: school2.id },
  })
  const teacherUser2 = await prisma.user.create({
    data: { email: "teacher@alfath.edu", passwordHash, name: "فاطمة بنت محمد (أستاذة)", role: "TEACHER", schoolId: school2.id },
  })
  const teacher2 = await prisma.teacher.create({
    data: { userId: teacherUser2.id, schoolId: school2.id, status: "ACTIVE" },
  })

  const subject2 = await prisma.subject.create({
    data: { schoolId: school2.id, nameAr: "اللغة العربية", nameFr: "Arabe", code: "ARAB" },
  })
  await prisma.teacherAssignment.create({
    data: { schoolId: school2.id, teacherId: teacher2.id, subjectId: subject2.id, classroomId: classroom2.id, academicYearId: year2.id, isActive: true },
  })

  // Students in school 2
  for (const name of ["محمود ولد أحمد", "سارة بنت عمر", "يوسف ولد محمد"]) {
    const [firstName, ...lastNameParts] = name.split(" ")
    const lastName = lastNameParts.join(" ")
    const s = await prisma.student.create({
      data: { firstName, lastName, schoolId: school2.id },
    })
    await prisma.enrollment.create({
      data: { schoolId: school2.id, studentId: s.id, academicYearId: year2.id, classroomId: classroom2.id, status: "ACTIVE" },
    })
  }

  // ============================================================
  // SUPER_ADMIN
  // ============================================================
  await prisma.user.create({
    data: { email: "superadmin@classflow.com", passwordHash, name: "مدير المنصة", role: "SUPER_ADMIN" },
  })

  console.log("✅ Database seeded successfully")
  console.log("\n🔑 All passwords: password123\n")
  console.log("📧 مدرسة النور (al-noor):")
  console.log("   admin@alnoor.edu      → SCHOOL_ADMIN")
  console.log("   teacher@alnoor.edu    → TEACHER (Math in 3AS1, 3AS2, 1AS1)")
  console.log("   accountant@alnoor.edu → ACCOUNTANT")
  console.log("   supervisor@alnoor.edu → SUPERVISOR (مدير دروس)")
  console.log("   parent@alnoor.edu     → PARENT")
  console.log("\n📧 مدرسة الفتح (al-fath):")
  console.log("   admin@alfath.edu      → SCHOOL_ADMIN")
  console.log("   teacher@alfath.edu    → TEACHER")
  console.log("\n📧 المنصة:")
  console.log("   superadmin@classflow.com → SUPER_ADMIN")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
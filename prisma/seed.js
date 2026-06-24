const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10)

  // ============================================================
  // SCHOOL 1: مدرسة النور (إعدادي + ثانوي)
  // ============================================================
  const school1 = await prisma.school.create({
    data: {
      name: "مدرسة النور",
      slug: "al-noor",
      address: "نواكشوط، موريتانيا",
      phone: "+222 12345678",
      email: "info@alnoor.edu",
      subscriptionStatus: "TRIAL",
      billingStudentCount: 200,
    },
  })

  // --- Education Stages ---
  const middle = await prisma.educationStage.create({
    data: { schoolId: school1.id, name: "الإعدادية", order: 1 },
  })
  const high = await prisma.educationStage.create({
    data: { schoolId: school1.id, name: "الثانوية", order: 2 },
  })

  // --- Levels ---
  const midLevelDefs = [
    { name: "1AS", order: 1 },
    { name: "2AS", order: 2 },
    { name: "3AS", order: 3 },
    { name: "4AS", order: 4 },
  ]
  const highLevelDefs = [
    { name: "5", order: 5 },
    { name: "6", order: 6 },
    { name: "7", order: 7 },
  ]

  const midLevels = []
  for (const lv of midLevelDefs) {
    midLevels.push(await prisma.level.create({
      data: { schoolId: school1.id, stageId: middle.id, name: lv.name, order: lv.order },
    }))
  }
  const highLevels = []
  for (const lv of highLevelDefs) {
    highLevels.push(await prisma.level.create({
      data: { schoolId: school1.id, stageId: high.id, name: lv.name, order: lv.order },
    }))
  }

  const levelMap = {}
  for (const l of [...midLevels, ...highLevels]) levelMap[l.name] = l

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
  await prisma.term.create({
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

  // --- Classrooms ---
  const classroomDefs = [
    ["1AS1", "1AS"], ["1AS2", "1AS"],
    ["2AS1", "2AS"], ["2AS2", "2AS"],
    ["3AS1", "3AS"], ["3AS2", "3AS"],
    ["4AS1", "4AS"], ["4AS2", "4AS"], ["4AS3", "4AS"],
    ["5A", "5"], ["5C", "5"], ["5D", "5"],
    ["6C1", "6"], ["6C2", "6"], ["6A", "6"], ["6D1", "6"], ["6D2", "6"],
    ["7C", "7"], ["7D1", "7"], ["7D2", "7"],
  ]

  const classrooms = []
  for (const [name, levelName] of classroomDefs) {
    classrooms.push(await prisma.classroom.create({
      data: { schoolId: school1.id, levelId: levelMap[levelName].id, name, capacity: 40 },
    }))
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================
  const allPermissions = [
    { code: "MANAGE_USERS", name: "إدارة المستخدمين", category: "USERS" },
    { code: "MANAGE_STUDENTS", name: "إدارة الطلاب", category: "STUDENTS" },
    { code: "MANAGE_TEACHERS", name: "إدارة الأساتذة", category: "TEACHERS" },
    { code: "MANAGE_SUBJECTS", name: "إدارة المواد", category: "TEACHERS" },
    { code: "MANAGE_COEFFICIENTS", name: "إدارة الضوارب", category: "TEACHERS" },
    { code: "MANAGE_ACADEMIC_YEARS", name: "إدارة السنوات والفصول", category: "ACADEMIC" },
    { code: "MANAGE_CLASSROOMS", name: "إدارة الأقسام", category: "ACADEMIC" },
    { code: "REVIEW_LESSONS", name: "مراجعة الدروس", category: "GRADES" },
    { code: "APPROVE_GRADES", name: "اعتماد النقاط", category: "GRADES" },
    { code: "LOCK_GRADES", name: "قفل النقاط", category: "GRADES" },
    { code: "MANAGE_FEES", name: "إدارة الرسوم", category: "FINANCE" },
    { code: "RECORD_PAYMENTS", name: "تسجيل الدفعات", category: "FINANCE" },
    { code: "VIEW_FINANCE_REPORTS", name: "عرض التقارير المالية", category: "FINANCE" },
    { code: "VIEW_REPORTS", name: "عرض التقارير", category: "REPORTS" },
    { code: "SEND_NOTIFICATIONS", name: "إرسال الإشعارات", category: "NOTIFICATIONS" },
  ]

  const createdPermissions = {}
  for (const p of allPermissions) {
    const perm = await prisma.permission.create({
      data: { code: p.code, name: p.name, description: p.name, category: p.category },
    })
    createdPermissions[p.code] = perm
  }

  async function grantPermissions(userId, permissionCodes) {
    for (const code of permissionCodes) {
      await prisma.userPermission.create({
        data: { userId, permissionId: createdPermissions[code].id },
      })
    }
  }

  // ============================================================
  // USERS
  // ============================================================
  const admin = await prisma.user.create({
    data: { email: "admin@alnoor.edu", passwordHash, name: "أحمد محمد (مدير)", role: "SCHOOL_ADMIN", schoolId: school1.id },
  })
  await grantPermissions(admin.id, allPermissions.map((p) => p.code))

  const teacherUser = await prisma.user.create({
    data: { email: "teacher@alnoor.edu", passwordHash, name: "خالد ولد أحمد (أستاذ)", role: "TEACHER", schoolId: school1.id },
  })

  const accountant = await prisma.user.create({
    data: { email: "accountant@alnoor.edu", passwordHash, name: "محمد عبد الله (محاسب)", role: "ACCOUNTANT", schoolId: school1.id },
  })
  await grantPermissions(accountant.id, ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"])

  const supervisor = await prisma.user.create({
    data: { email: "supervisor@alnoor.edu", passwordHash, name: "سعيد المختار (مدير دروس)", role: "SUPERVISOR", schoolId: school1.id },
  })
  await grantPermissions(supervisor.id, ["VIEW_REPORTS"])

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

  // --- Teacher Assignments ---
  const arabic = subjects.find((s) => s.code === "ARAB")
  const math = subjects.find((s) => s.code === "MATH")
  const french = subjects.find((s) => s.code === "FREN")

  if (arabic) {
    for (const c of classrooms.filter((c) => c.name.startsWith("1AS") || c.name.startsWith("2AS"))) {
      await prisma.teacherAssignment.create({
        data: { schoolId: school1.id, teacherId: teacher.id, subjectId: arabic.id, classroomId: c.id, academicYearId: academicYear.id, hourlyRate: 250, weeklyHours: 4, isActive: true },
      })
    }
  }
  if (math) {
    for (const c of classrooms.filter((c) => c.name.startsWith("3AS") || c.name.startsWith("4AS"))) {
      await prisma.teacherAssignment.create({
        data: { schoolId: school1.id, teacherId: teacher.id, subjectId: math.id, classroomId: c.id, academicYearId: academicYear.id, hourlyRate: 300, weeklyHours: 5, isActive: true },
      })
    }
  }
  if (french) {
    for (const c of classrooms.filter((c) => c.name.startsWith("5") || c.name.startsWith("6"))) {
      await prisma.teacherAssignment.create({
        data: { schoolId: school1.id, teacherId: teacher.id, subjectId: french.id, classroomId: c.id, academicYearId: academicYear.id, hourlyRate: 250, weeklyHours: 3, isActive: true },
      })
    }
  }

  // --- Students (10 per classroom) ---
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
  const createdStudents = []
  for (const c of classrooms) {
    for (let i = 0; i < 10; i++) {
      const firstName = firstNames[(totalStudents + i) % firstNames.length]
      const lastName = lastNames[(totalStudents + i) % lastNames.length]
      const gender = i % 2 === 0 ? "MALE" : "FEMALE"
      const studentNumber = `${c.name}-${String(i + 1).padStart(2, "0")}`

      const student = await prisma.student.create({
        data: { schoolId: school1.id, firstName, lastName, gender, studentNumber, isActive: true },
      })
      createdStudents.push(student)

      await prisma.enrollment.create({
        data: { schoolId: school1.id, studentId: student.id, academicYearId: academicYear.id, classroomId: c.id, status: "ACTIVE" },
      })
      totalStudents++
    }
  }

  // Link first student to parent
  if (createdStudents.length > 0) {
    await prisma.studentParent.create({
      data: {
        schoolId: school1.id,
        studentId: createdStudents[0].id,
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
    data: { schoolId: school2.id, stageId: stage2.id, name: "1AS", order: 1 },
  })
  const year2 = await prisma.academicYear.create({
    data: { schoolId: school2.id, name: "2026/2027", startsAt: new Date("2026-10-01"), endsAt: new Date("2027-06-30"), isActive: true },
  })
  const classroom2 = await prisma.classroom.create({
    data: { schoolId: school2.id, levelId: level2.id, name: "1AS1", capacity: 30 },
  })

  const admin2 = await prisma.user.create({
    data: { email: "admin@alfath.edu", passwordHash, name: "عمر سعيد (مدير)", role: "SCHOOL_ADMIN", schoolId: school2.id },
  })
  await grantPermissions(admin2.id, allPermissions.map((p) => p.code))
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
    data: { schoolId: school2.id, teacherId: teacher2.id, subjectId: subject2.id, classroomId: classroom2.id, academicYearId: year2.id, hourlyRate: 250, weeklyHours: 4, isActive: true },
  })

  // Students in school 2
  for (const name of ["محمود ولد أحمد", "سارة بنت عمر", "يوسف ولد محمد"]) {
    const [firstName, ...lastNameParts] = name.split(" ")
    const s = await prisma.student.create({
      data: { firstName, lastName: lastNameParts.join(" "), schoolId: school2.id },
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

  const studiesStaff = await prisma.user.create({
    data: { email: "studies@alnoor.edu", passwordHash, name: "د. يوسف ولد الشيخ (مدير الدراسات)", role: "STAFF", schoolId: school1.id },
  })
  await grantPermissions(studiesStaff.id, ["MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS", "REVIEW_LESSONS", "APPROVE_GRADES"])

  console.log("✅ Database seeded successfully")
  console.log("\n🔑 All passwords: password123\n")

  console.log("📧 مدرسة النور (al-noor) — 20 أقسام، 200 تلميذ:")
  console.log("   admin@alnoor.edu      → SCHOOL_ADMIN")
  console.log("   teacher@alnoor.edu    → TEACHER")
  console.log("   accountant@alnoor.edu → ACCOUNTANT")
  console.log("   supervisor@alnoor.edu → SUPERVISOR")
  console.log("   studies@alnoor.edu    → STAFF")
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

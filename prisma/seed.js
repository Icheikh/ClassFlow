const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function clearDatabase() {
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.studentFee.deleteMany()
  await prisma.fee.deleteMany()

  await prisma.assessmentScore.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.resultPublication.deleteMany()
  await prisma.grade.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.lesson.deleteMany()
  await prisma.teacherAttendance.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.schedule.deleteMany()

  await prisma.teacherAssignment.deleteMany()
  await prisma.subjectCoefficient.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.studentParent.deleteMany()

  await prisma.teacher.deleteMany()
  await prisma.parent.deleteMany()
  await prisma.student.deleteMany()

  await prisma.term.deleteMany()
  await prisma.academicYear.deleteMany()

  await prisma.classroom.deleteMany()
  await prisma.stream.deleteMany()
  await prisma.level.deleteMany()
  await prisma.educationStage.deleteMany()
  await prisma.subject.deleteMany()

  await prisma.userPermission.deleteMany()
  await prisma.user.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.school.deleteMany()
}

async function createPermissions() {
  const definitions = [
    ["MANAGE_USERS", "إدارة المستخدمين", "USERS"],
    ["MANAGE_STUDENTS", "إدارة الطلاب", "STUDENTS"],
    ["MANAGE_TEACHERS", "إدارة الأساتذة", "TEACHERS"],
    ["MANAGE_SUBJECTS", "إدارة المواد", "TEACHERS"],
    ["MANAGE_COEFFICIENTS", "إدارة الضوارب", "TEACHERS"],
    ["MANAGE_ACADEMIC_YEARS", "إدارة السنوات والفصول", "ACADEMIC"],
    ["MANAGE_CLASSROOMS", "إدارة الأقسام", "ACADEMIC"],
    ["REVIEW_LESSONS", "مراجعة الدروس", "GRADES"],
    ["APPROVE_GRADES", "اعتماد النقاط", "GRADES"],
    ["LOCK_GRADES", "قفل النقاط", "GRADES"],
    ["MANAGE_FEES", "إدارة الرسوم", "FINANCE"],
    ["RECORD_PAYMENTS", "تسجيل الدفعات", "FINANCE"],
    ["VIEW_FINANCE_REPORTS", "عرض التقارير المالية", "FINANCE"],
    ["VIEW_REPORTS", "عرض التقارير", "REPORTS"],
    ["SEND_NOTIFICATIONS", "إرسال الإشعارات", "NOTIFICATIONS"],
  ]

  const permissionMap = {}
  for (const [code, name, category] of definitions) {
    const permission = await prisma.permission.create({
      data: { code, name, description: name, category },
    })
    permissionMap[code] = permission
  }

  return permissionMap
}

async function grantPermissions(userId, grantedBy, permissionMap, codes) {
  for (const code of codes) {
    await prisma.userPermission.create({
      data: {
        userId,
        permissionId: permissionMap[code].id,
        grantedBy: grantedBy || null,
      },
    })
  }
}

async function createSchoolStructure(schoolId) {
  const middleStage = await prisma.educationStage.create({
    data: { schoolId, name: "الإعدادية", order: 1 },
  })
  const secondaryStage = await prisma.educationStage.create({
    data: { schoolId, name: "الثانوية", order: 2 },
  })

  const levelDefs = [
    { name: "1AS", order: 1, stageId: middleStage.id },
    { name: "2AS", order: 2, stageId: middleStage.id },
    { name: "3AS", order: 3, stageId: middleStage.id },
    { name: "4AS", order: 4, stageId: middleStage.id },
    { name: "5", order: 5, stageId: secondaryStage.id },
    { name: "6", order: 6, stageId: secondaryStage.id },
    { name: "7", order: 7, stageId: secondaryStage.id },
  ]

  const levelMap = {}
  for (const def of levelDefs) {
    levelMap[def.name] = await prisma.level.create({
      data: {
        schoolId,
        stageId: def.stageId,
        name: def.name,
        order: def.order,
      },
    })
  }

  const streamDefs = [
    { levelName: "5", name: "آداب", code: "A" },
    { levelName: "5", name: "رياضيات", code: "C" },
    { levelName: "5", name: "علوم", code: "D" },
    { levelName: "6", name: "آداب", code: "A" },
    { levelName: "6", name: "رياضيات", code: "C" },
    { levelName: "6", name: "علوم", code: "D" },
    { levelName: "7", name: "آداب", code: "A" },
    { levelName: "7", name: "رياضيات", code: "C" },
    { levelName: "7", name: "علوم", code: "D" },
  ]

  const streamMap = {}
  for (const def of streamDefs) {
    const key = `${def.levelName}-${def.code}`
    streamMap[key] = await prisma.stream.create({
      data: {
        schoolId,
        levelId: levelMap[def.levelName].id,
        name: def.name,
        code: def.code,
      },
    })
  }

  const classroomDefs = [
    { name: "1AS1", levelName: "1AS" },
    { name: "1AS2", levelName: "1AS" },
    { name: "1AS3", levelName: "1AS" },
    { name: "2AS1", levelName: "2AS" },
    { name: "2AS2", levelName: "2AS" },
    { name: "3AS1", levelName: "3AS" },
    { name: "4AS1", levelName: "4AS" },
    { name: "5A", levelName: "5", streamCode: "A" },
    { name: "5C", levelName: "5", streamCode: "C" },
    { name: "5D1", levelName: "5", streamCode: "D" },
    { name: "5D2", levelName: "5", streamCode: "D" },
    { name: "6A", levelName: "6", streamCode: "A" },
    { name: "6C", levelName: "6", streamCode: "C" },
    { name: "6D1", levelName: "6", streamCode: "D" },
    { name: "7A", levelName: "7", streamCode: "A" },
    { name: "7C1", levelName: "7", streamCode: "C" },
    { name: "7C2", levelName: "7", streamCode: "C" },
    { name: "7D1", levelName: "7", streamCode: "D" },
  ]

  const classroomMap = {}
  for (const def of classroomDefs) {
    const stream = def.streamCode ? streamMap[`${def.levelName}-${def.streamCode}`] : null
    classroomMap[def.name] = await prisma.classroom.create({
      data: {
        schoolId,
        levelId: levelMap[def.levelName].id,
        streamId: stream?.id || null,
        name: def.name,
        capacity: 40,
      },
    })
  }

  return { middleStage, secondaryStage, levelMap, streamMap, classroomMap }
}

async function createSubjects(schoolId) {
  const defs = [
    ["اللغة العربية", "Arabe", "ARAB"],
    ["اللغة الفرنسية", "Français", "FREN"],
    ["الرياضيات", "Mathématiques", "MATH"],
    ["الفيزياء", "Physique", "PHYS"],
    ["العلوم الطبيعية", "SVT", "SVT"],
    ["التاريخ والجغرافيا", "Histoire-Géo", "HG"],
    ["التربية الإسلامية", "Éducation Islamique", "ISLA"],
    ["الفلسفة", "Philosophie", "PHIL"],
  ]

  const subjectMap = {}
  for (const [nameAr, nameFr, code] of defs) {
    subjectMap[code] = await prisma.subject.create({
      data: { schoolId, nameAr, nameFr, code },
    })
  }

  return subjectMap
}

async function createAcademicYear(schoolId) {
  const year = await prisma.academicYear.create({
    data: {
      schoolId,
      name: "2026/2027",
      startsAt: new Date("2026-10-01"),
      endsAt: new Date("2027-06-30"),
      isActive: true,
    },
  })

  const term1 = await prisma.term.create({
    data: {
      schoolId,
      academicYearId: year.id,
      name: "الفصل الأول",
      startsAt: new Date("2026-10-01"),
      endsAt: new Date("2026-12-31"),
      order: 1,
      isActive: true,
    },
  })
  const term2 = await prisma.term.create({
    data: {
      schoolId,
      academicYearId: year.id,
      name: "الفصل الثاني",
      startsAt: new Date("2027-01-05"),
      endsAt: new Date("2027-03-31"),
      order: 2,
    },
  })
  const term3 = await prisma.term.create({
    data: {
      schoolId,
      academicYearId: year.id,
      name: "الفصل الثالث",
      startsAt: new Date("2027-04-01"),
      endsAt: new Date("2027-06-30"),
      order: 3,
    },
  })

  return { year, term1, term2, term3 }
}

async function seedWeights(schoolId, academicYearId, levelMap, streamMap, classroomMap, subjectMap) {
  const middleWeights = {
    ARAB: 4,
    FREN: 3,
    MATH: 5,
    PHYS: 2,
    SVT: 3,
    HG: 2,
    ISLA: 2,
  }

  for (const levelName of ["1AS", "2AS", "3AS", "4AS"]) {
    for (const [code, coefficient] of Object.entries(middleWeights)) {
      await prisma.subjectCoefficient.create({
        data: {
          schoolId,
          academicYearId,
          levelId: levelMap[levelName].id,
          subjectId: subjectMap[code].id,
          coefficient,
        },
      })
    }
  }

  const streamWeights = {
    A: { ARAB: 5, FREN: 4, MATH: 2, PHYS: 2, SVT: 2, HG: 4, ISLA: 2, PHIL: 4 },
    C: { ARAB: 3, FREN: 2, MATH: 9, PHYS: 7, SVT: 4, HG: 2, ISLA: 2, PHIL: 2 },
    D: { ARAB: 3, FREN: 2, MATH: 6, PHYS: 6, SVT: 7, HG: 2, ISLA: 2, PHIL: 2 },
  }

  for (const levelName of ["5", "6", "7"]) {
    for (const streamCode of ["A", "C", "D"]) {
      for (const [code, coefficient] of Object.entries(streamWeights[streamCode])) {
        await prisma.subjectCoefficient.create({
          data: {
            schoolId,
            academicYearId,
            levelId: levelMap[levelName].id,
            streamId: streamMap[`${levelName}-${streamCode}`].id,
            subjectId: subjectMap[code].id,
            coefficient,
          },
        })
      }
    }
  }

  await prisma.subjectCoefficient.create({
    data: {
      schoolId,
      academicYearId,
      levelId: levelMap["5"].id,
      streamId: streamMap["5-D"].id,
      classroomId: classroomMap["5D2"].id,
      subjectId: subjectMap.FREN.id,
      coefficient: 3,
    },
  })
}

async function createUsersAndTeachers(schoolId, permissionMap) {
  const passwordHash = await bcrypt.hash("password123", 10)

  const admin = await prisma.user.create({
    data: {
      email: "admin@alnoor.edu",
      passwordHash,
      name: "أحمد محمد (مدير المدرسة)",
      role: "SCHOOL_ADMIN",
      schoolId,
    },
  })
  await grantPermissions(admin.id, admin.id, permissionMap, Object.keys(permissionMap))

  const staff = await prisma.user.create({
    data: {
      email: "studies@alnoor.edu",
      passwordHash,
      name: "مدير الدروس",
      role: "STAFF",
      schoolId,
    },
  })
  await grantPermissions(staff.id, admin.id, permissionMap, [
    "MANAGE_SUBJECTS",
    "MANAGE_COEFFICIENTS",
    "MANAGE_CLASSROOMS",
    "REVIEW_LESSONS",
    "APPROVE_GRADES",
    "VIEW_REPORTS",
  ])

  const accountant = await prisma.user.create({
    data: {
      email: "accountant@alnoor.edu",
      passwordHash,
      name: "محمد عبد الله (محاسب)",
      role: "ACCOUNTANT",
      schoolId,
    },
  })
  await grantPermissions(accountant.id, admin.id, permissionMap, [
    "MANAGE_FEES",
    "RECORD_PAYMENTS",
    "VIEW_FINANCE_REPORTS",
  ])

  const supervisor = await prisma.user.create({
    data: {
      email: "supervisor@alnoor.edu",
      passwordHash,
      name: "سعيد المختار (مشرف)",
      role: "SUPERVISOR",
      schoolId,
    },
  })
  await grantPermissions(supervisor.id, admin.id, permissionMap, ["VIEW_REPORTS"])

  const teacherUsers = [
    ["teacher.math@alnoor.edu", "عبد القادر (رياضيات)"],
    ["teacher.arabic@alnoor.edu", "مريم (عربية)"],
    ["teacher.science@alnoor.edu", "سالم (علوم)"],
    ["teacher.french@alnoor.edu", "فاطمة (فرنسية)"],
  ]

  const teachers = []
  for (const [email, name] of teacherUsers) {
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: "TEACHER", schoolId },
    })
    const teacher = await prisma.teacher.create({
      data: { userId: user.id, schoolId, status: "ACTIVE" },
    })
    teachers.push(teacher)
  }

  const parentUser = await prisma.user.create({
    data: {
      email: "parent@alnoor.edu",
      passwordHash,
      name: "ولي أمر تجريبي",
      role: "PARENT",
      schoolId,
    },
  })
  const parent = await prisma.parent.create({
    data: { userId: parentUser.id, schoolId, preferredLanguage: "ar" },
  })

  return { admin, staff, accountant, supervisor, teachers, parent, passwordHash }
}

async function seedStudentsAndLinks(schoolId, academicYearId, classroomMap, parentId) {
  const firstNames = ["أحمد", "محمد", "مريم", "سارة", "خديجة", "يوسف", "إبراهيم", "فاطمة", "عبد الله", "آمنة"]
  const lastNames = ["ولد محمد", "بنت أحمد", "ولد المختار", "بنت سيدي", "ولد الشيخ", "بنت عبد الله"]
  const classroomNames = Object.keys(classroomMap)

  const createdStudents = []
  let counter = 1
  for (const classroomName of classroomNames) {
    for (let i = 0; i < 5; i++) {
      const student = await prisma.student.create({
        data: {
          schoolId,
          firstName: firstNames[(counter + i) % firstNames.length],
          lastName: lastNames[(counter + i) % lastNames.length],
          gender: i % 2 === 0 ? "MALE" : "FEMALE",
          studentNumber: `${classroomName}-${String(i + 1).padStart(2, "0")}`,
          isActive: true,
        },
      })

      await prisma.enrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicYearId,
          classroomId: classroomMap[classroomName].id,
          status: "ACTIVE",
        },
      })

      if (counter <= 10) {
        await prisma.studentParent.create({
          data: {
            schoolId,
            studentId: student.id,
            parentId,
            relationship: "ولي أمر",
            isPrimary: true,
            receiveNotifications: true,
          },
        })
      }

      createdStudents.push({ ...student, classroomName })
      counter++
    }
  }

  return createdStudents
}

async function seedTeacherAssignments(schoolId, academicYearId, teachers, classroomMap, subjectMap) {
  const [mathTeacher, arabicTeacher, scienceTeacher, frenchTeacher] = teachers

  const subjectAssignments = [
    { teacherId: mathTeacher.id, subjectId: subjectMap.MATH.id, classrooms: ["1AS1", "1AS2", "2AS1", "5C", "5D1", "5D2", "7C1", "7C2"] },
    { teacherId: arabicTeacher.id, subjectId: subjectMap.ARAB.id, classrooms: ["1AS1", "1AS2", "1AS3", "2AS1", "2AS2", "5A", "5C", "5D1"] },
    { teacherId: scienceTeacher.id, subjectId: subjectMap.PHYS.id, classrooms: ["5C", "5D1", "5D2", "6C", "6D1", "7C1", "7C2", "7D1"] },
    { teacherId: scienceTeacher.id, subjectId: subjectMap.SVT.id, classrooms: ["1AS1", "2AS2", "5D1", "5D2", "6D1", "7D1"] },
    { teacherId: frenchTeacher.id, subjectId: subjectMap.FREN.id, classrooms: ["1AS1", "1AS2", "2AS1", "2AS2", "5A", "5D1", "5D2", "7A"] },
  ]

  for (const assignment of subjectAssignments) {
    for (const classroomName of assignment.classrooms) {
      await prisma.teacherAssignment.create({
        data: {
          schoolId,
          teacherId: assignment.teacherId,
          subjectId: assignment.subjectId,
          classroomId: classroomMap[classroomName].id,
          academicYearId,
          hourlyRate: 250,
          weeklyHours: 4,
          isActive: true,
        },
      })
    }
  }
}

async function seedSampleLessonsAndAssessments(schoolId, academicYearId, termId, students, classroomMap, subjectMap, teachers) {
  const [mathTeacher, arabicTeacher, scienceTeacher] = teachers
  const targetClassroom = classroomMap["5D1"]
  const targetStudents = students.filter((student) => student.classroomName === "5D1")

  for (let i = 0; i < 3; i++) {
    await prisma.lesson.create({
      data: {
        schoolId,
        academicYearId,
        termId,
        title: `درس رياضيات ${i + 1}`,
        description: `حصة تدريبية للقسم 5D1`,
        duration: 55,
        classroomId: targetClassroom.id,
        subjectId: subjectMap.MATH.id,
        teacherId: mathTeacher.id,
        status: "DRAFT",
        date: new Date(`2026-10-${10 + i}`),
      },
    })
  }

  await prisma.assessment.create({
    data: {
      schoolId,
      academicYearId,
      termId,
      classroomId: targetClassroom.id,
      subjectId: subjectMap.MATH.id,
      teacherId: mathTeacher.id,
      type: "TEST",
      title: "الفرض الأول",
      maxScore: 20,
      status: "DRAFT",
      date: new Date("2026-10-20"),
      scores: {
        create: targetStudents.map((student) => ({
          schoolId,
          studentId: student.id,
          score: 8 + (student.firstName.length % 8),
          status: "DRAFT",
        })),
      },
    },
  })

  await prisma.assessment.create({
    data: {
      schoolId,
      academicYearId,
      termId,
      classroomId: targetClassroom.id,
      subjectId: subjectMap.MATH.id,
      teacherId: mathTeacher.id,
      type: "EXAM_1",
      title: "الامتحان الأول",
      maxScore: 20,
      status: "DRAFT",
      date: new Date("2026-11-05"),
      scores: {
        create: targetStudents.map((student) => ({
          schoolId,
          studentId: student.id,
          score: 9 + (student.lastName.length % 7),
          status: "DRAFT",
        })),
      },
    },
  })

  await prisma.assessment.create({
    data: {
      schoolId,
      academicYearId,
      termId,
      classroomId: targetClassroom.id,
      subjectId: subjectMap.MATH.id,
      teacherId: mathTeacher.id,
      type: "EXAM_2",
      title: "الامتحان الثاني",
      maxScore: 20,
      status: "DRAFT",
      date: new Date("2026-11-20"),
      scores: {
        create: targetStudents.map((student) => ({
          schoolId,
          studentId: student.id,
          score: 10 + (student.firstName.length % 6),
          status: "DRAFT",
        })),
      },
    },
  })

  await prisma.assessment.create({
    data: {
      schoolId,
      academicYearId,
      termId,
      classroomId: targetClassroom.id,
      subjectId: subjectMap.MATH.id,
      teacherId: mathTeacher.id,
      type: "EXAM_3",
      title: "الامتحان الثالث",
      maxScore: 20,
      status: "DRAFT",
      date: new Date("2026-12-05"),
      scores: {
        create: targetStudents.map((student) => ({
          schoolId,
          studentId: student.id,
          score: 11 + (student.lastName.length % 5),
          status: "DRAFT",
        })),
      },
    },
  })

  const targetClassroom2 = classroomMap["2AS2"]
  const targetStudents2 = students.filter((student) => student.classroomName === "2AS2")
  await prisma.assessment.create({
    data: {
      schoolId,
      academicYearId,
      termId,
      classroomId: targetClassroom2.id,
      subjectId: subjectMap.ARAB.id,
      teacherId: arabicTeacher.id,
      type: "TEST",
      title: "فرض العربية الأول",
      maxScore: 20,
      status: "DRAFT",
      date: new Date("2026-10-18"),
      scores: {
        create: targetStudents2.map((student) => ({
          schoolId,
          studentId: student.id,
          score: 10 + (student.firstName.length % 6),
          status: "DRAFT",
        })),
      },
    },
  })

  await prisma.teacherAttendance.create({
    data: {
      schoolId,
      teacherId: mathTeacher.id,
      userId: mathTeacher.userId,
      date: new Date("2026-10-20"),
      status: "PRESENT",
      checkIn: new Date("2026-10-20T08:00:00"),
    },
  })

  await prisma.teacherAttendance.create({
    data: {
      schoolId,
      teacherId: scienceTeacher.id,
      userId: scienceTeacher.userId,
      date: new Date("2026-10-20"),
      status: "PRESENT",
      checkIn: new Date("2026-10-20T08:10:00"),
    },
  })
}

async function createSecondSchool(permissionMap) {
  const passwordHash = await bcrypt.hash("password123", 10)

  const school = await prisma.school.create({
    data: {
      name: "مدرسة الفتح",
      slug: "alfath",
      address: "نواكشوط",
      phone: "+22200000002",
      email: "info@alfath.edu",
      resultReportTitle: "كشف نتائج الفصل",
      resultReportSubtitle: "نموذج النتائج الرسمي للمؤسسة",
      resultReportFooterNote: "يعتمد هذا الكشف بعد توقيع الإدارة.",
      subscriptionStatus: "TRIAL",
      billingStudentCount: 12,
    },
  })

  const { levelMap, streamMap, classroomMap } = await createSchoolStructure(school.id)
  const subjectMap = await createSubjects(school.id)
  const { year } = await createAcademicYear(school.id)
  await seedWeights(school.id, year.id, levelMap, streamMap, classroomMap, subjectMap)

  const admin = await prisma.user.create({
    data: {
      email: "admin@alfath.edu",
      passwordHash,
      name: "عمر سعيد (مدير)",
      role: "SCHOOL_ADMIN",
      schoolId: school.id,
    },
  })
  await grantPermissions(admin.id, admin.id, permissionMap, Object.keys(permissionMap))

  const teacherUser = await prisma.user.create({
    data: {
      email: "teacher@alfath.edu",
      passwordHash,
      name: "فاطمة بنت محمد (أستاذة)",
      role: "TEACHER",
      schoolId: school.id,
    },
  })
  const teacher = await prisma.teacher.create({
    data: { userId: teacherUser.id, schoolId: school.id, status: "ACTIVE" },
  })

  await prisma.teacherAssignment.create({
    data: {
      schoolId: school.id,
      teacherId: teacher.id,
      subjectId: subjectMap.ARAB.id,
      classroomId: classroomMap["1AS1"].id,
      academicYearId: year.id,
      hourlyRate: 250,
      weeklyHours: 4,
    },
  })
}

async function main() {
  await clearDatabase()
  const permissionMap = await createPermissions()

  const school1 = await prisma.school.create({
    data: {
      name: "مدرسة النور",
      slug: "alnoor",
      address: "نواكشوط، موريتانيا",
      phone: "+22200000001",
      email: "info@alnoor.edu",
      resultReportTitle: "كشف نتائج القسم",
      resultReportSubtitle: "النتائج الرسمية المعتمدة من إدارة المدرسة",
      resultReportFooterNote: "كل النقاط محسوبة آلياً وفق القاعدة المنشورة للمؤسسة.",
      subscriptionStatus: "TRIAL",
      billingStudentCount: 90,
    },
  })

  const { levelMap, streamMap, classroomMap } = await createSchoolStructure(school1.id)
  const subjectMap = await createSubjects(school1.id)
  const { year, term1 } = await createAcademicYear(school1.id)
  await seedWeights(school1.id, year.id, levelMap, streamMap, classroomMap, subjectMap)

  const { admin, teachers, parent } = await createUsersAndTeachers(school1.id, permissionMap)
  const students = await seedStudentsAndLinks(school1.id, year.id, classroomMap, parent.id)
  await seedTeacherAssignments(school1.id, year.id, teachers, classroomMap, subjectMap)
  await seedSampleLessonsAndAssessments(school1.id, year.id, term1.id, students, classroomMap, subjectMap, teachers)

  const superAdminPassword = await bcrypt.hash("password123", 10)
  await prisma.user.create({
    data: {
      email: "superadmin@classflow.com",
      passwordHash: superAdminPassword,
      name: "مدير المنصة",
      role: "SUPER_ADMIN",
    },
  })

  await createSecondSchool(permissionMap)

  console.log("Seed complete.")
  console.log("Accounts:")
  console.log("  admin@alnoor.edu / password123")
  console.log("  studies@alnoor.edu / password123")
  console.log("  accountant@alnoor.edu / password123")
  console.log("  supervisor@alnoor.edu / password123")
  console.log("  teacher.math@alnoor.edu / password123")
  console.log("  teacher.arabic@alnoor.edu / password123")
  console.log("  teacher.science@alnoor.edu / password123")
  console.log("  teacher.french@alnoor.edu / password123")
  console.log("  parent@alnoor.edu / password123")
  console.log("  admin@alfath.edu / password123")
  console.log("  teacher@alfath.edu / password123")
  console.log("  superadmin@classflow.com / password123")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { sourceClassroomId, sourceAcademicYearId, targetAcademicYearId, targetClassroomId, studentIds } = body as {
      sourceClassroomId: string
      sourceAcademicYearId?: string
      targetAcademicYearId: string
      targetClassroomId: string
      studentIds: string[]
    }

    if (!sourceClassroomId || !targetAcademicYearId || !targetClassroomId || !studentIds?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [targetClassroom, targetYear, sourceClassroom] = await Promise.all([
      prisma.classroom.findFirst({ where: { id: targetClassroomId, schoolId: user.schoolId! }, select: { id: true, name: true } }),
      prisma.academicYear.findFirst({ where: { id: targetAcademicYearId, schoolId: user.schoolId! }, select: { id: true } }),
      prisma.classroom.findFirst({ where: { id: sourceClassroomId, schoolId: user.schoolId! }, select: { id: true, name: true } }),
    ])
    if (!targetClassroom || !targetYear)
      return NextResponse.json({ error: "Target classroom or year not found" }, { status: 404 })

    const sourceEnrollments = await prisma.enrollment.findMany({
      where: {
        classroomId: sourceClassroomId,
        studentId: { in: studentIds },
        status: "ACTIVE",
      },
      select: { studentId: true, academicYearId: true },
    })
    const validStudentIds = new Set(sourceEnrollments.map((e) => e.studentId))
    const invalidStudents = studentIds.filter((id) => !validStudentIds.has(id))

    const existingEnrollments = await prisma.enrollment.findMany({
      where: {
        academicYearId: targetAcademicYearId,
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    })
    const alreadyEnrolled = new Set(existingEnrollments.map((e) => e.studentId))
    const toEnroll = studentIds.filter((id) => validStudentIds.has(id) && !alreadyEnrolled.has(id))

    if (toEnroll.length === 0) {
      return NextResponse.json({
        promoted: 0,
        skipped: studentIds.length,
        invalid: invalidStudents.length,
        message: invalidStudents.length > 0
          ? `${invalidStudents.length} student(s) not found in source classroom`
          : "All students already enrolled in target year",
      })
    }

    const isRepeat = sourceClassroomId === targetClassroomId

    const result = await prisma.$transaction(async (tx) => {
      const last = await tx.enrollment.findFirst({
        where: { classroomId: targetClassroomId, academicYearId: targetAcademicYearId, rollNumber: { not: null } },
        orderBy: { rollNumber: "desc" },
        select: { rollNumber: true },
      })
      let nextRoll = (last?.rollNumber || 0) + 1

      await tx.enrollment.updateMany({
        where: {
          classroomId: sourceClassroomId,
          studentId: { in: toEnroll },
          status: "ACTIVE",
        },
        data: { status: isRepeat ? "ACTIVE" : "INACTIVE" },
      })

      const created = await Promise.all(
        toEnroll.map((studentId) =>
          tx.enrollment.create({
            data: {
              schoolId: user.schoolId!,
              studentId,
              classroomId: targetClassroomId,
              academicYearId: targetAcademicYearId,
              rollNumber: nextRoll++,
            },
          })
        )
      )
      return created
    })

    return NextResponse.json({
      promoted: result.length,
      skipped: alreadyEnrolled.size,
      invalid: invalidStudents.length,
      isRepeat,
    })
  } catch (e: any) {
    console.error("[promote]", e)
    return NextResponse.json({ error: e.message || "Promotion failed" }, { status: 500 })
  }
}

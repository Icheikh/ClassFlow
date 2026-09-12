import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { feeId, classroomId, levelId } = body
  if (!feeId) return NextResponse.json({ error: "الرسم مطلوب" }, { status: 400 })

  const fee = await prisma.fee.findFirst({ where: { id: feeId, schoolId: user.schoolId! } })
  if (!fee) return NextResponse.json({ error: "الرسم غير موجود" }, { status: 404 })

  if (classroomId) {
    const classroom = await prisma.classroom.findFirst({ where: { id: classroomId, schoolId: user.schoolId! }, select: { id: true } })
    if (!classroom) return NextResponse.json({ error: "القسم غير موجود في هذه المدرسة" }, { status: 400 })
  }
  if (levelId) {
    const level = await prisma.level.findFirst({ where: { id: levelId, schoolId: user.schoolId! }, select: { id: true } })
    if (!level) return NextResponse.json({ error: "المستوى غير موجود في هذه المدرسة" }, { status: 400 })
  }

  const where: any = { schoolId: user.schoolId!, isActive: true }
  if (classroomId) {
    where.enrollments = { some: { classroomId, status: "ACTIVE" } }
  } else if (levelId) {
    where.enrollments = { some: { classroom: { levelId }, status: "ACTIVE" } }
  }

  const students = await prisma.student.findMany({
    where,
    include: { enrollments: { where: { status: "ACTIVE" }, take: 1 } },
  })

  let created = 0
  for (const student of students) {
    const classroomIdForFee = classroomId || student.enrollments[0]?.classroomId
    if (!classroomIdForFee) continue
    const existing = await prisma.studentFee.findUnique({
      where: { studentId_feeId: { studentId: student.id, feeId } },
    })
    if (existing) continue
    await prisma.studentFee.create({
      data: {
        schoolId: user.schoolId!,
        studentId: student.id,
        feeId,
        classroomId: classroomIdForFee,
        isActive: true,
      },
    })
    created++
  }

  return NextResponse.json({ created, total: students.length })
}

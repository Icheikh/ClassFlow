import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { parsePositiveAmount } from "@/lib/finance"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let fees
  try {
    fees = await prisma.fee.findMany({
      where: { schoolId: user.schoolId! },
      include: { _count: { select: { studentFees: true } } },
      orderBy: { createdAt: "desc" },
    })
  } catch {
    fees = await prisma.fee.findMany({
      where: { schoolId: user.schoolId! },
      orderBy: { createdAt: "desc" },
    })
  }

  return NextResponse.json(fees)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, amount: rawAmount, frequency, levelId, classroomId } = body
  const amount = parsePositiveAmount(rawAmount)
  if (!name?.trim() || amount == null)
    return NextResponse.json({ error: "اسم صالح ومبلغ أكبر من صفر مطلوبان" }, { status: 400 })

  // levelId/classroomId must belong to this school (tenant isolation).
  if (levelId) {
    const level = await prisma.level.findFirst({ where: { id: levelId, schoolId: user.schoolId! }, select: { id: true } })
    if (!level) return NextResponse.json({ error: "المستوى غير موجود في هذه المدرسة" }, { status: 400 })
  }
  if (classroomId) {
    const classroom = await prisma.classroom.findFirst({ where: { id: classroomId, schoolId: user.schoolId! }, select: { id: true } })
    if (!classroom) return NextResponse.json({ error: "القسم غير موجود في هذه المدرسة" }, { status: 400 })
  }

  const fee = await prisma.fee.create({
    data: {
      schoolId: user.schoolId!,
      name: name.trim(),
      amount,
      frequency: frequency || "MONTHLY",
      levelId: levelId || null,
      classroomId: classroomId || null,
    },
  })

  // Auto-assign fee to students if classroom or level is specified
  try {
    if (fee.classroomId || fee.levelId) {
      const studentWhere: any = { schoolId: user.schoolId!, isActive: true }
      if (fee.classroomId) {
        studentWhere.enrollments = { some: { classroomId: fee.classroomId, status: "ACTIVE" } }
      } else if (fee.levelId) {
        studentWhere.enrollments = { some: { classroom: { levelId: fee.levelId }, status: "ACTIVE" } }
      }
      const students = await prisma.student.findMany({
        where: studentWhere,
        include: { enrollments: { where: { status: "ACTIVE" }, take: 1 } },
      })
      for (const student of students) {
        const cId = fee.classroomId || student.enrollments[0]?.classroomId
        if (!cId) continue
        const existing = await prisma.studentFee.findUnique({
          where: { studentId_feeId: { studentId: student.id, feeId: fee.id } },
        })
        if (!existing) {
          await prisma.studentFee.create({
            data: { schoolId: user.schoolId!, studentId: student.id, feeId: fee.id, classroomId: cId },
          })
        }
      }
    }
  } catch (e) {
    // StudentFee table might not exist yet — skip auto-assignment
    console.error("Auto-assign failed:", e)
  }

  return NextResponse.json(fee)
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let fees
  try {
    fees = await prisma.fee.findMany({
      where: { schoolId: user.schoolId },
      include: { _count: { select: { studentFees: true } } },
      orderBy: { createdAt: "desc" },
    })
  } catch {
    fees = await prisma.fee.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: "desc" },
    })
  }

  return NextResponse.json(fees)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, amount, frequency, levelId, classroomId } = body
  if (!name || amount == null) return NextResponse.json({ error: "الاسم والمبلغ مطلوبان" }, { status: 400 })

  const fee = await prisma.fee.create({
    data: {
      schoolId: user.schoolId,
      name,
      amount: parseFloat(amount),
      frequency: frequency || "MONTHLY",
      levelId: levelId || null,
      classroomId: classroomId || null,
    },
  })

  // Auto-assign fee to students if classroom or level is specified
  try {
    if (fee.classroomId || fee.levelId) {
      const studentWhere: any = { schoolId: user.schoolId, isActive: true }
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
            data: { schoolId: user.schoolId, studentId: student.id, feeId: fee.id, classroomId: cId },
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

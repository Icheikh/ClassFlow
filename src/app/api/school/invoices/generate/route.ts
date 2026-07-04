import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { monthBelongsToYear } from "@/lib/finance"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES) && !isLegacyRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const month = typeof body.month === "string" ? body.month : ""
  const classroomId = typeof body.classroomId === "string" && body.classroomId ? body.classroomId : null
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : null

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "الشهر غير صالح" }, { status: 400 })
  }

  const activeStudentFees = await prisma.studentFee.findMany({
    where: {
      schoolId: user.schoolId,
      isActive: true,
      ...(classroomId ? { classroomId } : {}),
      student: { isActive: true },
    },
    include: {
      fee: true,
      student: { select: { id: true, firstName: true, lastName: true, isActive: true } },
      classroom: { select: { id: true, name: true } },
      invoices: { select: { id: true, month: true } },
    },
  })

  let created = 0
  let skippedExisting = 0
  let skippedByFrequency = 0

  for (const studentFee of activeStudentFees) {
    const existingSameMonth = studentFee.invoices.some((invoice) => invoice.month === month)
    if (existingSameMonth) {
      skippedExisting += 1
      continue
    }

    if (studentFee.fee.frequency === "ONE_TIME" && studentFee.invoices.length > 0) {
      skippedByFrequency += 1
      continue
    }

    if (
      studentFee.fee.frequency === "YEARLY"
      && studentFee.invoices.some((invoice) => monthBelongsToYear(invoice.month, month.slice(0, 4)))
    ) {
      skippedByFrequency += 1
      continue
    }

    await prisma.invoice.create({
      data: {
        schoolId: user.schoolId,
        studentId: studentFee.studentId,
        feeId: studentFee.feeId,
        studentFeeId: studentFee.id,
        classroomId: studentFee.classroomId,
        month,
        amount: studentFee.fee.amount,
        dueDate,
      },
    })
    created += 1
  }

  return NextResponse.json({
    created,
    skippedExisting,
    skippedByFrequency,
    total: activeStudentFees.length,
  })
}

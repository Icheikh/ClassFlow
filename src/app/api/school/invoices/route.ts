import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions"

function canReadFinance(user: any) {
  return hasAnyPermission(user, [
    PERMISSIONS.MANAGE_FEES,
    PERMISSIONS.RECORD_PAYMENTS,
    PERMISSIONS.VIEW_FINANCE_REPORTS,
  ]) || ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canReadFinance(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const month = url.searchParams.get("month")
  const status = url.searchParams.get("status")
  const search = (url.searchParams.get("search") || "").trim()

  const where: any = { schoolId: user.schoolId! }
  if (classroomId) where.classroomId = classroomId
  if (month) where.month = month
  if (status) where.status = status
  if (search) {
    where.student = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { studentNumber: { contains: search } },
      ],
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
      fee: { select: { id: true, name: true, frequency: true } },
      classroom: { select: { id: true, name: true } },
      payments: { select: { id: true, amount: true, date: true, method: true } },
    },
    orderBy: [{ month: "desc" }, { student: { firstName: "asc" } }],
  })

  return NextResponse.json(invoices)
}

// NOTE: monthly generation lives in POST /api/school/invoices/generate
// (frequency-aware: MONTHLY / YEARLY-per-academic-year / TERM / ONE_TIME).
// A legacy frequency-blind generator used to live here and was removed
// because it could double-bill YEARLY and ONE_TIME fees.

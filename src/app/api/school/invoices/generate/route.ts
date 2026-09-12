import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { monthBounds, monthsInRange } from "@/lib/finance"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!hasPermission(user, PERMISSIONS.MANAGE_FEES)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const month = typeof body.month === "string" ? body.month : ""
  const classroomId = typeof body.classroomId === "string" && body.classroomId ? body.classroomId : null
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : null
  // dryRun previews counts without creating anything (confirmation step).
  const dryRun = body.dryRun === true

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "الشهر غير صالح" }, { status: 400 })
  }
  const bounds = monthBounds(month)
  if (!bounds) {
    return NextResponse.json({ error: "الشهر غير صالح" }, { status: 400 })
  }

  // Academic container of the target month (school years span Sep→Jun across
  // two calendar years, so calendar-year comparison would double-bill YEARLY fees).
  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId!, startsAt: { lt: bounds.end }, endsAt: { gt: bounds.start } },
    select: { id: true, startsAt: true, endsAt: true },
  })
  const yearMonths = academicYear ? new Set(monthsInRange(academicYear.startsAt, academicYear.endsAt)) : null

  const containingTerm = await prisma.term.findFirst({
    where: {
      schoolId: user.schoolId!,
      academicYearId: academicYear?.id || undefined,
      startsAt: { lt: bounds.end },
      endsAt: { gt: bounds.start },
    },
    select: { id: true, startsAt: true, endsAt: true },
  })
  const termMonths = containingTerm ? new Set(monthsInRange(containingTerm.startsAt, containingTerm.endsAt)) : null
  const schoolHasTerms = await prisma.term.count({ where: { schoolId: user.schoolId! } })

  const activeStudentFees = await prisma.studentFee.findMany({
    where: {
      schoolId: user.schoolId!,
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

    if (studentFee.fee.frequency === "YEARLY") {
      const billedThisYear = yearMonths
        ? studentFee.invoices.some((invoice) => yearMonths.has(invoice.month))
        : studentFee.invoices.some((invoice) => invoice.month.slice(0, 4) === month.slice(0, 4))
      if (billedThisYear) {
        skippedByFrequency += 1
        continue
      }
    }

    if (studentFee.fee.frequency === "TERM") {
      if (!termMonths) {
        // No term contains this month: generating would duplicate-bill every month.
        if (schoolHasTerms === 0) {
          return NextResponse.json(
            { error: "أنشئ الفصول الدراسية أولاً — رسوم الفصل تحتاج فصلاً يحتوي الشهر" },
            { status: 400 }
          )
        }
        skippedByFrequency += 1
        continue
      }
      if (studentFee.invoices.some((invoice) => termMonths.has(invoice.month))) {
        skippedByFrequency += 1
        continue
      }
    }

    try {
      if (!dryRun) {
        await prisma.invoice.create({
          data: {
            schoolId: user.schoolId!,
            studentId: studentFee.studentId,
            feeId: studentFee.feeId,
            studentFeeId: studentFee.id,
            classroomId: studentFee.classroomId,
            month,
            amount: studentFee.fee.amount,
            dueDate,
          },
        })
      }
      created += 1
    } catch (e: any) {
      // Concurrent double-submit: unique (studentFeeId, month) already created it.
      if (e?.code === "P2002") skippedExisting += 1
      else throw e
    }
  }

  return NextResponse.json({
    created,
    skippedExisting,
    skippedByFrequency,
    total: activeStudentFees.length,
    dryRun,
  })
}

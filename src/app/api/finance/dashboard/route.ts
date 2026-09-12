import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user
    if (!session || !user?.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!hasPermission(user, PERMISSIONS.VIEW_FINANCE_REPORTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const schoolId = user.schoolId!
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`

    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
    })

    const [
      totalFees,
      activeStudentFees,
      totalInvoicesThisMonth,
      paidInvoicesThisMonth,
      pendingInvoicesThisMonth,
      overdueInvoices,
      collectedThisMonth,
      collectedLastMonth,
      totalCollectedAllTime,
      recentPayments,
      paymentsByMethod,
      topDebtors,
      feesBreakdown,
      monthlyCollectionTrend,
      totalStudents,
      enrolledStudents,
      invoicesByStatus,
      unpaidInvoices,
      paidOnUnpaidInvoices,
      paidOnCurrentMonthInvoices,
    ] = await Promise.all([
      prisma.fee.count({ where: { schoolId, isActive: true } }),
      prisma.studentFee.count({ where: { schoolId, isActive: true } }),
      prisma.invoice.count({ where: { schoolId, month: currentMonth } }),
      prisma.invoice.count({ where: { schoolId, month: currentMonth, status: "PAID" } }),
      prisma.invoice.count({ where: { schoolId, month: currentMonth, status: { in: ["PENDING", "PARTIAL"] } } }),
      prisma.invoice.count({
        where: {
          schoolId,
          status: { in: ["PENDING", "PARTIAL"] },
          OR: [{ dueDate: { lt: today } }, { dueDate: null, month: { lt: currentMonth } }],
        },
      }),
      prisma.payment.aggregate({
        where: { schoolId, date: { gte: monthStart, lt: nextMonthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { schoolId, date: { gte: lastMonthStart, lt: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { schoolId },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { schoolId },
        include: {
          student: { select: { firstName: true, lastName: true } },
          fee: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { schoolId, date: { gte: monthStart, lt: nextMonthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.$queryRaw`
        SELECT
          s.id as "studentId",
          s."firstName",
          s."lastName",
          COALESCE(SUM(inv.amount), 0) as "totalInvoiced",
          COALESCE(paid."totalPaid", 0) as "totalPaid",
          GREATEST(COALESCE(SUM(inv.amount), 0) - COALESCE(paid."totalPaid", 0), 0) as "balance"
        FROM "Student" s
        JOIN "Enrollment" e ON e."studentId" = s.id
        LEFT JOIN "Invoice" inv ON inv."studentId" = s.id
        LEFT JOIN (
          SELECT "studentId", SUM(amount) as "totalPaid"
          FROM "Payment"
          WHERE "schoolId" = ${schoolId}
          GROUP BY "studentId"
        ) paid ON paid."studentId" = s.id
        WHERE s."schoolId" = ${schoolId} AND s."isActive" = true
        GROUP BY s.id, s."firstName", s."lastName", paid."totalPaid"
        HAVING GREATEST(COALESCE(SUM(inv.amount), 0) - COALESCE(paid."totalPaid", 0), 0) > 0
        ORDER BY "balance" DESC
        LIMIT 10
      `,
      prisma.payment.groupBy({
        by: ["feeId"],
        where: { schoolId, date: { gte: monthStart, lt: nextMonthStart }, feeId: { not: null } },
        _sum: { amount: true },
        _count: true,
      }),
      (async () => {
        const months: { month: string; collected: number; count: number }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
          const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          const agg = await prisma.payment.aggregate({
            where: { schoolId, date: { gte: d, lt: nextD } },
            _sum: { amount: true },
            _count: true,
          })
          months.push({ month: m, collected: agg._sum.amount || 0, count: agg._count })
        }
        return months
      })(),
      prisma.student.count({ where: { schoolId, isActive: true } }),
      prisma.enrollment.count({
        where: {
          schoolId,
          academicYearId: activeYear?.id || "__none__",
          status: "ACTIVE",
        },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        where: { schoolId, month: currentMonth },
        _count: true,
        _sum: { amount: true },
      }),
      // True remaining: Σ(amount − paid) over unpaid invoices (partials honored).
      prisma.invoice.findMany({
        where: { schoolId, status: { in: ["PENDING", "PARTIAL"] } },
        select: { id: true, amount: true },
      }),
      prisma.payment.groupBy({
        by: ["invoiceId"],
        where: { schoolId, invoiceId: { not: null }, invoice: { status: { in: ["PENDING", "PARTIAL"] } } },
        _sum: { amount: true },
      }),
      // Paid specifically against current-month invoices (honest collection rate).
      prisma.payment.aggregate({
        where: { schoolId, invoice: { month: currentMonth } },
        _sum: { amount: true },
      }),
    ])

    const feeNames = await prisma.fee.findMany({
      where: { schoolId, id: { in: feesBreakdown.map((f) => f.feeId!).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    })
    const feeNameMap = new Map(feeNames.map((f) => [f.id, f.name]))

    const invoiceAgg = await prisma.invoice.aggregate({
      where: { schoolId, month: currentMonth },
      _sum: { amount: true },
    })

    const paidByInvoice = new Map<string, number>()
    for (const row of paidOnUnpaidInvoices) {
      if (row.invoiceId) paidByInvoice.set(row.invoiceId, row._sum.amount || 0)
    }
    let pendingAmount = 0
    for (const inv of unpaidInvoices) {
      pendingAmount += Math.max(inv.amount - (paidByInvoice.get(inv.id) || 0), 0)
    }
    pendingAmount = Math.round(pendingAmount * 100) / 100
    const collectedOnMonthInvoices = Math.round((paidOnCurrentMonthInvoices._sum.amount || 0) * 100) / 100

    const methodLabels: Record<string, string> = {
      CASH: "نقدي",
      BANKILY: "بنكيلي",
      MASRVI: "مصرفي",
      BANK_TRANSFER: "تحويل بنكي",
      CHEQUE: "شيك",
    }

    return NextResponse.json({
      summary: {
        totalFees,
        activeStudentFees,
        totalStudents,
        enrolledStudents,
        collectedThisMonth: collectedThisMonth._sum.amount || 0,
        collectedLastMonth: collectedLastMonth._sum.amount || 0,
        paymentsThisMonth: collectedThisMonth._count,
        paymentsLastMonth: collectedLastMonth._count,
        totalCollectedAllTime: totalCollectedAllTime._sum.amount || 0,
        totalPaymentsAllTime: totalCollectedAllTime._count,
        totalInvoicedThisMonth: invoiceAgg._sum.amount || 0,
        pendingAmount,
        collectedOnMonthInvoices,
      },
      invoices: {
        total: totalInvoicesThisMonth,
        paid: paidInvoicesThisMonth,
        pending: pendingInvoicesThisMonth,
        overdue: overdueInvoices,
        byStatus: invoicesByStatus.map((s) => ({
          status: s.status,
          count: s._count,
          amount: s._sum.amount || 0,
        })),
      },
      payments: {
        thisMonth: collectedThisMonth._sum.amount || 0,
        lastMonth: collectedLastMonth._sum.amount || 0,
        byMethod: paymentsByMethod.map((m) => ({
          method: m.method,
          label: methodLabels[m.method] || m.method,
          amount: m._sum.amount || 0,
          count: m._count,
        })),
        recent: recentPayments.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          receiptNumber: p.receiptNumber,
          date: p.date.toISOString(),
          studentName: `${p.student.firstName} ${p.student.lastName}`,
          feeName: p.fee?.name || null,
        })),
      },
      feesBreakdown: feesBreakdown.map((f) => ({
        feeId: f.feeId,
        feeName: feeNameMap.get(f.feeId || "") || "Unknown",
        amount: f._sum.amount || 0,
        count: f._count,
      })),
      monthlyTrend: monthlyCollectionTrend,
      topDebtors: (topDebtors as any[]).map((d) => ({
        studentId: d.studentId,
        firstName: d.firstName,
        lastName: d.lastName,
        totalInvoiced: Number(d.totalInvoiced) || 0,
        totalPaid: Number(d.totalPaid) || 0,
        balance: Number(d.balance) || 0,
      })),
    })
  } catch (error) {
    console.error("GET /api/finance/dashboard failed", error)
    return NextResponse.json({ error: "Failed to load finance dashboard" }, { status: 500 })
  }
}

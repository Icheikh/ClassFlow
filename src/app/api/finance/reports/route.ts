import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
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
    const url = new URL(req.url)
    const period = url.searchParams.get("period") || "monthly"
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")

    const now = new Date()
    let fromDate: Date
    let toDate: Date

    if (startDate && endDate) {
      fromDate = new Date(startDate)
      toDate = new Date(endDate)
      toDate.setDate(toDate.getDate() + 1)
    } else if (period === "daily") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      toDate = new Date(fromDate)
      toDate.setDate(toDate.getDate() + 1)
    } else if (period === "weekly") {
      const day = now.getDay()
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
      toDate = new Date(fromDate)
      toDate.setDate(toDate.getDate() + 7)
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }

    const [
      paymentsByDay,
      paymentsByFee,
      paymentsByClassroom,
      paymentsByMethod,
      paymentsByStudent,
      totalCollected,
      totalPayments,
      outstandingByStudent,
      outstandingByFee,
      invoiceAging,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          TO_CHAR(p."date", 'YYYY-MM-DD') as day,
          SUM(p.amount)::float as collected,
          COUNT(*)::int as count
        FROM "Payment" p
        WHERE p."schoolId" = ${schoolId}
          AND p."date" >= ${fromDate}
          AND p."date" < ${toDate}
        GROUP BY TO_CHAR(p."date", 'YYYY-MM-DD')
        ORDER BY day ASC
      `,
      prisma.payment.groupBy({
        by: ["feeId"],
        where: { schoolId, date: { gte: fromDate, lt: toDate }, feeId: { not: null } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.$queryRaw`
        SELECT
          c.name as "classroomName",
          l.name as "levelName",
          SUM(p.amount)::float as collected,
          COUNT(*)::int as count
        FROM "Payment" p
        JOIN "Invoice" inv ON inv.id = p."invoiceId"
        JOIN "Classroom" c ON c.id = inv."classroomId"
        JOIN "Level" l ON l.id = c."levelId"
        WHERE p."schoolId" = ${schoolId}
          AND p."date" >= ${fromDate}
          AND p."date" < ${toDate}
        GROUP BY c.name, l.name
        ORDER BY collected DESC
      `,
      prisma.payment.groupBy({
        by: ["method"],
        where: { schoolId, date: { gte: fromDate, lt: toDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.$queryRaw`
        SELECT
          s.id as "studentId",
          s."firstName",
          s."lastName",
          SUM(p.amount)::float as paid,
          COUNT(*)::int as "paymentCount"
        FROM "Payment" p
        JOIN "Student" s ON s.id = p."studentId"
        WHERE p."schoolId" = ${schoolId}
          AND p."date" >= ${fromDate}
          AND p."date" < ${toDate}
        GROUP BY s.id, s."firstName", s."lastName"
        ORDER BY paid DESC
        LIMIT 20
      `,
      prisma.payment.aggregate({
        where: { schoolId, date: { gte: fromDate, lt: toDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.count({
        where: { schoolId, date: { gte: fromDate, lt: toDate } },
      }),
      prisma.$queryRaw`
        SELECT
          s.id as "studentId",
          s."firstName",
          s."lastName",
          COALESCE(SUM(inv.amount), 0) as "totalInvoiced",
          COALESCE(paid."totalPaid", 0) as "totalPaid",
          GREATEST(COALESCE(SUM(inv.amount), 0) - COALESCE(paid."totalPaid", 0), 0) as balance
        FROM "Student" s
        LEFT JOIN "Invoice" inv ON inv."studentId" = s.id AND inv."schoolId" = ${schoolId}
        LEFT JOIN (
          SELECT "studentId", SUM(amount) as "totalPaid"
          FROM "Payment"
          WHERE "schoolId" = ${schoolId}
          GROUP BY "studentId"
        ) paid ON paid."studentId" = s.id
        WHERE s."schoolId" = ${schoolId} AND s."isActive" = true
        GROUP BY s.id, s."firstName", s."lastName", paid."totalPaid"
        HAVING GREATEST(COALESCE(SUM(inv.amount), 0) - COALESCE(paid."totalPaid", 0), 0) > 0
        ORDER BY balance DESC
        LIMIT 30
      `,
      prisma.$queryRaw`
        SELECT
          f.name as "feeName",
          COALESCE(SUM(inv.amount), 0) as "totalInvoiced",
          COALESCE(paid."totalPaid", 0) as "totalPaid",
          GREATEST(COALESCE(SUM(inv.amount), 0) - COALESCE(paid."totalPaid", 0), 0) as balance
        FROM "Fee" f
        LEFT JOIN "Invoice" inv ON inv."feeId" = f.id AND inv."schoolId" = ${schoolId}
        LEFT JOIN (
          SELECT "feeId", SUM(amount) as "totalPaid"
          FROM "Payment"
          WHERE "schoolId" = ${schoolId}
          GROUP BY "feeId"
        ) paid ON paid."feeId" = f.id
        WHERE f."schoolId" = ${schoolId} AND f."isActive" = true
        GROUP BY f.id, f.name, paid."totalPaid"
        HAVING GREATEST(COALESCE(SUM(inv.amount), 0) - COALESCE(paid."totalPaid", 0), 0) > 0
        ORDER BY balance DESC
      `,
      prisma.$queryRaw`
        SELECT
          CASE
            WHEN inv."dueDate" IS NULL THEN 'no_due_date'
            WHEN inv."dueDate" >= ${now} THEN 'current'
            WHEN inv."dueDate" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)} THEN 'overdue_30'
            WHEN inv."dueDate" >= ${new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)} THEN 'overdue_60'
            ELSE 'overdue_90'
          END as "agingBucket",
          COUNT(*)::int as count,
          SUM(inv.amount - COALESCE(paid."totalPaid", 0))::float as balance
        FROM "Invoice" inv
        LEFT JOIN (
          SELECT "invoiceId", SUM(amount) as "totalPaid"
          FROM "Payment"
          WHERE "schoolId" = ${schoolId}
          GROUP BY "invoiceId"
        ) paid ON paid."invoiceId" = inv.id
        WHERE inv."schoolId" = ${schoolId}
          AND inv.status != 'PAID'
          AND inv.amount - COALESCE(paid."totalPaid", 0) > 0
        GROUP BY "agingBucket"
        ORDER BY "agingBucket" ASC
      `,
    ])

    const feeNames = await prisma.fee.findMany({
      where: { schoolId, id: { in: paymentsByFee.map((f) => f.feeId!).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    })
    const feeNameMap = new Map(feeNames.map((f) => [f.id, f.name]))

    const methodLabels: Record<string, string> = {
      CASH: "نقدي",
      BANKILY: "بنكيلي",
      MASRVI: "مصرفي",
      BANK_TRANSFER: "تحويل بنكي",
      CHEQUE: "شيك",
    }

    return NextResponse.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString(), label: period },
      summary: {
        totalCollected: totalCollected._sum.amount || 0,
        totalPayments,
        averagePayment: totalPayments > 0 ? Math.round((totalCollected._sum.amount || 0) / totalPayments) : 0,
      },
      byDay: (paymentsByDay as any[]).map((d) => ({
        day: d.day,
        collected: Number(d.collected) || 0,
        count: Number(d.count) || 0,
      })),
      byFee: paymentsByFee.map((f) => ({
        feeId: f.feeId,
        feeName: feeNameMap.get(f.feeId || "") || "Unknown",
        amount: f._sum.amount || 0,
        count: f._count,
      })),
      byClassroom: (paymentsByClassroom as any[]).map((c) => ({
        classroomName: c.classroomName,
        levelName: c.levelName,
        collected: Number(c.collected) || 0,
        count: Number(c.count) || 0,
      })),
      byMethod: paymentsByMethod.map((m) => ({
        method: m.method,
        label: methodLabels[m.method] || m.method,
        amount: m._sum.amount || 0,
        count: m._count,
      })),
      byStudent: (paymentsByStudent as any[]).map((s) => ({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        paid: Number(s.paid) || 0,
        paymentCount: Number(s.paymentCount) || 0,
      })),
      outstanding: {
        byStudent: (outstandingByStudent as any[]).map((s) => ({
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          totalInvoiced: Number(s.totalInvoiced) || 0,
          totalPaid: Number(s.totalPaid) || 0,
          balance: Number(s.balance) || 0,
        })),
        byFee: (outstandingByFee as any[]).map((f) => ({
          feeName: f.feeName,
          totalInvoiced: Number(f.totalInvoiced) || 0,
          totalPaid: Number(f.totalPaid) || 0,
          balance: Number(f.balance) || 0,
        })),
        aging: (invoiceAging as any[]).map((a) => ({
          bucket: a.agingBucket,
          count: Number(a.count) || 0,
          balance: Number(a.balance) || 0,
        })),
        totalOutstanding: (outstandingByStudent as any[]).reduce((sum: number, s: any) => sum + (Number(s.balance) || 0), 0),
      },
    })
  } catch (error) {
    console.error("GET /api/finance/reports failed", error)
    return NextResponse.json({ error: "Failed to load financial reports" }, { status: 500 })
  }
}

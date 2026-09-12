export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

function formatNumber(n: number): string {
  return n.toLocaleString("en-US")
}

const AGE_BUCKETS: Record<string, string> = {
  current: "Current",
  overdue_30: "1-30 Days",
  overdue_60: "31-60 Days",
  overdue_90: "61+ Days",
  no_due_date: "No Due Date",
}

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
    const schoolName = user.school?.name || "School"
    const url = new URL(req.url)
    const format = url.searchParams.get("format") || "pdf"
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
      paymentsByFee,
      paymentsByClassroom,
      paymentsByMethod,
      totalCollected,
      totalPayments,
      outstandingByStudent,
      invoiceAging,
    ] = await Promise.all([
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
      CASH: "Cash",
      BANKILY: "Bankily",
      MASRVI: "Masrvi",
      BANK_TRANSFER: "Bank Transfer",
      CHEQUE: "Cheque",
    }

    const totalCollectedAmount = totalCollected._sum.amount || 0
    const averagePayment = totalPayments > 0 ? Math.round(totalCollectedAmount / totalPayments) : 0

    const periodLabel = `${fromDate.toISOString().slice(0, 10)} — ${new Date(toDate.getTime() - 86400000).toISOString().slice(0, 10)}`

    if (format === "excel") {
      const wb = XLSX.utils.book_new()

      const summaryRows = [
        ["Total Collected", totalCollectedAmount],
        ["Payment Count", totalPayments],
        ["Average Payment", averagePayment],
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet([
        ["Metric", "Value"],
        ...summaryRows,
      ])
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")

      const feeRows = paymentsByFee.map((f) => [
        feeNameMap.get(f.feeId || "") || "Unknown",
        f._sum.amount || 0,
        f._count,
      ])
      const feeSheet = XLSX.utils.aoa_to_sheet([
        ["Fee", "Amount", "Count"],
        ...feeRows,
      ])
      XLSX.utils.book_append_sheet(wb, feeSheet, "By Fee")

      const classroomRows = (paymentsByClassroom as any[]).map((c) => [
        c.classroomName,
        c.levelName,
        Number(c.collected) || 0,
        Number(c.count) || 0,
      ])
      const classroomSheet = XLSX.utils.aoa_to_sheet([
        ["Classroom", "Level", "Amount", "Count"],
        ...classroomRows,
      ])
      XLSX.utils.book_append_sheet(wb, classroomSheet, "By Classroom")

      const methodRows = paymentsByMethod.map((m) => [
        methodLabels[m.method] || m.method,
        m._sum.amount || 0,
        m._count,
      ])
      const methodSheet = XLSX.utils.aoa_to_sheet([
        ["Method", "Amount", "Count"],
        ...methodRows,
      ])
      XLSX.utils.book_append_sheet(wb, methodSheet, "By Method")

      const outstandingRows = (outstandingByStudent as any[]).map((s) => [
        `${s.firstName} ${s.lastName}`,
        Number(s.totalInvoiced) || 0,
        Number(s.totalPaid) || 0,
        Number(s.balance) || 0,
      ])
      const outstandingSheet = XLSX.utils.aoa_to_sheet([
        ["Student", "Invoiced", "Paid", "Balance"],
        ...outstandingRows,
      ])
      XLSX.utils.book_append_sheet(wb, outstandingSheet, "Outstanding")

      const agingRows = (invoiceAging as any[]).map((a) => [
        AGE_BUCKETS[a.agingBucket] || a.agingBucket,
        Number(a.count) || 0,
        Number(a.balance) || 0,
      ])
      const agingSheet = XLSX.utils.aoa_to_sheet([
        ["Bucket", "Count", "Balance"],
        ...agingRows,
      ])
      XLSX.utils.book_append_sheet(wb, agingSheet, "Aging")

      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
      const dateStr = new Date().toISOString().slice(0, 10)

      return new NextResponse(excelBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="finance-report-${dateStr}.xlsx"`,
        },
      })
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 15

    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text(schoolName, pageWidth / 2, y, { align: "center" })
    y += 10

    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    doc.text("Financial Report", pageWidth / 2, y, { align: "center" })
    y += 8

    doc.setFontSize(10)
    doc.text(`Period: ${periodLabel}`, pageWidth / 2, y, { align: "center" })
    y += 12

    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(15, y, pageWidth - 15, y)
    y += 8

    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("Summary", 15, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Collected", formatNumber(totalCollectedAmount)],
        ["Payment Count", formatNumber(totalPayments)],
        ["Average Payment", formatNumber(averagePayment)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 73, 94] },
      margin: { left: 15, right: 15 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("Payments by Fee", 15, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [["Fee", "Amount", "Count"]],
      body: paymentsByFee.map((f) => [
        feeNameMap.get(f.feeId || "") || "Unknown",
        formatNumber(f._sum.amount || 0),
        String(f._count),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 73, 94] },
      margin: { left: 15, right: 15 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("Payments by Classroom", 15, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [["Classroom", "Level", "Amount", "Count"]],
      body: (paymentsByClassroom as any[]).map((c) => [
        c.classroomName,
        c.levelName,
        formatNumber(Number(c.collected) || 0),
        String(Number(c.count) || 0),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 73, 94] },
      margin: { left: 15, right: 15 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("Payments by Method", 15, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [["Method", "Amount", "Count"]],
      body: paymentsByMethod.map((m) => [
        methodLabels[m.method] || m.method,
        formatNumber(m._sum.amount || 0),
        String(m._count),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 73, 94] },
      margin: { left: 15, right: 15 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    doc.addPage()
    y = 15

    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("Outstanding by Student", 15, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [["Student", "Invoiced", "Paid", "Balance"]],
      body: (outstandingByStudent as any[]).map((s) => [
        `${s.firstName} ${s.lastName}`,
        formatNumber(Number(s.totalInvoiced) || 0),
        formatNumber(Number(s.totalPaid) || 0),
        formatNumber(Number(s.balance) || 0),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 73, 94] },
      margin: { left: 15, right: 15 },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("Aging Analysis", 15, y)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [["Bucket", "Count", "Balance"]],
      body: (invoiceAging as any[]).map((a) => [
        AGE_BUCKETS[a.agingBucket] || a.agingBucket,
        String(Number(a.count) || 0),
        formatNumber(Number(a.balance) || 0),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [52, 73, 94] },
      margin: { left: 15, right: 15 },
    })

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const dateStr = new Date().toISOString().slice(0, 10)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="finance-report-${dateStr}.pdf"`,
      },
    })
  } catch (error) {
    console.error("GET /api/finance/export failed", error)
    return NextResponse.json({ error: "Failed to export financial report" }, { status: 500 })
  }
}

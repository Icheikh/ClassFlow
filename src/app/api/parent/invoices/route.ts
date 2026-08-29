import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id || user?.role !== "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parent = await prisma.parent.findUnique({ where: { userId: user.id } })
  if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 })

  const links = await prisma.studentParent.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  })
  const childIds = links.map((l) => l.studentId)
  if (childIds.length === 0) return NextResponse.json({ invoices: [], summary: { total: 0, paid: 0, remaining: 0 } })

  const invoices = await prisma.invoice.findMany({
    where: { studentId: { in: childIds } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      fee: { select: { name: true } },
      classroom: { select: { name: true } },
      payments: { select: { amount: true, date: true, method: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const enriched = invoices.map((inv) => {
    const paidAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0)
    const remaining = inv.amount - paidAmount
    return {
      id: inv.id,
      student: inv.student,
      feeName: inv.fee.name,
      classroom: inv.classroom.name,
      month: inv.month,
      amount: inv.amount,
      paidAmount,
      remaining: Math.max(0, remaining),
      status: inv.status,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
      payments: inv.payments.map((p) => ({
        amount: p.amount,
        date: p.date,
        method: p.method,
      })),
    }
  })

  const total = enriched.reduce((sum, inv) => sum + inv.amount, 0)
  const paid = enriched.reduce((sum, inv) => sum + inv.paidAmount, 0)
  const remaining = Math.max(0, total - paid)

  return NextResponse.json({
    invoices: enriched,
    summary: { total, paid, remaining },
  })
}

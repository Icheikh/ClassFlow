import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Monthly payroll close: snapshot a teacher's computed totals as PAID
 * (or reopen to PENDING for correction). Weekly view stays computed-live.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_TEACHERS))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : ""
  const period = typeof body.period === "string" ? body.period : ""
  const action = body.action === "reopen" ? "reopen" : "pay"
  const totalHours = Number(body.totalHours)
  const totalEarnings = Number(body.totalEarnings)
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null

  if (!teacherId) return NextResponse.json({ error: "المعلم مطلوب" }, { status: 400 })
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: "الشهر غير صالح" }, { status: 400 })

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId: user.schoolId! },
    select: { id: true, user: { select: { name: true } } },
  })
  if (!teacher) return NextResponse.json({ error: "المعلم غير موجود" }, { status: 404 })

  if (action === "pay") {
    if (!Number.isFinite(totalHours) || totalHours < 0 || !Number.isFinite(totalEarnings) || totalEarnings < 0) {
      return NextResponse.json({ error: "إجماليات غير صالحة" }, { status: 400 })
    }
    const record = await prisma.payrollRecord.upsert({
      where: { schoolId_teacherId_period: { schoolId: user.schoolId!, teacherId, period } },
      update: { totalHours, totalEarnings, status: "PAID", paidAt: new Date(), paidByUserId: user.id, notes },
      create: {
        schoolId: user.schoolId!, teacherId, period, totalHours, totalEarnings,
        status: "PAID", paidAt: new Date(), paidByUserId: user.id, notes,
      },
    })
    await createAuditLog({
      schoolId: user.schoolId!,
      actorUserId: user.id,
      entityType: "PAYROLL",
      entityId: record.id,
      action: "PAY",
      description: `صرف راتب ${teacher.user.name} لشهر ${period}: ${totalEarnings} MRU (${totalHours} سا)`,
      after: { teacherId, period, totalHours, totalEarnings },
      ipAddress: getClientIp(req),
    })
    return NextResponse.json(record)
  }

  const record = await prisma.payrollRecord.upsert({
    where: { schoolId_teacherId_period: { schoolId: user.schoolId!, teacherId, period } },
    update: { status: "PENDING", paidAt: null, notes },
    create: {
      schoolId: user.schoolId!, teacherId, period, totalHours: 0, totalEarnings: 0,
      status: "PENDING", paidAt: null, paidByUserId: user.id, notes,
    },
  })
  await createAuditLog({
    schoolId: user.schoolId!,
    actorUserId: user.id,
    entityType: "PAYROLL",
    entityId: record.id,
    action: "REOPEN",
    description: `إعادة فتح راتب ${teacher.user.name} لشهر ${period}`,
    after: { teacherId, period },
    ipAddress: getClientIp(req),
  })
  return NextResponse.json(record)
}

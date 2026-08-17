import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "../../guard"

export const dynamic = "force-dynamic"

const SUBSCRIPTION_STATUSES = new Set(["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"])

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAdminSession()
  if ("error" in auth) return auth.error

  const school = await prisma.school.findUnique({ where: { id: params.id } })
  if (!school) return NextResponse.json({ error: "المدرسة غير موجودة" }, { status: 404 })

  const body = await req.json()
  const data: any = {}

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (typeof body.email === "string") data.email = body.email || null
  if (typeof body.phone === "string") data.phone = body.phone || null
  if (typeof body.address === "string") data.address = body.address || null

  if (typeof body.subscriptionStatus === "string") {
    if (!SUBSCRIPTION_STATUSES.has(body.subscriptionStatus)) {
      return NextResponse.json({ error: "حالة الاشتراك غير صالحة" }, { status: 400 })
    }
    data.subscriptionStatus = body.subscriptionStatus
  }

  if (typeof body.billingStudentCount === "number" && Number.isFinite(body.billingStudentCount)) {
    data.billingStudentCount = Math.max(0, Math.floor(body.billingStudentCount))
  }

  if (typeof body.isActive === "boolean") data.isActive = body.isActive

  const updated = await prisma.school.update({
    where: { id: params.id },
    data,
    include: {
      _count: { select: { users: true, students: true, teachers: true } },
    },
  })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    email: updated.email,
    phone: updated.phone,
    address: updated.address,
    subscriptionStatus: updated.subscriptionStatus,
    billingStudentCount: updated.billingStudentCount,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
    userCount: updated._count.users,
    studentCount: updated._count.students,
    teacherCount: updated._count.teachers,
  })
}
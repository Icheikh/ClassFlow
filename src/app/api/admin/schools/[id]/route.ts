import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
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

  // إدارة مدير المدرسة (تعديل البيانات / تغيير كلمة المرور / إعادة تفعيل)
  const admin = body.admin as
    | { userId?: string; name?: string; email?: string; password?: string; isActive?: boolean }
    | undefined

  let adminResult: { id: string; email: string; name: string; isActive: boolean } | null = null

  if (admin && typeof admin === "object") {
    if (admin.userId) {
      const user = await prisma.user.findUnique({ where: { id: admin.userId } })
      if (user && user.schoolId === school.id) {
        const userData: any = {}
        if (typeof admin.name === "string" && admin.name.trim()) userData.name = admin.name.trim()
        if (typeof admin.email === "string" && admin.email.trim()) {
          const exists = await prisma.user.findUnique({ where: { email: admin.email.trim() } })
          if (exists && exists.id !== user.id) {
            return NextResponse.json({ error: "البريد الإلكتروني للمدير مستخدم من قبل" }, { status: 400 })
          }
          userData.email = admin.email.trim()
        }
        if (typeof admin.password === "string" && admin.password.trim()) {
          if (admin.password.trim().length < 8) {
            return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 })
          }
          userData.passwordHash = await bcrypt.hash(admin.password.trim(), 10)
          userData.mustChangePassword = true
        }
        if (typeof admin.isActive === "boolean") userData.isActive = admin.isActive
        if (Object.keys(userData).length > 0) {
          await prisma.user.update({ where: { id: user.id }, data: userData })
        }
        const updated = await prisma.user.findUnique({ where: { id: user.id } })
        adminResult = updated
          ? { id: updated.id, email: updated.email, name: updated.name, isActive: updated.isActive }
          : null
      }
    }
  }

  const updated = await prisma.school.update({
    where: { id: params.id },
    data,
    include: {
      _count: { select: { users: true, students: true, teachers: true } },
      users: {
        where: { role: "SCHOOL_ADMIN" },
        select: { id: true, email: true, name: true, isActive: true },
        take: 1,
      },
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
    admin: adminResult || updated.users[0]
      ? {
          id: (adminResult || updated.users[0])?.id,
          email: (adminResult || updated.users[0])?.email,
          name: (adminResult || updated.users[0])?.name,
          isActive: (adminResult || updated.users[0])?.isActive,
        }
      : null,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAdminSession()
  if ("error" in auth) return auth.error

  const school = await prisma.school.findUnique({
    where: { id: params.id },
    include: { _count: { select: { students: true, teachers: true, invoices: true, users: true } } },
  })
  if (!school) return NextResponse.json({ error: "المدرسة غير موجودة" }, { status: 404 })

  const totalData =
    school._count.students +
    school._count.teachers +
    school._count.invoices +
    (school._count.users - 1)

  const schoolUserIds = (
    await prisma.user.findMany({
      where: { schoolId: school.id },
      select: { id: true },
    })
  ).map((u) => u.id)

  await prisma.studentParent.deleteMany({ where: { schoolId: school.id } })
  await prisma.teacherAttendance.deleteMany({ where: { schoolId: school.id } })
  await prisma.teachingHourEntry.deleteMany({ where: { schoolId: school.id } })
  await prisma.teacherAssignment.deleteMany({ where: { schoolId: school.id } })
  await prisma.scheduleAttendance.deleteMany({ where: { schoolId: school.id } })
  await prisma.notificationRecipient.deleteMany({ where: { schoolId: school.id } })
  await prisma.notificationCampaign.deleteMany({ where: { schoolId: school.id } })
  await prisma.notificationTemplate.deleteMany({ where: { schoolId: school.id } })
  await prisma.notification.deleteMany({ where: { schoolId: school.id } })
  await prisma.userPermission.deleteMany({ where: { userId: { in: schoolUserIds } } })
  await prisma.userPermission.deleteMany({
    where: { grantedBy: { in: schoolUserIds } },
  })
  await prisma.resultAuditLog.deleteMany({ where: { schoolId: school.id } })
  await prisma.resultPublication.deleteMany({ where: { schoolId: school.id } })
  await prisma.assessmentScore.deleteMany({ where: { schoolId: school.id } })
  await prisma.assessment.deleteMany({ where: { schoolId: school.id } })
  await prisma.grade.deleteMany({ where: { schoolId: school.id } })
  await prisma.attendance.deleteMany({ where: { schoolId: school.id } })
  await prisma.lesson.deleteMany({ where: { schoolId: school.id } })
  await prisma.payment.deleteMany({ where: { schoolId: school.id } })
  await prisma.invoice.deleteMany({ where: { schoolId: school.id } })
  await prisma.studentFee.deleteMany({ where: { schoolId: school.id } })
  await prisma.resultRule.deleteMany({ where: { schoolId: school.id } })

  // إزالة الإشارة إلى القالب النشط قبل حذف القوالب
  await prisma.school.update({
    where: { id: school.id },
    data: { activeResultReportTemplateId: null },
  })
  await prisma.resultReportTemplate.deleteMany({ where: { schoolId: school.id } })

  // الطبقة الوسطى
  await prisma.fee.deleteMany({ where: { schoolId: school.id } })
  await prisma.schedule.deleteMany({ where: { schoolId: school.id } })
  await prisma.subject.deleteMany({ where: { schoolId: school.id } })
  await prisma.classroom.deleteMany({ where: { schoolId: school.id } })
  await prisma.academicYear.deleteMany({ where: { schoolId: school.id } })
  await prisma.stream.deleteMany({ where: { schoolId: school.id } })
  await prisma.level.deleteMany({ where: { schoolId: school.id } })
  await prisma.educationStage.deleteMany({ where: { schoolId: school.id } })

  // المعلمون والآباء ثم المستخدمون ثم المدرسة
  await prisma.teacher.deleteMany({ where: { schoolId: school.id } })
  await prisma.parent.deleteMany({ where: { schoolId: school.id } })
  await prisma.student.deleteMany({ where: { schoolId: school.id } })
  await prisma.user.deleteMany({ where: { schoolId: school.id } })
  await prisma.school.delete({ where: { id: school.id } })

  return NextResponse.json({ success: true, deletedDataRows: totalData })
}
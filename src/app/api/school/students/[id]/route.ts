import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { normalizePhone } from "@/lib/phone"
import { ensureSchoolUser } from "@/lib/user-accounts"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const student = await prisma.student.findFirst({
    where: { id: params.id, schoolId: user.schoolId! },
    include: {
      enrollments: {
        include: { classroom: { include: { level: true, stream: true } }, academicYear: true },
        orderBy: { enrolledAt: "desc" },
      },
      studentParents: {
        include: { parent: { include: { user: { select: { name: true, phone: true, status: true } } } } },
      },
    },
  })
  if (!student) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  return NextResponse.json(student)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const student = await prisma.student.findFirst({ where: { id: params.id, schoolId: user.schoolId! } })
  if (!student) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const body = await req.json()
  const { firstName, lastName, gender, birthDate, studentNumber, address, phone, isActive, parentName, parentPhone } = body

  if (studentNumber && studentNumber !== student.studentNumber) {
    const existing = await prisma.student.findFirst({
      where: { schoolId: user.schoolId!, studentNumber, id: { not: params.id } },
    })
    if (existing) return NextResponse.json({ error: "رقم التسجيل موجود مسبقاً" }, { status: 400 })
  }

  if ((parentName !== undefined && parentName !== null && String(parentName).trim() !== "") || (parentPhone !== undefined && parentPhone !== null && String(parentPhone).trim() !== "")) {
    if (!normalizePhone(parentPhone || "")) {
      return NextResponse.json({ error: "رقم هاتف ولي الأمر غير صالح" }, { status: 400 })
    }
  }

  const updated = await prisma.student.update({
    where: { id: params.id },
    data: {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      gender: gender !== undefined ? gender : undefined,
      birthDate: birthDate ? new Date(birthDate) : birthDate === null ? null : undefined,
      studentNumber: studentNumber !== undefined ? studentNumber : undefined,
      address: address !== undefined ? address : undefined,
      phone: phone !== undefined ? phone : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    },
  })

  // Parent linking by phone — one account per number across all children.
  if (
    (parentName !== undefined && parentName !== null && String(parentName).trim() !== "") ||
    (parentPhone !== undefined && parentPhone !== null && String(parentPhone).trim() !== "")
  ) {
    const normalized = normalizePhone(parentPhone)!
    const existingSp = await prisma.studentParent.findFirst({
      where: { studentId: params.id, isPrimary: true },
      include: { parent: true },
    })

    // Find any existing parent profile for this phone (any primary role).
    const phoneUser = await prisma.user.findUnique({
      where: { schoolId_phoneNormalized: { schoolId: user.schoolId!, phoneNormalized: normalized } },
      select: { id: true, name: true },
    })
    let targetParent = phoneUser
      ? await prisma.parent.findFirst({ where: { userId: phoneUser.id }, select: { id: true, userId: true } })
      : null

    if (!targetParent && parentName && String(parentName).trim() !== "") {
      const school = await prisma.school.findUnique({ where: { id: user.schoolId! } })
      const account = await ensureSchoolUser({
        schoolId: user.schoolId!,
        phone: String(parentPhone).trim(),
        name: String(parentName).trim(),
        role: "PARENT",
        schoolName: school?.name,
        locale: (body.locale as string) === "fr" ? "fr" : "ar",
      })
      targetParent = await prisma.parent.findFirst({
        where: { userId: account.user.id },
        select: { id: true, userId: true },
      })
    }

    if (targetParent) {
      if (existingSp && existingSp.parentId !== targetParent.id) {
        await prisma.studentParent.delete({ where: { id: existingSp.id } })
      }
      const alreadyLinked = await prisma.studentParent.findFirst({
        where: { studentId: params.id, parentId: targetParent.id },
      })
      if (!alreadyLinked) {
        await prisma.studentParent.create({
          data: { schoolId: user.schoolId!, studentId: params.id, parentId: targetParent.id, relationship: "ولي أمر", isPrimary: true, receiveNotifications: true },
        })
      }
      if (parentName && String(parentName).trim() !== "" && phoneUser) {
        await prisma.user.update({ where: { id: targetParent.userId }, data: { name: String(parentName).trim() } })
      }
    } else if (existingSp) {
      // Phone-only update on the current primary parent.
      const link = await prisma.studentParent.findFirst({
        where: { id: existingSp.id },
        select: { parent: { select: { userId: true } } },
      })
      if (link) {
        const clash = await prisma.user.findUnique({
          where: { schoolId_phoneNormalized: { schoolId: user.schoolId!, phoneNormalized: normalized } },
        })
        if (clash && clash.id !== link.parent.userId) {
          return NextResponse.json({ error: "رقم الهاتف مستخدم لحساب آخر" }, { status: 400 })
        }
        const userData: Record<string, unknown> = {
          phone: String(parentPhone).trim(),
          phoneNormalized: normalized,
        }
        if (parentName !== undefined && parentName !== null && String(parentName).trim() !== "") {
          userData.name = String(parentName).trim()
        }
        await prisma.user.update({ where: { id: link.parent.userId }, data: userData })
      }
      await prisma.parent.update({ where: { id: existingSp.parentId }, data: { phone: String(parentPhone).trim() } })
    }
  }

  return NextResponse.json(updated)
}

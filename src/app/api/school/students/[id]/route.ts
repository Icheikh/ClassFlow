import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const student = await prisma.student.findFirst({
    where: { id: params.id, schoolId: user.schoolId },
    include: {
      enrollments: {
        include: { classroom: { include: { level: true, stream: true } }, academicYear: true },
        orderBy: { enrolledAt: "desc" },
      },
      studentParents: {
        include: { parent: { include: { user: { select: { name: true, email: true, phone: true } } } } },
      },
    },
  })
  if (!student) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  return NextResponse.json(student)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const student = await prisma.student.findFirst({ where: { id: params.id, schoolId: user.schoolId } })
  if (!student) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const body = await req.json()
  const { firstName, lastName, gender, birthDate, studentNumber, address, phone, isActive, parentName, parentPhone, parentEmail } = body

  if (studentNumber && studentNumber !== student.studentNumber) {
    const existing = await prisma.student.findFirst({
      where: { schoolId: user.schoolId, studentNumber, id: { not: params.id } },
    })
    if (existing) return NextResponse.json({ error: "رقم التسجيل موجود مسبقاً" }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.student.update({
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

    // Update parent info if provided
    if (parentName !== undefined || parentPhone !== undefined) {
      const existingSp = await tx.studentParent.findFirst({
        where: { studentId: params.id, isPrimary: true },
        include: { parent: true },
      })

      if (existingSp) {
        const updateData: any = {}
        if (parentName !== undefined) updateData.name = parentName
        if (parentPhone !== undefined) updateData.phone = parentPhone
        if (Object.keys(updateData).length > 0) {
          await tx.user.update({ where: { id: existingSp.parent.userId }, data: updateData })
          if (parentPhone !== undefined) {
            await tx.parent.update({ where: { id: existingSp.parentId }, data: { phone: parentPhone || null } })
          }
        }
      } else if (parentName) {
        const email = parentEmail || `${studentNumber || `parent-${params.id}`}@classflow.edu`
        const appUser = await tx.user.create({
          data: {
            email, name: parentName,
            phone: parentPhone || null,
            passwordHash: await bcrypt.hash("parent123", 10),
            mustChangePassword: true,
            role: "PARENT", schoolId: user.schoolId,
          },
        })
        const parent = await tx.parent.create({
          data: { schoolId: user.schoolId, userId: appUser.id, phone: parentPhone || null },
        })
        await tx.studentParent.create({
          data: { schoolId: user.schoolId, studentId: params.id, parentId: parent.id, relationship: "ولي أمر", isPrimary: true, receiveNotifications: true },
        })
      }
    }

    return s
  })

  return NextResponse.json(updated)
}

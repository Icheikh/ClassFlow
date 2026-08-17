import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const search = url.searchParams.get("search") || ""
  const classroomId = url.searchParams.get("classroomId")
  const status = url.searchParams.get("status") // "ACTIVE" or "INACTIVE"
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "50")
  const skip = (page - 1) * limit

  const where: any = { schoolId: user.schoolId }
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { studentNumber: { contains: search } },
      { phone: { contains: search } },
    ]
  }
  if (classroomId) {
    where.enrollments = { some: { classroomId, status: "ACTIVE" } }
  }
  if (status === "ACTIVE") where.isActive = true
  if (status === "INACTIVE") where.isActive = false

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        enrollments: {
          include: { classroom: { include: { level: true } }, academicYear: true },
          orderBy: { enrolledAt: "desc" },
        },
        studentParents: {
          include: { parent: { include: { user: { select: { name: true, email: true, phone: true } } } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.student.count({ where }),
  ])

  return NextResponse.json({ students, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const isLegacyRole = ["SUPERVISOR"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { firstName, lastName, gender, birthDate, studentNumber, address, phone, parentName, parentPhone, parentEmail } = body
  if (!firstName || !lastName) return NextResponse.json({ error: "الاسم الأول واسم العائلة مطلوبان" }, { status: 400 })

  if (studentNumber) {
    const existing = await prisma.student.findFirst({
      where: { schoolId: user.schoolId, studentNumber },
    })
    if (existing) return NextResponse.json({ error: "رقم التسجيل موجود مسبقاً" }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        schoolId: user.schoolId,
        firstName, lastName,
        gender: gender || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        studentNumber: studentNumber || null,
        address: address || null,
        phone: phone || null,
      },
    })

    if (parentName) {
      const email = parentEmail || `${studentNumber || `parent-${student.id}`}@classflow.edu`
      const appUser = await tx.user.create({
        data: {
          email,
          name: parentName,
          phone: parentPhone || null,
          passwordHash: await bcrypt.hash("parent123", 10),
          mustChangePassword: true,
          role: "PARENT",
          schoolId: user.schoolId,
        },
      })
      const parent = await tx.parent.create({
        data: { schoolId: user.schoolId, userId: appUser.id, phone: parentPhone || null },
      })
      await tx.studentParent.create({
        data: {
          schoolId: user.schoolId,
          studentId: student.id,
          parentId: parent.id,
          relationship: "ولي أمر",
          isPrimary: true,
          receiveNotifications: true,
        },
      })
    }

    return student
  })

  return NextResponse.json(result)
}

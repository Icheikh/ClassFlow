import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { normalizePhone } from "@/lib/phone"
import { ensureSchoolUser } from "@/lib/user-accounts"
import { createStudentSchema, parseOrError } from "@/lib/validation"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const search = url.searchParams.get("search") || ""
  const classroomId = url.searchParams.get("classroomId")
  const status = url.searchParams.get("status") // "ACTIVE" or "INACTIVE"
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "50")
  const skip = (page - 1) * limit

  const where: any = { schoolId: user.schoolId! }
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
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = parseOrError(createStudentSchema, body)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { firstName, lastName, gender, birthDate, address, phone, parentName, parentPhone } = parsed.data as typeof body & { firstName: string; lastName: string }

  // ولي الأمر يُعرَّف برقم الهاتف فقط — نفس الرقم = نفس الحساب لكل الأبناء.
  if (parentName?.trim() && !normalizePhone(parentPhone || "")) {
    return NextResponse.json({ error: "رقم هاتف ولي الأمر غير صالح" }, { status: 400 })
  }

  const student = await prisma.student.create({
    data: {
      schoolId: user.schoolId!,
      firstName, lastName,
      gender: gender || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      studentNumber: null,
      address: address || null,
      phone: phone || null,
    },
  })

  if (parentName?.trim() && parentPhone?.trim()) {
    const school = await prisma.school.findUnique({ where: { id: user.schoolId! } })
    const studentFullName = `${firstName} ${lastName}`
    const account = await ensureSchoolUser({
      schoolId: user.schoolId!,
      phone: parentPhone.trim(),
      name: parentName.trim(),
      role: "PARENT",
      schoolName: school?.name,
      locale: (body.locale as string) === "fr" ? "fr" : "ar",
      studentName: studentFullName,
    })
    const parent = await prisma.parent.findFirst({ where: { userId: account.user.id } })
    if (parent) {
      await prisma.studentParent.create({
        data: {
          schoolId: user.schoolId!,
          studentId: student.id,
          parentId: parent.id,
          relationship: "ولي أمر",
          isPrimary: true,
          receiveNotifications: true,
        },
      })
    }
  }

  return NextResponse.json(student)
}

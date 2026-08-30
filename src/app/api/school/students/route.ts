import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { sendCredentialsEmail, EmailLocale } from "@/lib/email"
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
  const isLegacyRole = ["SUPERVISOR"].includes(user?.role)
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS) && !isLegacyRole)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = parseOrError(createStudentSchema, body)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { firstName, lastName, gender, birthDate, address, phone, parentName, parentPhone, parentEmail } = parsed.data as typeof body & { firstName: string; lastName: string }

  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
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

    if (parentName) {
      const phoneDigits = (parentPhone || "").replace(/\D/g, "")
      let parentId: string | null = null
      if (phoneDigits) {
        const existingUser = await tx.user.findFirst({
          where: {
            schoolId: user.schoolId!,
            role: "PARENT",
            OR: [{ phone: parentPhone }, { phone: `+${phoneDigits}` }, { email: { contains: phoneDigits } }],
          },
          select: { id: true },
        })
        if (existingUser) {
          const existingParent = await tx.parent.findFirst({ where: { userId: existingUser.id }, select: { id: true } })
          if (existingParent) parentId = existingParent.id
        }
      }
      if (parentId) {
        await tx.studentParent.create({
          data: {
            schoolId: user.schoolId!,
            studentId: student.id,
            parentId,
            relationship: "ولي أمر",
            isPrimary: true,
            receiveNotifications: true,
          },
        })
      } else {
        const school = await tx.school.findUnique({ where: { id: user.schoolId! }, select: { slug: true } })
        const schoolSlug = school?.slug || "school"
        const email = parentEmail || (phoneDigits ? `p${phoneDigits}@${schoolSlug}.classflow` : `parent-${student.id}@${schoolSlug}.classflow`)
        const rawPassword = phoneDigits || "parent123"
        const appUser = await tx.user.create({
          data: {
            email,
            name: parentName,
            phone: parentPhone || null,
            passwordHash: await bcrypt.hash(rawPassword, 10),
            mustChangePassword: false,
            role: "PARENT",
            schoolId: user.schoolId!,
          },
        })
        const parent = await tx.parent.create({
          data: { schoolId: user.schoolId!, userId: appUser.id, phone: parentPhone || null },
        })
        await tx.studentParent.create({
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

    return student
  })

  if (parentName && parentEmail) {
    const school = await prisma.school.findUnique({ where: { id: user.schoolId } })
    sendCredentialsEmail({
      to: parentEmail,
      name: parentName,
      email: parentEmail,
      password: "parent123",
      locale: ((body.locale as string) === "fr" ? "fr" : "ar") as EmailLocale,
      schoolName: school?.name || undefined,
    }).catch((e) => console.error("[students] parent credential email failed:", e))
  }

  return NextResponse.json(result)
}

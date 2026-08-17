import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { getAdminSession } from "../guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await getAdminSession()
  if ("error" in auth) return auth.error

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          students: true,
          teachers: true,
        },
      },
      users: {
        where: { role: "SCHOOL_ADMIN" },
        select: { id: true, email: true, name: true, isActive: true },
        take: 1,
      },
    },
  })

  return NextResponse.json(
    schools.map((school) => ({
      id: school.id,
      name: school.name,
      slug: school.slug,
      email: school.email,
      phone: school.phone,
      address: school.address,
      subscriptionStatus: school.subscriptionStatus,
      billingStudentCount: school.billingStudentCount,
      isActive: school.isActive,
      createdAt: school.createdAt.toISOString(),
      userCount: school._count.users,
      studentCount: school._count.students,
      teacherCount: school._count.teachers,
      admin: school.users[0]
        ? { email: school.users[0].email, name: school.users[0].name, isActive: school.users[0].isActive }
        : null,
    }))
  )
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug
}

async function makeUniqueSlug(base: string) {
  const fallback = base.length >= 3 ? base : `school-${Date.now().toString(36)}`
  let candidate = fallback
  let counter = 1
  while (await prisma.school.findUnique({ where: { slug: candidate } })) {
    candidate = `${fallback}-${counter}`
    counter += 1
  }
  return candidate
}

export async function POST(req: NextRequest) {
  const auth = await getAdminSession()
  if ("error" in auth) return auth.error

  const body = await req.json()
  const { name, slug, address, phone, email, adminName, adminEmail, password, subscriptionStatus } = body

  if (!name || !adminEmail || !adminName) {
    return NextResponse.json({ error: "اسم المدرسة، اسم المدير والبريد الإلكتروني مطلوبون" }, { status: 400 })
  }

  const baseSlug = slugify(slug || name)
  const uniqueSlug = await makeUniqueSlug(baseSlug)

  const existingEmail = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingEmail) {
    return NextResponse.json({ error: "البريد الإلكتروني لمدير المدرسة موجود مسبقاً" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password || "password123", 10)

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name,
        slug: uniqueSlug,
        address: address || null,
        phone: phone || null,
        email: email || null,
        subscriptionStatus: subscriptionStatus || "TRIAL",
        billingStudentCount: 0,
      },
    })

    const admin = await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: "SCHOOL_ADMIN",
        schoolId: school.id,
        mustChangePassword: !password || !password.trim(),
      },
    })

    const permissionRecords = await tx.permission.findMany()
    await tx.userPermission.createMany({
      data: permissionRecords.map((p) => ({
        userId: admin.id,
        permissionId: p.id,
        grantedBy: admin.id,
      })),
    })

    return { school, admin }
  })

  return NextResponse.json(
    {
      id: result.school.id,
      name: result.school.name,
      slug: result.school.slug,
      adminEmail: result.admin.email,
    },
    { status: 201 }
  )
}
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { getAdminSession } from "../guard"
import { normalizePhone } from "@/lib/phone"
import { sendAccountInvite } from "@/lib/otp"
import { ensureSystemTemplates } from "@/lib/notification-templates"

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
        select: { id: true, name: true, phone: true, isActive: true, status: true },
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
        ? { phone: school.users[0].phone, name: school.users[0].name, isActive: school.users[0].isActive, status: (school.users[0] as { status?: string }).status || "ACTIVE" }
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
  const { name, slug, address, phone, email, adminName, adminEmail, adminPhone, password, subscriptionStatus } = body

  if (!name || !adminName) {
    return NextResponse.json({ error: "اسم المدرسة واسم المدير مطلوبان" }, { status: 400 })
  }
  const adminPhoneNormalized = normalizePhone(adminPhone || "")
  if (!adminPhoneNormalized) {
    return NextResponse.json({ error: "رقم هاتف المدير مطلوب وغير صالح" }, { status: 400 })
  }

  const baseSlug = slugify(slug || name)
  const uniqueSlug = await makeUniqueSlug(baseSlug)

  if (adminEmail) {
    const existingEmail = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (existingEmail) {
      return NextResponse.json({ error: "البريد الإلكتروني لمدير المدرسة موجود مسبقاً" }, { status: 400 })
    }
  }

  const hasPassword = password && password.trim()
  const passwordHash = await bcrypt.hash(
    hasPassword ? password : randomBytes(24).toString("hex"),
    10
  )

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
        email: adminEmail || null,
        passwordHash,
        name: adminName,
        phone: String(adminPhone).trim(),
        phoneNormalized: adminPhoneNormalized,
        // بكلمة مرور من المنصة = نشط فوراً، وبدونها = دعوة تفعيل عبر الهاتف.
        status: hasPassword ? "ACTIVE" : "INVITED",
        role: "SCHOOL_ADMIN",
        schoolId: school.id,
        mustChangePassword: !hasPassword,
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

  // System notification templates so the school never starts from zero.
  await ensureSystemTemplates(result.school.id).catch((e) =>
    console.error("[admin] system templates seed failed:", e)
  )

  if (!hasPassword) {
    sendAccountInvite({
      toPhone: String(adminPhone).trim(),
      name: adminName,
      schoolName: name,
      role: "SCHOOL_ADMIN",
    }).catch((e) => console.error("[admin] director invite failed:", e))
  }

  return NextResponse.json(
    {
      id: result.school.id,
      name: result.school.name,
      slug: result.school.slug,
      adminPhone: result.admin.phone,
      invited: !hasPassword,
    },
    { status: 201 }
  )
}
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { normalizePhone } from "@/lib/phone"
import { ensureSchoolUser } from "@/lib/user-accounts"

export const dynamic = "force-dynamic"

type ImportRow = {
  firstName: string
  lastName: string
  gender?: string
  birthDate?: string
  phone?: string
  address?: string
  parentName?: string
  parentPhone?: string
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""))
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim())
    const row: any = {}
    headers.forEach((h, i) => { row[h] = values[i] || "" })
    return {
      firstName: row.firstname || row.first_name || row["الاسم"] || "",
      lastName: row.lastname || row.last_name || row["اللقب"] || "",
      gender: row.gender || row["الجنس"] || "",
      birthDate: row.birthdate || row.birth_date || row["تاريخ_الميلاد"] || "",
      phone: row.phone || row["هاتف"] || "",
      address: row.address || row["العنوان"] || "",
      parentName: row.parentname || row.parent_name || row["اسم_ولي_الأمر"] || "",
      parentPhone: row.parentphone || row.parent_phone || row["هاتف_ولي_الأمر"] || "",
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user
    if (!user?.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty or has no valid rows" }, { status: 400 })
    }

    const schoolId = user.schoolId!
    const school = await prisma.school.findUnique({ where: { id: schoolId } })
    const results: { created: number; skipped: number; errors: { row: number; error: string }[] } = {
      created: 0,
      skipped: 0,
      errors: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.firstName || !row.lastName) {
        results.errors.push({ row: i + 2, error: "Missing firstName or lastName" })
        continue
      }

      try {
        const student = await prisma.student.create({
          data: {
            schoolId,
            firstName: row.firstName,
            lastName: row.lastName,
            gender: row.gender || null,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            phone: row.phone || null,
            address: row.address || null,
            studentNumber: null,
          },
        })

        if (row.parentName && row.parentPhone) {
          const normalizedPhone = normalizePhone(row.parentPhone)
          if (normalizedPhone) {
            const studentFullName = `${row.firstName || ""} ${row.lastName || ""}`.trim()
            const account = await ensureSchoolUser({
              schoolId,
              phone: normalizedPhone,
              name: row.parentName,
              role: "PARENT",
              schoolName: school?.name,
              locale: "ar",
              studentName: studentFullName || undefined,
            })
            const parent = await prisma.parent.findFirst({ where: { userId: account.user.id } })
            if (parent) {
              await prisma.studentParent.create({
                data: {
                  schoolId,
                  studentId: student.id,
                  parentId: parent.id,
                  relationship: "ولي أمر",
                  isPrimary: true,
                  receiveNotifications: true,
                },
              })
            }
          }
        }

        results.created++
      } catch (e: any) {
        results.errors.push({ row: i + 2, error: e.message || "Unknown error" })
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("POST /api/school/students/import failed", error)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}

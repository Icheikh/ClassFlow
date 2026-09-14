/**
 * تصفير كلمات مرور أساتذة مدرسة الفتح + إصلاح تطبيع الهواتف.
 * Run: node scripts/reset-alfath-teachers.js
 *
 * يطبع لكل أستاذ: رقم الهاتف الذي يُدخل عند الدخول + كلمة المرور الجديدة.
 * (يعمل على قاعدة البيانات التي يشير إليها .env)
 */
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

const NEW_PASSWORD = "Teacher123"

/** نفس منطق normalizePhone في src/lib/phone.ts تماماً. */
function normalizePhone(raw) {
  if (typeof raw !== "string") return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("222") && digits.length === 11) return digits.slice(3)
  if (digits.length === 8) return digits
  if (digits.length >= 7 && digits.length <= 15) return digits
  return null
}

async function main() {
  console.log("🔧 Resetting مدرسة الفتح teachers...\n")

  const school =
    (await prisma.school.findUnique({ where: { slug: "alfath" } })) ||
    (await prisma.school.findFirst({ where: { name: { contains: "الفتح" } } }))

  if (!school) {
    console.log("❌ مدرسة الفتح غير موجودة في هذه القاعدة.")
    return
  }
  console.log(`🏫 School: ${school.name} (${school.slug})\n`)

  const teachers = await prisma.user.findMany({
    where: { schoolId: school.id, role: "TEACHER" },
    select: { id: true, name: true, phone: true, phoneNormalized: true, isActive: true, status: true },
    orderBy: { name: "asc" },
  })

  if (teachers.length === 0) {
    console.log("❌ لا يوجد أي حساب أستاذ في مدرسة الفتح.")
    return
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10)

  for (const t of teachers) {
    const fixed = t.phone ? normalizePhone(t.phone) : null
    if (!fixed) {
      console.log(`⚠️ ${t.name} — هاتفه (${t.phone}) غير صالح، تُرك كما هو. صححه من /school/teachers ثم أعد التشغيل.`)
      continue
    }
    await prisma.user.update({
      where: { id: t.id },
      data: {
        passwordHash,
        phoneNormalized: fixed,
        isActive: true,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    })
    console.log(`✅ ${t.name}`)
    console.log(`   الهاتف للدخول: ${fixed} (أو ${t.phone})`)
    console.log(`   كلمة المرور الجديدة: ${NEW_PASSWORD}\n`)
  }

  console.log("🎉 Done! Login: رقم الهاتف + كلمة المرور (وليس الإيميل).")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

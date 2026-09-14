/**
 * تحديث بيانات الدخول لعمال مدرسة الفتح:
 *  المدير = 50505001 ثم الأساتذة 50505002، 50505003... 
 *  كلمة سر موحدة: pass1234
 * Run: /usr/local/bin/node scripts/reset-alfath-5050.js
 */
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

const NEW_PASSWORD = "pass1234"
const BASE = 50505000 // +1 للمدير، +2 للأول بعده...

async function main() {
  const school =
    (await prisma.school.findUnique({ where: { slug: "alfath" } })) ||
    (await prisma.school.findFirst({ where: { name: { contains: "الفتح" } } }))

  if (!school) {
    console.log("❌ مدرسة الفتح غير موجودة.")
    return
  }
  console.log(`🏫 ${school.name} (${school.slug})`)

  // المدير أولاً، ثم الأساتذة حسب الأقدمية (createdAt) لثبات الترقيم
  const staff = await prisma.user.findMany({
    where: {
      schoolId: school.id,
      role: { in: ["SCHOOL_ADMIN", "STAFF", "ACCOUNTANT", "SUPERVISOR", "TEACHER"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  })

  // رتّب: SCHOOL_ADMIN أولاً ثم البقية حسب createdAt
  const roleOrder = { SCHOOL_ADMIN: 0, STAFF: 1, ACCOUNTANT: 2, SUPERVISOR: 3, TEACHER: 4 }
  staff.sort((a, b) => {
    const ra = roleOrder[a.role] ?? 9
    const rb = roleOrder[b.role] ?? 9
    if (ra !== rb) return ra - rb
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  if (staff.length === 0) {
    console.log("❌ لا يوجد عمال في مدرسة الفتح.")
    return
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10)
  console.log(`👥 عدد الحسابات: ${staff.length} — كلمة السر الموحدة: ${NEW_PASSWORD}\n`)

  let seq = 1
  for (const u of staff) {
    const normalized = String(BASE + seq).padStart(8, "0") // 50505001...
    const phone = `+222${normalized}`
    await prisma.user.update({
      where: { id: u.id },
      data: {
        phone,
        phoneNormalized: normalized,
        passwordHash,
        status: "ACTIVE",
        isActive: true,
        mustChangePassword: false,
      },
    })
    console.log(`✅ ${normalized} ← ${u.role} | ${u.name} (${u.email || "بدون إيميل"})`)
    seq++
  }

  console.log("\n🎉 تم! الدخول برقم الهاتف + كلمة السر pass1234")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

/**
 * Script to reset passwords for مدرسة الفتح التجريبية accounts on Supabase
 * Run: node scripts/reset-alfath-passwords.js
 */
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

/**
 * نفس منطق normalizePhone في src/lib/phone.ts تماماً:
 * - "+22247155149" ← digits "22247155149" (11 رقم تبدأ بـ 222) ← "47155149"
 * - "47155149" ← 8 أرقام ← "47155149"
 * تحذير: التخزين القديم الخاطئ كان phone.replace("+","") أي "22247155149"
 * وهو مستحيل المطابقة عند الدخول — سبب خطأ "رقم الهاتف أو كلمة المرور غير صحيحة".
 */
function normalizePhone(raw) {
  if (typeof raw !== "string") return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("222") && digits.length === 11) return digits.slice(3)
  if (digits.length === 8) return digits
  if (digits.length >= 7 && digits.length <= 15) return digits
  return null
}

const accounts = [
  {
    email: "admin@alfath.edu",
    name: "عمر سعيد (مدير)",
    phone: "+22247155148",
    newPassword: "Admin123",
    role: "SCHOOL_ADMIN",
  },
  {
    email: "teacher@alfath.edu",
    name: "فاطمة بنت محمد (أستاذة)",
    phone: "+22247155149",
    newPassword: "Teacher123",
    role: "TEACHER",
  },
]

async function main() {
  console.log("🔧 Resetting passwords for مدرسة الفتح التجريبية...\n")

  for (const account of accounts) {
    const user = await prisma.user.findUnique({
      where: { email: account.email },
    })

    if (!user) {
      console.log(`❌ User not found: ${account.email}`)
      continue
    }

    const passwordHash = await bcrypt.hash(account.newPassword, 10)
    const phoneNormalized = normalizePhone(account.phone)
    if (!phoneNormalized) {
      console.log(`❌ Invalid phone, skipped: ${account.email} (${account.phone})`)
      continue
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        phone: account.phone,
        phoneNormalized,
        mustChangePassword: true,
        isActive: true,
      },
    })

    console.log(`✅ ${account.name}`)
    console.log(`   Phone: ${account.phone}`)
    console.log(`   Normalized: ${phoneNormalized} (أدخل هذا أو ${account.phone} عند الدخول)`)
    console.log(`   Password: ${account.newPassword}`)
    console.log(`   Role: ${account.role}\n`)
  }

  console.log("🎉 Done! All passwords have been reset.")
  console.log("\n📱 Login URL: http://localhost:3000/auth/login")
  console.log("\n⚠️  Login uses PHONE NUMBER + password (not email)")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

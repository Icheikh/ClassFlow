import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session) {
    redirect("/auth/login")
  }

  if (user?.role !== "SUPER_ADMIN") {
    redirect("/school")
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm text-blue-600">مدير المنصة</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">لوحة المنصة قيد التوسعة</h1>
        <p className="mt-3 text-gray-600">
          تم تفعيل صفحة دخول مستقرة لمدير المنصة حتى لا يتعطل تسجيل الدخول. إدارة المدارس والاشتراكات ستبنى في مرحلة المنصة.
        </p>

        <div className="mt-8 rounded-xl bg-gray-50 p-5">
          <p className="font-medium text-gray-900">الحالة الحالية</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>الدخول يعمل لهذا الدور دون تحويل إلى صفحة مفقودة.</li>
            <li>يمكن استخدام هذه الصفحة كنقطة هبوط مستقرة مؤقتًا.</li>
            <li>المرحلة التالية لهذا الدور هي بناء إدارة المدارس والاشتراكات.</li>
          </ul>
        </div>

        <div className="mt-6">
          <Link href="/auth/login" className="text-sm font-medium text-blue-700 hover:underline">
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    </main>
  )
}

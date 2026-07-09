import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function ParentPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session) {
    redirect("/auth/login")
  }

  if (user?.role !== "PARENT") {
    redirect("/school")
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm text-green-600">ولي الأمر</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">بوابة ولي الأمر جاهزة كنقطة دخول مستقرة</h1>
        <p className="mt-3 text-gray-600">
          هذه الصفحة تمنع سقوط حساب ولي الأمر في مسار فارغ. المرحلة القادمة ستربط هنا الغياب والرسوم والنتائج والإشعارات.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">الغياب</p>
            <p className="mt-2 font-medium text-gray-900">سيظهر هنا سجل غياب الأبناء</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">النتائج</p>
            <p className="mt-2 font-medium text-gray-900">سيظهر هنا آخر نشر للنتائج</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">الإشعارات</p>
            <p className="mt-2 font-medium text-gray-900">سيظهر هنا مركز التنبيهات المرسلة للولي</p>
          </div>
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

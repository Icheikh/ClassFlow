"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import { redirect } from "next/navigation"
import { ClipboardCheck, BookOpen, GraduationCap, Users, Loader2 } from "lucide-react"
import { roleLabels } from "@/lib/roles"

type Stats = {
  students: number
  teachers: number
  classrooms: number
  todayAbsences: number
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetch("/api/dashboard/stats")
        .then((r) => r.json())
        .then(setStats)
        .finally(() => setLoading(false))
    }
  }, [session])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!session) {
    redirect("/auth/login")
  }

  const user = session.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">ClassFlow</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.name}</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {roleLabels[user.role] || user.role}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <DashboardCard
            title="الطلاب"
            value={loading ? "—" : String(stats?.students ?? "—")}
            icon={<Users className="h-6 w-6 text-blue-600" />}
            color="bg-blue-50"
          />
          <DashboardCard
            title="المدرسين"
            value={loading ? "—" : String(stats?.teachers ?? "—")}
            icon={<Users className="h-6 w-6 text-green-600" />}
            color="bg-green-50"
          />
          <DashboardCard
            title="الأقسام"
            value={loading ? "—" : String(stats?.classrooms ?? "—")}
            icon={<BookOpen className="h-6 w-6 text-purple-600" />}
            color="bg-purple-50"
          />
          <DashboardCard
            title="الغياب اليوم"
            value={loading ? "—" : String(stats?.todayAbsences ?? "—")}
            icon={<ClipboardCheck className="h-6 w-6 text-red-600" />}
            color="bg-red-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">الدفاتر الرقمية</h2>
            <div className="space-y-3">
              <QuickLink
                href="/teacher/attendance"
                label="دفتر الغياب"
                desc="تسجيل الغياب وإرسال الإشعارات"
              />
              <QuickLink
                href="/teacher/lessons"
                label="دفتر الدروس"
                desc="تسجيل عناوين الدروس والواجبات"
              />
              <QuickLink
                href="/teacher/grades"
                label="دفتر النقاط"
                desc="إدخال النتائج وحساب المعدلات"
              />
              <QuickLink
                href="/teacher"
                label="لوحة الأستاذ"
                desc="واجهة كاملة للتدريس"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">معلومات النظام</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">اسم المدرسة</span>
                <span className="font-medium">{user.school?.name || "المنصة"}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">دورك</span>
                <span className="font-medium">{roleLabels[user.role]}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">البريد</span>
                <span className="font-medium">{user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function DashboardCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string
  label: string
  desc: string
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div>
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <span className="text-gray-400">←</span>
    </a>
  )
}

export default function DashboardPage() {
  return (
    <SessionProvider>
      <DashboardContent />
    </SessionProvider>
  )
}
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { dashboardApi, type DashboardStats } from "@/lib/api"
import { Card } from "@/components/ui"
import { Users, BookOpen, GraduationCap, ClipboardCheck, TrendingUp } from "lucide-react"

export default function SchoolDashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const user = session?.user as any

  useEffect(() => {
    dashboardApi.stats().then(({ data }) => {
      if (data) setStats(data)
    })
  }, [])

  const cards = [
    { label: "الطلاب", value: stats?.students ?? 0, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "التسجيلات النشطة", value: stats?.activeEnrollments ?? 0, icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { label: "الأساتذة", value: stats?.teachers ?? 0, icon: GraduationCap, color: "bg-purple-50 text-purple-600" },
    { label: "الأقسام", value: stats?.classrooms ?? 0, icon: BookOpen, color: "bg-orange-50 text-orange-600" },
    { label: "الغياب اليوم", value: stats?.todayAbsences ?? 0, icon: ClipboardCheck, color: "bg-red-50 text-red-600" },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-gray-500 mt-1">{user?.school?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h2 className="text-lg font-semibold mb-4">إعدادات المدرسة</h2>
          <div className="space-y-3">
            <QuickLink href="/school/academic-years" label="السنة الدراسية والفصول" />
            <QuickLink href="/school/levels" label="المستويات والشعب" />
            <QuickLink href="/school/classrooms" label="الأقسام" />
            <QuickLink href="/school/subjects" label="المواد" />
            <QuickLink href="/school/coefficients" label="الضوارب" />
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-semibold mb-4">الموظفون والطلاب</h2>
          <div className="space-y-3">
            <QuickLink href="/school/teachers" label="الأساتذة" />
            <QuickLink href="/school/assignments" label="تعيين الأساتذة" />
            <QuickLink href="/school/students" label="الطلاب" />
            <QuickLink href="/school/settings" label="إعدادات المدرسة" />
          </div>
        </Card>
      </div>
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 font-medium">
      {label}
    </a>
  )
}
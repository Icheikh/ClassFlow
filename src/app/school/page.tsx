"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { dashboardApi, type DashboardStats } from "@/lib/api"
import { Card } from "@/components/ui"
import { Users, BookOpen, GraduationCap, ClipboardCheck, TrendingUp } from "lucide-react"

export default function SchoolDashboardPage() {
  const tSchool = useTranslations("school")
  const tDashboard = useTranslations("dashboard")
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const user = session?.user as any

  useEffect(() => {
    dashboardApi.stats().then(({ data }) => {
      if (data) setStats(data)
    })
  }, [])

  const cards = [
    { label: tSchool("students"), value: stats?.students ?? 0, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: tDashboard("activeEnrollments"), value: stats?.activeEnrollments ?? 0, icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { label: tSchool("teachers"), value: stats?.teachers ?? 0, icon: GraduationCap, color: "bg-purple-50 text-purple-600" },
    { label: tSchool("classrooms"), value: stats?.classrooms ?? 0, icon: BookOpen, color: "bg-orange-50 text-orange-600" },
    { label: tDashboard("todayAbsences"), value: stats?.todayAbsences ?? 0, icon: ClipboardCheck, color: "bg-red-50 text-red-600" },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{tSchool("dashboard")}</h1>
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
          <h2 className="text-lg font-semibold mb-4">{tDashboard("schoolSetup")}</h2>
          <div className="space-y-3">
            <QuickLink href="/school/academic-years" label={tDashboard("academicYearTerms")} />
            <QuickLink href="/school/levels" label={tSchool("levels")} />
            <QuickLink href="/school/classrooms" label={tSchool("classrooms")} />
            <QuickLink href="/school/subjects" label={tSchool("subjects")} />
            <QuickLink href="/school/subjects" label={tSchool("subjects")} />
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-semibold mb-4">{tDashboard("people")}</h2>
          <div className="space-y-3">
            <QuickLink href="/school/teachers" label={tSchool("teachers")} />
            <QuickLink href="/school/teachers" label={tDashboard("teacherAssignments")} />
            <QuickLink href="/school/students" label={tSchool("students")} />
            <QuickLink href="/school/settings" label={tDashboard("schoolSettings")} />
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

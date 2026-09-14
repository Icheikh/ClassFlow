"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Card, LoadingPage } from "@/components/ui"
import { CalendarCheck, GraduationCap, Receipt, AlertTriangle, TrendingUp, User } from "lucide-react"
import toast from "react-hot-toast"

type Child = {
  id: string
  firstName: string
  lastName: string
  studentNumber: string | null
  gender: string | null
  enrollment: {
    id: string
    classroom: { id: string; name: string; level: string; stage: string; stream: string | null }
  } | null
}

type AttendanceStat = {
  studentId: string
  total: number
  present: number
  absent: number
  late: number
  rate: number
}

type InvoiceSummary = {
  total: number
  paid: number
  remaining: number
}

type ChildGrades = {
  studentId: string
  average: number | null
  subjects: { subjectName: string; average: number | null }[]
}

export default function ParentDashboardPage() {
  const t = useTranslations("parentPage")
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<Child[]>([])
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([])
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null)
  const [gradesSummary, setGradesSummary] = useState<ChildGrades[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [childrenRes, attendanceRes, invoicesRes, gradesRes] = await Promise.all([
          api.get<{ children: Child[] }>("/api/parent/children"),
          api.get<{ stats: AttendanceStat[] }>("/api/parent/attendance"),
          api.get<{ summary: InvoiceSummary }>("/api/parent/invoices"),
          api.get<{ children: ChildGrades[] }>("/api/parent/grades"),
        ])
        if (childrenRes.error) setError(childrenRes.error)
        if (childrenRes.data) setChildren(childrenRes.data.children)
        if (attendanceRes.data) setAttendanceStats(attendanceRes.data.stats)
        if (invoicesRes.data) setInvoiceSummary(invoicesRes.data.summary)
        if (gradesRes.data) setGradesSummary(gradesRes.data.children)
      } catch {
        setError("Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) return <LoadingPage />
  if (error) return <div className="text-center py-12"><p className="text-red-500">{error}</p></div>

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-6">
        <p className="text-sm font-medium text-green-700">{t("role")}</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{t("welcome")}</h1>
        <p className="mt-2 text-sm text-gray-600">{t("welcomeSubtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <div className="flex items-center gap-2 text-blue-600">
            <User className="h-5 w-5" />
            <span className="text-sm font-medium">{t("myChildren")}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{children.length}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-green-600">
            <Receipt className="h-5 w-5" />
            <span className="text-sm font-medium">{t("paidAmount")}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{invoiceSummary?.paid?.toLocaleString() || 0} MRU</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{t("remainingAmount")}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{invoiceSummary?.remaining?.toLocaleString() || 0} MRU</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">{t("myChildren")}</h2>
          </div>
          {children.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t("noChildren")}</p>
          ) : (
            <div className="space-y-3">
              {children.map((child) => {
                const stats = attendanceStats.find((s) => s.studentId === child.id)
                const grades = gradesSummary.find((g) => g.studentId === child.id)
                return (
                  <div key={child.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{child.firstName} {child.lastName}</p>
                        {child.enrollment && (
                          <p className="mt-1 text-sm text-gray-500">
                            {child.enrollment.classroom.name} — {child.enrollment.classroom.stage} {child.enrollment.classroom.level}
                          </p>
                        )}
                      </div>
                      {stats && (
                        <Badge variant={stats.rate >= 90 ? "success" : stats.rate >= 70 ? "warning" : "danger"}>
                          {stats.rate}%
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-green-50 py-2">
                        <p className="font-bold text-green-700">{stats?.present || 0}</p>
                        <p className="text-green-600">{t("present")}</p>
                      </div>
                      <div className="rounded-lg bg-red-50 py-2">
                        <p className="font-bold text-red-700">{stats?.absent || 0}</p>
                        <p className="text-red-600">{t("absent")}</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 py-2">
                        <p className="font-bold text-blue-700">{grades?.average?.toFixed(1) || "—"}</p>
                        <p className="text-blue-600">{t("average")}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">{t("quickLinks")}</h2>
            </div>
            <div className="space-y-2">
              <Link href="/parent/attendance" className="block rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <CalendarCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">{t("attendanceTitle")}</p>
                    <p className="text-sm text-gray-500">{t("attendanceDesc")}</p>
                  </div>
                </div>
              </Link>
              <Link href="/parent/grades" className="block rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{t("resultsTitle")}</p>
                    <p className="text-sm text-gray-500">{t("resultsDesc")}</p>
                  </div>
                </div>
              </Link>
              <Link href="/parent/invoices" className="block rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">{t("invoicesTitle")}</p>
                    <p className="text-sm text-gray-500">{t("invoicesDesc")}</p>
                  </div>
                </div>
              </Link>
            </div>
          </Card>

          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">{t("attendanceSummary")}</h2>
            </div>
            {attendanceStats.length === 0 ? (
              <p className="text-sm text-gray-500">{t("noAttendanceData")}</p>
            ) : (
              <div className="space-y-3">
                {attendanceStats.map((stat) => {
                  const child = children.find((c) => c.id === stat.studentId)
                  return (
                    <div key={stat.studentId} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                      <div>
                        <p className="font-medium">{child?.firstName} {child?.lastName}</p>
                        <p className="text-xs text-gray-500">{t("lessonsRecorded", { count: stat.total })}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600">{stat.present} {t("present")}</span>
                        <span className="text-red-600">{stat.absent} {t("absent")}</span>
                        <span className="text-amber-600">{stat.late} {t("late")}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

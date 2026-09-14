"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Card, LoadingPage, Select } from "@/components/ui"
import { CalendarCheck, AlertTriangle } from "lucide-react"

type Child = { id: string; firstName: string; lastName: string }
type Absence = {
  id: string
  date: string
  status: string
  student: { id: string; firstName: string; lastName: string }
  classroom: string
  subject: string | null
}
type AttendanceStat = {
  studentId: string
  total: number
  present: number
  absent: number
  late: number
  rate: number
}

export default function ParentAttendancePage() {
  const t = useTranslations("parentPage")
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState("")
  const [absences, setAbsences] = useState<Absence[]>([])
  const [stats, setStats] = useState<AttendanceStat[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error: apiError } = await api.get<{ children: Child[] }>("/api/parent/children")
      if (apiError) { setError(apiError); setLoading(false); return }
      if (data?.children) {
        setChildren(data.children)
        if (data.children[0]) setSelectedChild(data.children[0].id)
      }
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    async function load() {
      const { data } = await api.get<{ recentAbsences: Absence[]; stats: AttendanceStat[] }>(
        `/api/parent/attendance?studentId=${selectedChild}`
      )
      if (data) {
        setAbsences(data.recentAbsences)
        setStats(data.stats)
      }
    }
    void load()
  }, [selectedChild])

  if (loading) return <LoadingPage />
  if (error) return <div className="text-center py-12"><p className="text-red-500">{error}</p></div>

  const currentStats = stats.find((s) => s.studentId === selectedChild)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("attendanceHeading")}</h1>
        <p className="text-sm text-gray-500">{t("attendanceSubtitle")}</p>
      </div>

      {children.length > 1 && (
        <Card padding="md">
          <Select
            label={t("selectChild")}
            value={selectedChild}
            onChange={setSelectedChild}
            options={children.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
          />
        </Card>
      )}

      {currentStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card padding="md">
            <p className="text-sm text-gray-500">{t("attendanceRate")}</p>
            <p className={`mt-1 text-3xl font-bold ${currentStats.rate >= 90 ? "text-green-600" : currentStats.rate >= 70 ? "text-amber-600" : "text-red-600"}`}>
              {currentStats.rate}%
            </p>
          </Card>
          <Card padding="md">
            <p className="text-sm text-gray-500">{t("totalLessons")}</p>
            <p className="mt-1 text-3xl font-bold">{currentStats.total}</p>
          </Card>
          <Card padding="md">
            <p className="text-sm text-gray-500">{t("daysPresent")}</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{currentStats.present}</p>
          </Card>
          <Card padding="md">
            <p className="text-sm text-gray-500">{t("daysAbsent")}</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{currentStats.absent}</p>
          </Card>
        </div>
      )}

      <Card padding="lg">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold">{t("absenceLog")}</h2>
        </div>
        {absences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
            <CalendarCheck className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">{t("noAbsences")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-gray-500">
                  <th className="pb-3 font-medium">{t("date")}</th>
                  <th className="pb-3 font-medium">{t("subject")}</th>
                  <th className="pb-3 font-medium">{t("classroom")}</th>
                  <th className="pb-3 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((abs) => (
                  <tr key={abs.id} className="border-b last:border-0">
                    <td className="py-3">
                      {new Intl.DateTimeFormat("ar-MR", { dateStyle: "medium" }).format(new Date(abs.date))}
                    </td>
                    <td className="py-3">{abs.subject || "—"}</td>
                    <td className="py-3">{abs.classroom}</td>
                    <td className="py-3">
                      <Badge variant="danger">{t("absent")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

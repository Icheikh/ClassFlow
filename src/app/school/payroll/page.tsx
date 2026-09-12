"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, ConfirmModal, LoadingPage } from "@/components/ui"
import toast from "react-hot-toast"
import { addUtcDays, formatDateOnly, getWeekStartDate } from "@/lib/date"
import { Wallet, Clock, Calendar, TrendingUp, AlertTriangle, ChevronRight, ChevronLeft } from "lucide-react"

type PayrollAssignRow = {
  id: string
  teacherId: string
  teacherName: string
  subject: string
  classroom: string
  level: string
  stream: string | null
  hourlyRate: number | null
  weeklyHours: number | null
  confirmedHours: number
  compensationHours: number
  totalHours: number
  expectedHours: number
  entryCount: number
  earnings: number | null
  unassigned?: boolean
}

type PayrollRecord = {
  teacherId: string
  status: string
  paidAt: string | null
}

type PayrollTeacher = {
  teacherId: string
  name: string
  assignments: PayrollAssignRow[]
  totalHours: number
  totalEarnings: number
}

type PayrollData = {
  teachers: PayrollTeacher[]
  rows: PayrollAssignRow[]
  totalEarnings: number
  grandTotalHours: number
  totalTeachers: number
  assignmentsWithoutRate: number
  unassignedCount: number
  records: PayrollRecord[]
  period: { type: "week" | "month"; value: string }
  rangeLabel: string
  weekStart: string
  weekEnd: string
}

export default function PayrollPage() {
  const t = useTranslations("payrollPage")
  const tCommon = useTranslations("common")
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"week" | "month">("month")
  const [weekStart, setWeekStart] = useState(() => formatDateOnly(getWeekStartDate()))
  const [month, setMonth] = useState(() => formatDateOnly(getWeekStartDate()).slice(0, 7))
  const [payingId, setPayingId] = useState<string | null>(null)
  const [confirmPay, setConfirmPay] = useState<PayrollTeacher | null>(null)

  const query = mode === "month" ? `month=${month}` : `weekStart=${weekStart}`

  async function load() {
    setLoading(true)
    const { data: response } = await api.get<PayrollData>(`/api/school/payroll?${query}`)
    if (response) setData(response)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      const { data: response } = await api.get<PayrollData>(`/api/school/payroll?${query}`)
      if (!cancelled) {
        if (response) setData(response)
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function markPaid(teacher: PayrollTeacher, action: "pay" | "reopen") {
    setPayingId(teacher.teacherId)
    const { error } = await api.post("/api/school/payroll/pay", {
      teacherId: teacher.teacherId,
      period: data?.period.value || month,
      action,
      totalHours: teacher.totalHours,
      totalEarnings: teacher.totalEarnings,
    })
    if (error) toast.error(error)
    else {
      toast.success(action === "pay" ? t("paySuccess") : t("reopenSuccess"))
      await load()
    }
    setPayingId(null)
    setConfirmPay(null)
  }

  function shiftWeek(days: number) {
    const nextWeek = addUtcDays(getWeekStartDate(weekStart), days)
    setWeekStart(formatDateOnly(nextWeek))
  }

  const recordsMap = new Map((data?.records || []).map((r) => [r.teacherId, r]))
  const isMonth = data?.period.type === "month" || mode === "month"

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              onClick={() => setMode("month")}
              className={`px-4 py-2 ${mode === "month" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}
            >
              {t("monthMode")}
            </button>
            <button
              onClick={() => setMode("week")}
              className={`px-4 py-2 ${mode === "week" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}
            >
              {t("weekMode")}
            </button>
          </div>
          {mode === "week" ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => shiftWeek(-7)} aria-label={t("previousWeek")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(formatDateOnly(getWeekStartDate(e.target.value)))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <Button variant="secondary" size="sm" onClick={() => shiftWeek(7)} aria-label={t("nextWeek")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
        </div>
      </div>

      {data && data.unassignedCount > 0 && (
        <Card padding="md" className="mb-6 border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">{t("unassignedTitle")}</p>
          <p className="mt-1 text-sm text-amber-800">{t("unassignedText")} ({data.unassignedCount})</p>
        </Card>
      )}

      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-900">{t("displayedPeriod")}</p>
            <p className="text-sm text-blue-700">
              {isMonth ? data?.rangeLabel || month : t("fromTo", { start: data?.weekStart || "", end: data?.weekEnd || "" })}
            </p>
            <p className="mt-2 text-xs text-blue-700">{t("periodHint")}</p>
          </div>
          <Link href="/school/teaching-hours" className="text-sm font-medium text-blue-700 hover:underline">
            {t("openTeachingHours")}
          </Link>
        </div>
      </Card>

      {(!data || data.teachers.length === 0) ? (
        <Card>
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t("emptyState")}</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{data.grandTotalHours}</p>
                  <p className="text-xs text-gray-500">{t("totalHours")}</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{data.totalEarnings.toLocaleString()} MRU</p>
                  <p className="text-xs text-gray-500">{t("totalEarnings")}</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{data.totalTeachers}</p>
                  <p className="text-xs text-gray-500">{t("teachersCount")}</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{data.assignmentsWithoutRate}</p>
                  <p className="text-xs text-gray-500">{t("assignmentsWithoutRate")}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 mb-6 lg:grid-cols-3">
            <Card padding="md">
              <p className="text-sm font-medium text-gray-900">{t("howCalculatedTitle")}</p>
              <p className="mt-2 text-sm text-gray-600">
                {t("howCalculatedText")}
              </p>
              <p className="mt-2 text-xs text-gray-500">{t("excusedNote")}</p>
            </Card>
            <Card padding="md">
              <p className="text-sm font-medium text-gray-900">{t("whenNoEarningTitle")}</p>
              <p className="mt-2 text-sm text-gray-600">
                {t("whenNoEarningText")}
              </p>
            </Card>
            <Card padding="md" className={data.assignmentsWithoutRate > 0 ? "border-amber-200 bg-amber-50" : ""}>
              <p className="text-sm font-medium text-gray-900">{t("incompleteCostsTitle")}</p>
              <p className="mt-2 text-sm text-gray-600">
                {data.assignmentsWithoutRate > 0
                  ? t("incompleteCostsWarning", { count: data.assignmentsWithoutRate })
                  : t("incompleteCostsOk")}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            {data.teachers.map((teacher) => {
              const record = recordsMap.get(teacher.teacherId)
              const isPaid = record?.status === "PAID"
              return (
              <Card key={teacher.teacherId} padding="lg">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/school/teachers/${teacher.teacherId}`} className="font-semibold text-blue-700 hover:underline">
                      {teacher.name}
                    </Link>
                    {isMonth && isPaid && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        {t("paidBadge")}{record?.paidAt ? ` · ${new Date(record.paidAt).toLocaleDateString()}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{t("hoursValue", { count: teacher.totalHours })}</span>
                    <span className="font-bold text-green-700">{t("currencyValue", { value: teacher.totalEarnings.toLocaleString() })}</span>
                    {isMonth && (
                      <Link
                        href={`/school/payroll/slip?teacherId=${teacher.teacherId}&month=${data?.period.value || month}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        {t("printSlip")}
                      </Link>
                    )}
                    {isMonth && !isPaid && (
                      <Button size="sm" loading={payingId === teacher.teacherId} onClick={() => setConfirmPay(teacher)}>
                        {t("markPaid")}
                      </Button>
                    )}
                    {isMonth && isPaid && (
                      <Button size="sm" variant="secondary" loading={payingId === teacher.teacherId} onClick={() => void markPaid(teacher, "reopen")}>
                        {t("reopen")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-400 text-xs">
                        <th className="text-right py-2 px-2">{t("subject")}</th>
                        <th className="text-right py-2 px-2">{t("classroom")}</th>
                        <th className="text-center py-2 px-2">{t("hourlyRate")}</th>
                        <th className="text-center py-2 px-2">{t("expectedSchedule")}</th>
                        <th className="text-center py-2 px-2">{t("confirmed")}</th>
                        <th className="text-center py-2 px-2">{t("compensation")}</th>
                        <th className="text-center py-2 px-2">{t("hours")}</th>
                        <th className="text-center py-2 px-2 text-green-700">{t("earning")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacher.assignments.map((row) => (
                        <tr key={row.id} className={`border-b hover:bg-gray-50 ${row.unassigned ? "bg-amber-50" : ""}`}>
                          <td className="py-2 px-2 font-medium">
                            {row.subject}
                            {row.unassigned && <span className="mr-1 text-xs text-amber-600">({t("unassignedTitle")})</span>}
                          </td>
                          <td className="py-2 px-2 text-gray-600">
                            {row.classroom}
                            <span className="text-xs text-gray-400 mr-1">
                              {row.stream ? `· ${row.stream}` : `· ${row.level}`}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center text-amber-700">
                            {row.hourlyRate != null ? row.hourlyRate : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {row.expectedHours > 0 ? (
                              <span className="text-blue-700">{row.expectedHours}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`py-2 px-2 text-center font-medium ${row.expectedHours > 0 && row.confirmedHours !== row.expectedHours ? "text-amber-600" : ""}`}>
                            {row.confirmedHours}
                            {row.expectedHours > 0 && row.confirmedHours !== row.expectedHours && (
                              <span className="text-xs text-amber-500 mr-1">
                                ({row.confirmedHours > row.expectedHours ? "+" : ""}{(row.confirmedHours - row.expectedHours).toFixed(1)})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-medium">
                            {row.compensationHours > 0 ? row.compensationHours : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-2 text-center font-medium">{row.totalHours}</td>
                          <td className="py-2 px-2 text-center font-bold text-green-700">
                            {row.earnings != null ? row.earnings.toLocaleString() : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              )
            })}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!confirmPay}
        onClose={() => setConfirmPay(null)}
        onConfirm={() => confirmPay && void markPaid(confirmPay, "pay")}
        title={t("markPaid")}
        message={`${confirmPay?.name || ""} · ${confirmPay ? t("currencyValue", { value: confirmPay.totalEarnings.toLocaleString() }) : ""}`}
        confirmText={t("markPaid")}
        cancelText={tCommon("cancel")}
        variant="primary"
      />
    </div>
  )
}

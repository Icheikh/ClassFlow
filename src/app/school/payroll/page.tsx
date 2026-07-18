"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Button, Card, LoadingPage } from "@/components/ui"
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
  totalHours: number
  expectedHours: number
  entryCount: number
  earnings: number | null
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
  weekStart: string
  weekEnd: string
}

export default function PayrollPage() {
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => formatDateOnly(getWeekStartDate()))

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data: response } = await api.get<PayrollData>(`/api/school/payroll?weekStart=${weekStart}`)
      if (!cancelled) {
        if (response) setData(response)
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [weekStart])

  function shiftWeek(days: number) {
    const nextWeek = addUtcDays(getWeekStartDate(weekStart), days)
    setWeekStart(formatDateOnly(nextWeek))
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الرواتب الأسبوعية</h1>
          <p className="text-sm text-gray-500">يتم الاحتساب من الساعات اليومية المسجلة لكل تكليف: أستاذ + مادة + قسم</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shiftWeek(-7)} aria-label="الأسبوع السابق">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(formatDateOnly(getWeekStartDate(e.target.value)))}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <Button variant="secondary" size="sm" onClick={() => shiftWeek(7)} aria-label="الأسبوع التالي">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-900">الفترة المعروضة</p>
            <p className="text-sm text-blue-700">
              من {data?.weekStart} إلى {data?.weekEnd}
            </p>
            <p className="mt-2 text-xs text-blue-700">
              المستحقات هنا تُحسب من الساعات اليومية المسجلة فعليًا لكل تكليف، وليس من الحضور وحده.
            </p>
          </div>
          <Link href="/school/teaching-hours" className="text-sm font-medium text-blue-700 hover:underline">
            فتح سجل الساعات اليومية
          </Link>
        </div>
      </Card>

      {(!data || data.teachers.length === 0) ? (
        <Card>
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد تكليفات نشطة أو بيانات لهذه الفترة</p>
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
                  <p className="text-xs text-gray-500">إجمالي الساعات</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{data.totalEarnings.toLocaleString()} MRU</p>
                  <p className="text-xs text-gray-500">إجمالي المستحقات</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{data.totalTeachers}</p>
                  <p className="text-xs text-gray-500">عدد الأساتذة</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{data.assignmentsWithoutRate}</p>
                  <p className="text-xs text-gray-500">تكليفات بدون أجر/ساعة</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 mb-6 lg:grid-cols-3">
            <Card padding="md">
              <p className="text-sm font-medium text-gray-900">كيف يُحتسب الأجر؟</p>
              <p className="mt-2 text-sm text-gray-600">
                كل تكليف يجمع ساعاته المسجلة خلال الأسبوع، ثم يضربها النظام في أجر الساعة الخاص بذلك التكليف.
              </p>
            </Card>
            <Card padding="md">
              <p className="text-sm font-medium text-gray-900">متى لا يظهر مستحق؟</p>
              <p className="mt-2 text-sm text-gray-600">
                إذا لم تُسجل ساعات يومية، أو إذا كان التكليف لا يملك أجر ساعة بعد، فسيبقى المستحق صفراً أو غير محسوب.
              </p>
            </Card>
            <Card padding="md" className={data.assignmentsWithoutRate > 0 ? "border-amber-200 bg-amber-50" : ""}>
              <p className="text-sm font-medium text-gray-900">تنبيه التكاليف غير المكتملة</p>
              <p className="mt-2 text-sm text-gray-600">
                {data.assignmentsWithoutRate > 0
                  ? `يوجد ${data.assignmentsWithoutRate} تكليفات بلا أجر/ساعة، لذلك لن يظهر مستحقها بشكل صحيح حتى يتم تحديد الأجر.`
                  : "كل التكاليف المعروضة تملك أجر ساعة، ويمكن الاعتماد على المستحقات الحالية."}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            {data.teachers.map((teacher) => (
              <Card key={teacher.teacherId} padding="lg">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/school/teachers/${teacher.teacherId}`} className="font-semibold text-blue-700 hover:underline">
                    {teacher.name}
                  </Link>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{teacher.totalHours} ساعة</span>
                    <span className="font-bold text-green-700">{teacher.totalEarnings.toLocaleString()} أوقية</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-400 text-xs">
                        <th className="text-right py-2 px-2">المادة</th>
                        <th className="text-right py-2 px-2">القسم</th>
                        <th className="text-center py-2 px-2">الأجر/س</th>
                        <th className="text-center py-2 px-2">المتوقع (جدول)</th>
                        <th className="text-center py-2 px-2">المسجل</th>
                        <th className="text-center py-2 px-2">الساعات</th>
                        <th className="text-center py-2 px-2 text-green-700">المستحق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacher.assignments.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium">{row.subject}</td>
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
                          <td className={`py-2 px-2 text-center font-medium ${row.expectedHours > 0 && row.totalHours !== row.expectedHours ? "text-amber-600" : ""}`}>
                            {row.totalHours}
                            {row.expectedHours > 0 && row.totalHours !== row.expectedHours && (
                              <span className="text-xs text-amber-500 mr-1">
                                ({row.totalHours > row.expectedHours ? "+" : ""}{(row.totalHours - row.expectedHours).toFixed(1)})
                              </span>
                            )}
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
            ))}
          </div>
        </>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Printer, Calendar, Wallet, Clock, ShieldCheck } from "lucide-react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { formatDateOnly, getWeekStartDate } from "@/lib/date"

type ReportData = {
  teacher: { id: string; phone: string | null; user: { email: string; name: string; phone: string | null; isActive: boolean } }
  assignments: { id: string }[]
  recentLessons: { id: string }[]
  stats: { assignments: number; lessonsThisMonth: number; totalStudents: number }
  payroll: {
    weekStart: string
    weekEnd: string
    totalHours: number
    estimatedEarnings: number
    attendanceSummary: {
      presentDays: number
      absentDays: number
      lateDays: number
      excusedDays: number
      totalMarkedDays: number
    }
    attendanceRecords: {
      id: string
      date: string
      status: string
      checkIn: string | null
      checkOut: string | null
      markedBy: string
    }[]
    assignmentSummaries: {
      id: string
      subject: string
      classroom: string
      level: string
      hourlyRate: number | null
      weeklyHours: number | null
      totalHours: number
      entryCount: number
      estimatedEarnings: number
      lastRecordedAt: string | null
      lastRecordedBy: string | null
    }[]
    activityTimeline: {
      id: string
      type: "ATTENDANCE" | "HOURS"
      date: string
      recordedAt: string
      title: string
      subtitle: string
      status?: string
      notes?: string | null
    }[]
  }
}

const attendanceLabels: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غائب",
  LATE: "متأخر",
  EXCUSED: "بعذر",
}

export default function TeacherWeeklyReportPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const weekStart = formatDateOnly(getWeekStartDate(searchParams?.get("weekStart") || undefined))

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false)
        return
      }

      const { data: response, error } = await api.get<ReportData>(`/api/school/teachers/${id}?weekStart=${weekStart}`)
      if (error) {
        toast.error(error)
      } else if (response) {
        setData(response)
      }
      setLoading(false)
    }

    void load()
  }, [id, weekStart])

  if (loading) return <LoadingPage />

  if (!data) {
    return (
      <Card className="print:shadow-none print:border-0">
        <div className="py-12 text-center space-y-3">
          <p className="text-lg font-semibold">تعذر تحميل التقرير الأسبوعي</p>
          <Link href="/school/teachers">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" /> العودة إلى الأساتذة
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/school/teachers/${data.teacher.id}?weekStart=${weekStart}`}>
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> العودة إلى ملف الأستاذ
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> طباعة
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0 print:p-0">
        <div className="space-y-6 print:space-y-4">
          <div className="border-b pb-4 print:pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">التقرير الأسبوعي للأستاذ</h1>
                <p className="mt-2 text-lg font-semibold">{data.teacher.user.name}</p>
                <p className="text-sm text-gray-500">{data.teacher.user.email}</p>
              </div>
              <div className="text-left">
                <Badge variant="info">
                  <Calendar className="h-3 w-3" /> من {data.payroll.weekStart} إلى {data.payroll.weekEnd}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">الحضور</p>
              <p className="font-semibold">{data.payroll.attendanceSummary.presentDays} يوم</p>
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">الغياب</p>
              <p className="font-semibold">{data.payroll.attendanceSummary.absentDays} يوم</p>
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">الساعات المسجلة</p>
              <p className="font-semibold">{data.payroll.totalHours} ساعة</p>
            </div>
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">الأجر التقديري</p>
              <p className="font-semibold">{data.payroll.estimatedEarnings.toLocaleString()} MRU</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-medium text-gray-900">كيف يُقرأ هذا التقرير؟</p>
              <p className="mt-2 text-gray-600">
                الحضور يوضح حالة الأستاذ خلال الأسبوع، بينما الساعات المسجلة هي التي يعتمد عليها احتساب المستحقات لكل مادة وقسم.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-medium text-gray-900">متى يكون الأجر التقديري ناقصًا؟</p>
              <p className="mt-2 text-gray-600">
                إذا غابت تسجيلات الساعات، أو كان بعض التكاليف بلا أجر ساعة، فلن يعكس الرقم النهائي كل ما يتوقعه المستخدم حتى تستكمل البيانات.
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-medium text-blue-900">أين تتم المراجعة؟</p>
              <div className="mt-2 space-y-1">
                <Link href={`/school/teachers/${data.teacher.id}?weekStart=${weekStart}`} className="block text-blue-700 hover:underline">
                  العودة إلى ملف الأستاذ
                </Link>
                <Link href={`/school/payroll?weekStart=${data.payroll.weekStart}`} className="block text-blue-700 hover:underline">
                  فتح كشف الرواتب
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" /> سجل الحضور</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="px-3 py-2 text-right">التاريخ</th>
                      <th className="px-3 py-2 text-center">الحالة</th>
                      <th className="px-3 py-2 text-right">سجلها</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payroll.attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-gray-400">لا توجد سجلات حضور</td>
                      </tr>
                    ) : data.payroll.attendanceRecords.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="px-3 py-2">{record.date}</td>
                        <td className="px-3 py-2 text-center">{attendanceLabels[record.status] || record.status}</td>
                        <td className="px-3 py-2">{record.markedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Clock className="h-5 w-5" /> السجل الزمني</h2>
              <div className="space-y-2">
                {data.payroll.activityTimeline.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">لا توجد أحداث خلال هذا الأسبوع</p>
                ) : data.payroll.activityTimeline.map((event) => (
                  <div key={event.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{event.subtitle}</p>
                    {event.notes && <p className="mt-2 text-xs text-gray-500">{event.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Wallet className="h-5 w-5" /> ملخص التكليفات</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="px-3 py-2 text-right">المادة</th>
                    <th className="px-3 py-2 text-right">القسم</th>
                    <th className="px-3 py-2 text-center">المسجل</th>
                    <th className="px-3 py-2 text-center">الأجر/س</th>
                    <th className="px-3 py-2 text-center">الأجر التقديري</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payroll.assignmentSummaries.map((assignment) => (
                    <tr key={assignment.id} className="border-b">
                      <td className="px-3 py-2">{assignment.subject}</td>
                      <td className="px-3 py-2">{assignment.classroom} - {assignment.level}</td>
                      <td className="px-3 py-2 text-center">{assignment.totalHours}</td>
                      <td className="px-3 py-2 text-center">{assignment.hourlyRate ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{assignment.hourlyRate != null ? assignment.estimatedEarnings.toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

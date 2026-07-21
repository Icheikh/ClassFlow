"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Button, Card, Input, LoadingPage } from "@/components/ui"
import { formatDateOnly, parseDateOnly } from "@/lib/date"
import { BookOpen, Calendar, Clock, Save, UserCheck, Wallet } from "lucide-react"

type TeachingHourRow = {
  teacherAssignmentId: string
  teacherId: string
  teacherName: string
  subjectName: string
  subjectCode: string | null
  classroomName: string
  levelName: string
  streamName: string | null
  hourlyRate: number | null
  weeklyHours: number | null
  attendanceStatus: string | null
  hoursTaught: number
  expectedHours: number
  notes: string
  recordedBy: string | null
}

type TeachingHoursData = {
  date: string
  academicYear: { id: string; name: string }
  rows: TeachingHourRow[]
}

type DraftEntry = {
  hoursTaught: string
  notes: string
}

const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غائب",
  LATE: "متأخر",
  EXCUSED: "بعذر",
}

export default function TeachingHoursPage() {
  const [data, setData] = useState<TeachingHoursData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dateStr, setDateStr] = useState(() => formatDateOnly(parseDateOnly()))
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data: response, error } = await api.get<TeachingHoursData>(`/api/school/teaching-hours?date=${dateStr}`)
      if (cancelled) return

      if (error) {
        toast.error(error)
      } else if (response) {
        setData(response)
        setDraft(
          Object.fromEntries(
            response.rows.map((row) => [
              row.teacherAssignmentId,
              { hoursTaught: row.hoursTaught ? String(row.hoursTaught) : "", notes: row.notes || "" },
            ])
          )
        )
      }

      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [dateStr])

  const groupedTeachers = useMemo(() => {
    if (!data) return []

    const teacherMap = new Map<string, { teacherId: string; teacherName: string; rows: TeachingHourRow[] }>()

    for (const row of data.rows) {
      if (!teacherMap.has(row.teacherId)) {
        teacherMap.set(row.teacherId, {
          teacherId: row.teacherId,
          teacherName: row.teacherName,
          rows: [],
        })
      }

      teacherMap.get(row.teacherId)!.rows.push(row)
    }

    return Array.from(teacherMap.values())
  }, [data])

  const rows = data?.rows || []
  const recordedAssignments = Object.values(draft).filter((entry) => Number(entry.hoursTaught || 0) > 0).length
  const totalHours = Object.values(draft).reduce((sum, entry) => sum + (Number(entry.hoursTaught || 0) || 0), 0)
  const assignmentsWithoutRate = rows.filter((row) => row.hourlyRate == null).length
  const absentAssignments = rows.filter((row) => row.attendanceStatus === "ABSENT").length

  function updateDraft(teacherAssignmentId: string, patch: Partial<DraftEntry>) {
    setDraft((current) => ({
      ...current,
      [teacherAssignmentId]: {
        hoursTaught: current[teacherAssignmentId]?.hoursTaught ?? "",
        notes: current[teacherAssignmentId]?.notes ?? "",
        ...patch,
      },
    }))
  }

  async function saveAll() {
    if (!data) return

    setSaving(true)

    const entries = data.rows.map((row) => ({
      teacherAssignmentId: row.teacherAssignmentId,
      hoursTaught: draft[row.teacherAssignmentId]?.hoursTaught ?? "",
      notes: draft[row.teacherAssignmentId]?.notes ?? "",
    }))

    const { error } = await api.post("/api/school/teaching-hours", {
      date: dateStr,
      entries,
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success("تم حفظ الساعات التعويضية")
      const { data: refreshed } = await api.get<TeachingHoursData>(`/api/school/teaching-hours?date=${dateStr}`)
      if (refreshed) {
        setData(refreshed)
        setDraft(
          Object.fromEntries(
            refreshed.rows.map((row) => [
              row.teacherAssignmentId,
              { hoursTaught: row.hoursTaught ? String(row.hoursTaught) : "", notes: row.notes || "" },
            ])
          )
        )
      }
    }

    setSaving(false)
  }

  if (loading) return <LoadingPage />

  if (!data) {
    return (
      <Card>
        <p className="py-8 text-center text-gray-500" role="alert">تعذر تحميل الساعات التعويضية</p>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الساعات التعويضية والإضافية</h1>
          <p className="text-sm text-gray-500">أضف هنا الحصص الخارجة عن الجدول العادي مثل التعويض والدعم والمراجعة</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <Button onClick={saveAll} loading={saving}>
            <Save className="h-4 w-4" />
            حفظ الكل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{totalHours}</p>
              <p className="text-xs text-gray-500">إجمالي الساعات الإضافية</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><BookOpen className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold">{recordedAssignments}</p>
              <p className="text-xs text-gray-500">تكليفات بها إضافة</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold">{groupedTeachers.length}</p>
              <p className="text-xs text-gray-500">عدد الأساتذة</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Wallet className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-sm font-semibold">{data.academicYear.name}</p>
              <p className="text-xs text-gray-500">السنة الدراسية النشطة</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-blue-700">
              الرواتب الأسبوعية تُحسب أساسًا من الحصص المجدولة التي تم تأكيدها من صفحة حضور الأساتذة.
            </p>
            <p className="mt-2 text-xs text-blue-700">
              استخدم هذه الصفحة فقط إذا كانت هناك حصة تعويضية أو ساعة دعم أو تعديل يدوي يجب إضافته فوق الحصص العادية.
            </p>
            <p className="mt-2 text-xs text-blue-700">
              <strong>المتوقع</strong> هنا مرجع من جدول اليوم فقط، أما <strong>المسجل</strong> فهو إضافة استثنائية وليس بديلاً عن تأكيد الحصة في سجل الحضور.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Link href="/school/teacher-attendance" className="text-sm font-medium text-blue-700 hover:underline">
              فتح تأكيد حصص الأساتذة
            </Link>
            <Link href={`/school/payroll?weekStart=${dateStr}`} className="text-sm font-medium text-blue-700 hover:underline">
              فتح كشف الرواتب الأسبوعي
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 mb-6 lg:grid-cols-3">
        <Card padding="md">
          <p className="text-sm font-medium text-gray-900">ماذا تسجل هنا؟</p>
          <p className="mt-2 text-sm text-gray-600">
            سجّل فقط الساعات الاستثنائية لكل تكليف في هذا اليوم، مثل تعويض حصة ضائعة أو مراجعة إضافية أو دعم خاص.
          </p>
        </Card>
        <Card padding="md" className={assignmentsWithoutRate > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <p className="text-sm font-medium text-gray-900">تكليفات بلا أجر/ساعة</p>
          <p className="mt-2 text-sm text-gray-600">
            {assignmentsWithoutRate > 0
              ? `يوجد ${assignmentsWithoutRate} تكليفات بلا أجر ساعة، ويمكن تسجيل ساعاتها لكن المستحق لن يُحسب بدقة حتى يتم تحديد الأجر في ملف الأستاذ.`
              : "كل التكاليف المعروضة تملك أجر ساعة، لذا يمكن للنظام تقدير المستحقات مباشرة."}
          </p>
        </Card>
        <Card padding="md" className={absentAssignments > 0 ? "border-blue-200 bg-blue-50" : ""}>
          <p className="text-sm font-medium text-gray-900">حالة تأكيد الحصص</p>
          <p className="mt-2 text-sm text-gray-600">
            {absentAssignments > 0
              ? `يوجد ${absentAssignments} تكليفات مرتبطة بأساتذة لديهم حصص مؤكدة كغياب اليوم. يمكن رغم ذلك تسجيل تعويض مستقل إذا تم لاحقًا إنجاز حصة إضافية.`
              : "لا توجد اليوم تكليفات مرتبطة بغياب مؤكد ضمن هذه القائمة."}
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        {groupedTeachers.map((teacher) => (
          <Card key={teacher.teacherId} padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg">{teacher.teacherName}</h2>
                <p className="text-xs text-gray-500">{teacher.rows.length} تكليفات متاحة لإضافات اليوم</p>
              </div>
              <Link href={`/school/teachers/${teacher.teacherId}`} className="text-sm text-blue-700 hover:underline">
                فتح ملف الأستاذ
              </Link>
            </div>

            <div className="space-y-3">
              {teacher.rows.map((row) => {
                const entry = draft[row.teacherAssignmentId] || { hoursTaught: "", notes: "" }
                const attendanceLabel = row.attendanceStatus ? ATTENDANCE_LABELS[row.attendanceStatus] || row.attendanceStatus : "غير مسجل"

                return (
                  <div key={row.teacherAssignmentId} className={`rounded-xl border p-4 ${row.expectedHours > 0 && Number(entry.hoursTaught || 0) !== row.expectedHours && Number(entry.hoursTaught || 0) > 0 ? "border-amber-200 bg-amber-50/50" : "border-gray-200"}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_100px_100px_100px_minmax(0,1fr)] gap-3 items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{row.subjectName}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {row.classroomName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {row.streamName || row.levelName}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5" />
                            {attendanceLabel}
                          </span>
                          <span>الأجر/ساعة: {row.hourlyRate != null ? `${row.hourlyRate} MRU` : "غير محدد"}</span>
                          <span>المتوقع أسبوعياً: {row.weeklyHours != null ? row.weeklyHours : "—"} ساعة</span>
                          {row.recordedBy && <span>آخر حفظ: {row.recordedBy}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          <Link href={`/school/teachers/${row.teacherId}`} className="text-blue-700 hover:underline">
                            مراجعة ملف الأستاذ
                          </Link>
                          <Link href={`/school/teachers/${row.teacherId}/weekly-report?weekStart=${dateStr}`} className="text-blue-700 hover:underline">
                            فتح التقرير الأسبوعي
                          </Link>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">مرجع الجدول</label>
                        <div className={`h-[42px] px-4 rounded-lg border flex items-center text-sm ${row.expectedHours > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                          {row.expectedHours > 0 ? `${row.expectedHours} س` : "—"}
                        </div>
                      </div>

                      <Input
                        label="الإضافة"
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={entry.hoursTaught}
                        onChange={(e) => updateDraft(row.teacherAssignmentId, { hoursTaught: e.target.value })}
                        placeholder="0"
                      />

                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">قيمة الإضافة</label>
                        <div className="h-[42px] px-4 rounded-lg border border-gray-200 bg-gray-50 flex items-center text-sm text-gray-700">
                          {row.hourlyRate != null && Number(entry.hoursTaught || 0) > 0
                            ? `${(Number(entry.hoursTaught || 0) * row.hourlyRate).toLocaleString()} MRU`
                            : "—"}
                        </div>
                      </div>

                        <Input
                          label="ملاحظات"
                          value={entry.notes}
                          onChange={(e) => updateDraft(row.teacherAssignmentId, { notes: e.target.value })}
                          placeholder="مثال: حصة تعويضية"
                        />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

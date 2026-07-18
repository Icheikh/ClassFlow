"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingPage, ErrorDisplay, ConfirmModal } from "@/components/ui"
import {
  UserCheck,
  UserX,
  Clock,
  Calendar,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import toast from "react-hot-toast"

type TeacherRosterEntry = {
  id: string
  name: string
  email: string
  assignments: { subject: string; classroom: string; hourlyRate: number | null }[]
  attendance: { status: string; checkIn: string | null; checkOut: string | null; markedBy: string } | null
  lessonCount: number
  assignmentCount: number
  hasSchedule: boolean
}

type RosterData = {
  date: string
  teachers: TeacherRosterEntry[]
}

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "حاضر", icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "ABSENT", label: "غائب", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "LATE", label: "متأخر", icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "EXCUSED", label: "بعذر", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
]

export function TeacherRosterManager() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [data, setData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0])
  const [fetchError, setFetchError] = useState(false)
  const [retryTrigger, setRetryTrigger] = useState(0)
  const [bulkMarkStatus, setBulkMarkStatus] = useState<string | null>(null)

  const isSupervisor = user?.role === "SUPERVISOR" || user?.role === "SCHOOL_ADMIN"

  const fetchData = useCallback(async () => {
    if (!isSupervisor) return
    void retryTrigger
    setLoading(true)
    setFetchError(false)
    try {
      const { data: result, error } = await api.get<RosterData>(`/api/teacher-attendance?date=${dateStr}`)
      if (error) { toast.error(error); setFetchError(true); return }
      if (result) setData(result)
    } catch { setFetchError(true); toast.error("حدث خطأ أثناء تحميل بيانات الحضور") }
    setLoading(false)
  }, [dateStr, isSupervisor, retryTrigger])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function markTeacher(teacherId: string, status: string) {
    setSaving(teacherId)
    try {
      const { error } = await api.post("/api/teacher-attendance", {
        action: "mark", teacherId, status, date: dateStr,
      })
      if (error) toast.error(error)
      else {
        toast.success("تم التحديث")
        void fetchData()
      }
    } catch { toast.error("فشل تسجيل الحضور. حاول مرة أخرى.") }
    setSaving(null)
  }

  async function handleBulkMark() {
    if (!bulkMarkStatus) return
    setLoading(true)
    setBulkMarkStatus(null)
    try {
      const { error } = await api.post("/api/teacher-attendance", {
        action: "bulk-mark", status: bulkMarkStatus, date: dateStr,
      })
      if (error) toast.error(error)
      else {
        toast.success("تم تسجيل الجميع")
        void fetchData()
      }
    } catch { toast.error("فشل تسجيل الجميع. حاول مرة أخرى.") }
  }

  if (!isSupervisor) {
    return (
      <Card>
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">غير مصرح لك بعرض هذه الصفحة</p>
        </div>
      </Card>
    )
  }

  const filtered = data?.teachers.filter((teacher) => {
    if (!filter) return true
    if (filter === "unmarked") return !teacher.attendance
    if (filter === "marked") return !!teacher.attendance
    if (filter === "absent") return teacher.attendance?.status === "ABSENT"
    if (filter === "present") return teacher.attendance?.status === "PRESENT"
    if (filter === "with-schedule") return teacher.hasSchedule
    return true
  }) || []

  const presentCount = data?.teachers.filter((teacher) => teacher.attendance?.status === "PRESENT").length || 0
  const absentCount = data?.teachers.filter((teacher) => teacher.attendance?.status === "ABSENT").length || 0
  const unmarkedCount = data?.teachers.filter((teacher) => !teacher.attendance).length || 0
  const scheduledCount = data?.teachers.filter((teacher) => teacher.hasSchedule).length || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">حضور الأساتذة اليومي</h1>
          <p className="text-sm text-gray-500">
            <Calendar className="h-4 w-4 inline" />{" "}
            {new Date(dateStr).toLocaleDateString("ar-MR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <Button variant="ghost" size="sm" onClick={() => void fetchData()} aria-label="تحديث البيانات">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-2 text-green-600">
            <UserCheck className="h-5 w-5" />
            <span className="text-sm font-medium">حاضر</span>
          </div>
          <p className="text-2xl font-bold mt-1">{presentCount}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-red-600">
            <UserX className="h-5 w-5" />
            <span className="text-sm font-medium">غائب</span>
          </div>
          <p className="text-2xl font-bold mt-1">{absentCount}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">غير مسجل</span>
          </div>
          <p className="text-2xl font-bold mt-1">{unmarkedCount}</p>
        </Card>
        <Card padding="md" className={scheduledCount > 0 && unmarkedCount > 0 ? "border-blue-200 bg-blue-50" : ""}>
          <div className="flex items-center gap-2 text-blue-600">
            <Calendar className="h-5 w-5" />
            <span className="text-sm font-medium">بحصص اليوم</span>
          </div>
          <p className="text-2xl font-bold mt-1">{scheduledCount}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button key={option.value} variant="secondary" size="sm" onClick={() => setBulkMarkStatus(option.value)}>
              <option.icon className="h-4 w-4" /> تسجيل الكل {option.label}
            </Button>
          ))}
        </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-40"
          >
            <option value="">كل الأساتذة</option>
            <option value="with-schedule">بجدول اليوم</option>
            <option value="unmarked">غير المسجلين</option>
            <option value="marked">المسجلين</option>
            <option value="present">الحاضرين</option>
            <option value="absent">الغائبين</option>
          </select>
      </div>

      {fetchError ? (
        <ErrorDisplay message="تعذر تحميل بيانات الحضور" onRetry={() => setRetryTrigger(n => n + 1)} />
      ) : loading ? (
        <LoadingPage />
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا يوجد أساتذة</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((teacher) => {
            const currentStatus = teacher.attendance?.status || ""

            return (
              <Card key={teacher.id} padding="sm" className={`hover:shadow-sm transition-shadow ${teacher.hasSchedule && !teacher.attendance ? "border-blue-200 bg-blue-50/30" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        currentStatus === "PRESENT"
                          ? "bg-green-100 text-green-700"
                          : currentStatus === "ABSENT"
                            ? "bg-red-100 text-red-700"
                            : currentStatus === "LATE"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {teacher.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{teacher.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{teacher.assignmentCount} تكليف</span>
                        {teacher.lessonCount > 0 && (
                          <Badge variant="info">{teacher.lessonCount} دروس اليوم</Badge>
                        )}
                        {teacher.hasSchedule && (
                          <Badge variant="success">في الجدول</Badge>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:flex gap-1 flex-wrap">
                      {teacher.assignments.slice(0, 2).map((assignment, index) => (
                        <span key={index} className="text-xs px-1.5 py-0.5 bg-gray-50 rounded text-gray-500">
                          {assignment.subject}
                        </span>
                      ))}
                      {teacher.assignments.length > 2 && (
                        <span className="text-xs text-gray-400">+{teacher.assignments.length - 2}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {STATUS_OPTIONS.map((option) => {
                      const isActive = currentStatus === option.value
                      return (
                        <button
                          key={option.value}
                          onClick={() => markTeacher(teacher.id, option.value)}
                          disabled={saving === teacher.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isActive
                              ? option.color + " ring-1 ring-offset-1"
                              : "text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                          }`}
                        >
                          <option.icon className="h-3.5 w-3.5 inline ml-1" />
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!bulkMarkStatus}
        onClose={() => setBulkMarkStatus(null)}
        onConfirm={() => void handleBulkMark()}
        title="تسجيل جميع الأساتذة"
        message={`سيتم تسجيل جميع الأساتذة كـ "${bulkMarkStatus ? STATUS_OPTIONS.find((s) => s.value === bulkMarkStatus)?.label : ""}". هل أنت متأكد؟`}
        confirmText="تأكيد"
        cancelText="إلغاء"
        variant={bulkMarkStatus === "ABSENT" ? "danger" : "primary"}
      />
    </div>
  )
}

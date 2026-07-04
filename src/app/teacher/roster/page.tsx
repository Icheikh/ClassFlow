"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingPage } from "@/components/ui"
import { UserCheck, UserX, Clock, Calendar, BookOpen, CheckCircle, XCircle, AlertTriangle, RefreshCw, Filter } from "lucide-react"
import toast from "react-hot-toast"

type TeacherRosterEntry = {
  id: string
  name: string
  email: string
  assignments: { subject: string; classroom: string; hourlyRate: number | null }[]
  attendance: { status: string; checkIn: string | null; checkOut: string | null; markedBy: string } | null
  lessonCount: number
  assignmentCount: number
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

export default function TeacherRosterPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [data, setData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0])

  const isSupervisor = user?.role === "SUPERVISOR" || user?.role === "SCHOOL_ADMIN"

  const fetchData = useCallback(async () => {
    if (!isSupervisor) return
    setLoading(true)
    const { data: result } = await api.get<RosterData>(`/api/teacher-attendance?date=${dateStr}`)
    if (result) setData(result)
    setLoading(false)
  }, [dateStr, isSupervisor])

  useEffect(() => { fetchData() }, [fetchData])

  async function markTeacher(teacherId: string, status: string) {
    setSaving(teacherId)
    const { error } = await api.post("/api/teacher-attendance", {
      action: "mark", teacherId, status, date: dateStr,
    })
    if (error) toast.error(error)
    else { toast.success("تم التحديث"); fetchData() }
    setSaving(null)
  }

  async function markAll(status: string) {
    if (!confirm(`تأكيد تسجيل جميع الأساتذة كـ "${STATUS_OPTIONS.find(s => s.value === status)?.label}"؟`)) return
    setLoading(true)
    const { error } = await api.post("/api/teacher-attendance", {
      action: "bulk-mark", status, date: dateStr,
    })
    if (error) toast.error(error)
    else { toast.success("تم تسجيل الجميع"); fetchData() }
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

  const filtered = data?.teachers.filter((t) => {
    if (!filter) return true
    if (filter === "unmarked") return !t.attendance
    if (filter === "marked") return !!t.attendance
    if (filter === "absent") return t.attendance?.status === "ABSENT"
    if (filter === "present") return t.attendance?.status === "PRESENT"
    return true
  }) || []

  const presentCount = data?.teachers.filter((t) => t.attendance?.status === "PRESENT").length || 0
  const absentCount = data?.teachers.filter((t) => t.attendance?.status === "ABSENT").length || 0
  const unmarkedCount = data?.teachers.filter((t) => !t.attendance).length || 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">سجل حضور الأساتذة</h1>
          <p className="text-sm text-gray-500">
            <Calendar className="h-4 w-4 inline" />{" "}
            {new Date(dateStr).toLocaleDateString("ar-MR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Stats */}
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
        <Card padding="md">
          <div className="flex items-center gap-2 text-blue-600">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-medium">الإجمالي</span>
          </div>
          <p className="text-2xl font-bold mt-1">{data?.teachers.length || 0}</p>
        </Card>
      </div>

      {/* Bulk Actions + Filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button key={opt.value} variant="secondary" size="sm" onClick={() => markAll(opt.value)}>
              <opt.icon className="h-4 w-4" /> تسجيل الكل {opt.label}
            </Button>
          ))}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-40">
          <option value="">كل الأساتذة</option>
          <option value="unmarked">غير المسجلين</option>
          <option value="marked">المسجلين</option>
          <option value="present">الحاضرين</option>
          <option value="absent">الغائبين</option>
        </select>
      </div>

      {/* Teachers Grid */}
      {loading ? (
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
          {filtered.map((t) => {
            const currentStatus = t.attendance?.status || ""
            return (
              <Card key={t.id} padding="sm" className="hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      currentStatus === "PRESENT" ? "bg-green-100 text-green-700" :
                      currentStatus === "ABSENT" ? "bg-red-100 text-red-700" :
                      currentStatus === "LATE" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {t.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{t.assignmentCount} تكليف</span>
                        {t.lessonCount > 0 && (
                          <Badge variant="info">{t.lessonCount} دروس اليوم</Badge>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:flex gap-1 flex-wrap">
                      {t.assignments.slice(0, 2).map((a, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-50 rounded text-gray-500">{a.subject}</span>
                      ))}
                      {t.assignments.length > 2 && (
                        <span className="text-xs text-gray-400">+{t.assignments.length - 2}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {STATUS_OPTIONS.map((opt) => {
                      const isActive = currentStatus === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => markTeacher(t.id, opt.value)}
                          disabled={saving === t.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isActive
                              ? opt.color + " ring-1 ring-offset-1"
                              : "text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                          }`}
                        >
                          <opt.icon className="h-3.5 w-3.5 inline ml-1" />
                          {opt.label}
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
    </div>
  )
}

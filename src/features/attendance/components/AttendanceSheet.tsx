"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useClasses } from "@/hooks/useClasses"
import { useStudents } from "@/hooks/useStudents"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingSpinner, ErrorDisplay, TeacherSubNav } from "@/components/ui"
import { Check, X, Clock, AlertCircle, Save, Calendar, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"

type AttendanceStatus = "present" | "absent" | "late" | "excused"

const STATUS_CYCLE: AttendanceStatus[] = ["present", "absent", "late", "excused"]

const STATUS_CONFIG: Record<AttendanceStatus, { icon: any; variant: "success" | "danger" | "warning" | "info"; label: string }> = {
  present: { icon: Check, variant: "success", label: "حاضر" },
  absent: { icon: X, variant: "danger", label: "غائب" },
  late: { icon: Clock, variant: "warning", label: "متأخر" },
  excused: { icon: AlertCircle, variant: "info", label: "بعذر" },
}

export function AttendanceSheet() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { assignments, classrooms, getSubjects, loading: loadingClasses } = useClasses()

  const initialClassroom = searchParams?.get("classroomId") || ""
  const initialSubject = searchParams?.get("subjectId") || ""

  const [classroomId, setClassroomId] = useState(initialClassroom)
  const [subjectId, setSubjectId] = useState(initialSubject)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const { students, loading: loadingStudents } = useStudents(classroomId)
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [existingAttendance, setExistingAttendance] = useState<any[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  const [fetchError, setFetchError] = useState(false)
  const [retryTrigger, setRetryTrigger] = useState(0)

  useEffect(() => {
    if (!classroomId || !subjectId) return
    let cancelled = false
    setLoadingExisting(true)
    setFetchError(false)
    api.get<any[]>(`/api/attendance?classroomId=${classroomId}&subjectId=${subjectId}&date=${selectedDate}`)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { toast.error(error); setFetchError(true); return }
        if (data && data.length > 0) {
          setExistingAttendance(data)
          const map: Record<string, AttendanceStatus> = {}
          for (const r of data) { map[r.studentId] = r.status.toLowerCase() as AttendanceStatus }
          setRecords(map)
        } else {
          setExistingAttendance([])
          setRecords({})
        }
      })
      .catch(() => { if (!cancelled) { toast.error("حدث خطأ أثناء تحميل بيانات الغياب"); setFetchError(true) } })
      .finally(() => { if (!cancelled) setLoadingExisting(false) })
    return () => { cancelled = true }
  }, [classroomId, subjectId, selectedDate, retryTrigger])

  function getStatus(studentId: string): AttendanceStatus {
    return records[studentId] || "present"
  }

  function toggle(studentId: string) {
    const current = getStatus(studentId)
    const idx = STATUS_CYCLE.indexOf(current)
    setRecords({ ...records, [studentId]: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] })
  }

  function markAllPresent() {
    const newRecords = { ...records }
    for (const s of students) {
      newRecords[s.id] = "present"
    }
    setRecords(newRecords)
    toast.success("تم تأشير الجميع حاضر")
  }

  async function save() {
    if (!classroomId || !subjectId) { toast.error("اختر القسم والمادة"); return }
    setSaving(true)
    try {
      const { error } = await api.post("/api/attendance", {
        classroomId,
        subjectId,
        date: selectedDate,
        records: students.map((s) => ({ studentId: s.id, status: getStatus(s.id).toUpperCase() })),
      })
      if (error) toast.error(error)
      else {
        toast.success("تم حفظ الغياب")
        if (students.filter((s) => getStatus(s.id) !== "present").length > 0) {
          toast.success("تم إرسال إشعارات لأولياء الأمور")
        }
      }
    } catch {
      toast.error("فشل الاتصال بالخادم. حاول مرة أخرى.")
    }
    setSaving(false)
  }

  if (loadingClasses) return <LoadingSpinner message="جاري تحميل البيانات..." />

  const absentCount = students.filter((s) => getStatus(s.id) !== "present").length
  const subjects = getSubjects(classroomId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">دفتر الغياب</h1>
        <div className="flex items-center gap-2">
          {absentCount > 0 && <Badge variant="danger">{absentCount} غائب/متأخر</Badge>}
          {existingAttendance.length > 0 && <Badge variant="info">مسجل سابقاً</Badge>}
        </div>
      </div>

      <TeacherSubNav current="attendance" classroomId={classroomId} subjectId={subjectId} />

      <div className="flex gap-4 mb-6">
        <select value={classroomId} onChange={(e) => { setClassroomId(e.target.value); setSubjectId(""); setRecords({}); setExistingAttendance([]) }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
          <option value="">اختر القسم</option>
          {[...new Map(assignments.map((a) => [a.classroom.id, a.classroom])).entries()].map(([id, c]) => (
            <option key={id} value={id}>{c.name} - {(c as any).level?.name}</option>
          ))}
        </select>
        {classroomId && (
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">اختر المادة</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {subjectId && (
        <>
          <Card padding="sm" className="mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                التاريخ: {new Date(selectedDate).toLocaleDateString("ar-MR")} · {students.length} تلميذ
                {existingAttendance.length > 0 && " · تم التعديل سابقاً"}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={markAllPresent} disabled={students.length === 0}>
                  <Check className="h-4 w-4" /> الكل حاضر
                </Button>
                <button onClick={() => { setRecords({}); setExistingAttendance([]) }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> إعادة تعيين
                </button>
              </div>
            </div>
          </Card>

          <Card padding="sm">
            {loadingStudents || loadingExisting ? (
              <LoadingSpinner />
            ) : fetchError ? (
              <ErrorDisplay message="تعذر تحميل سجل الغياب" onRetry={() => setRetryTrigger(n => n + 1)} />
            ) : students.length === 0 ? (
              <p className="text-center text-gray-400 py-8">لا يوجد تلاميذ في هذا القسم</p>
            ) : (
              <div className="divide-y">
                {students.map((s, i) => {
                  const status = getStatus(s.id)
                  const { icon: Icon, variant, label } = STATUS_CONFIG[status]
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors"
                      onClick={() => toggle(s.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400 w-6">{i + 1}</span>
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                      </div>
                      <Badge variant={variant}>
                        <Icon className="h-3 w-3" /> {label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Button
            fullWidth size="lg" loading={saving} onClick={save} className="mt-6"
            disabled={!classroomId || !subjectId || students.length === 0}
          >
            <Save className="h-5 w-5" />
            حفظ الغياب وإرسال الإشعارات
          </Button>
        </>
      )}
    </div>
  )
}

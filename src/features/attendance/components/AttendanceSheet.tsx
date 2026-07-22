"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useStudents } from "@/hooks/useStudents"
import { api } from "@/lib/api"
import { Badge, Button, Card, ErrorDisplay, LoadingSpinner, TeacherSubNav } from "@/components/ui"
import { Calendar, Check, Clock, Save, Users, X } from "lucide-react"
import toast from "react-hot-toast"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"

type AttendanceStatus = "present" | "absent"

type ScheduleEntry = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  classroomId: string
  subjectId: string
  teacherId: string | null
  classroom: { id: string; name: string; level: { name: string }; stream?: { name: string } | null }
  subject: { id: string; nameAr: string; nameFr?: string | null }
}

type TeacherInfo = { id: string }

function getDateDayOfWeek(date: string) {
  return new Date(`${date}T12:00:00`).getDay()
}

export function AttendanceSheet() {
  const locale = useLocale()
  const t = useTranslations("attendanceSheet")
  const tCommon = useTranslations("common")
  const tStatus = useTranslations("status")
  const searchParams = useSearchParams()
  const initialClassroom = searchParams?.get("classroomId") || ""
  const initialSubject = searchParams?.get("subjectId") || ""

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState("")
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [existingAttendance, setExistingAttendance] = useState<any[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const selectedSchedule = scheduleEntries.find((entry) => entry.id === selectedScheduleId) || null
  const { students, loading: loadingStudents } = useStudents(selectedSchedule?.classroomId || "")

  const daySchedule = useMemo(() => {
    const dayOfWeek = getDateDayOfWeek(selectedDate)
    return scheduleEntries
      .filter((entry) => entry.dayOfWeek === dayOfWeek)
      .sort((first, second) => first.startTime.localeCompare(second.startTime))
  }, [scheduleEntries, selectedDate])

  useEffect(() => {
    let cancelled = false

    async function loadSchedule() {
      setLoadingSchedule(true)
      const teacherRes = await api.get<TeacherInfo>("/api/teacher/me")
      if (!teacherRes.data) {
        if (!cancelled) {
          toast.error(teacherRes.error || t("loadTeacherError"))
          setLoadingSchedule(false)
        }
        return
      }

      const scheduleRes = await api.get<ScheduleEntry[]>(`/api/school/schedules?teacherId=${teacherRes.data.id}`)
      if (cancelled) return

      if (scheduleRes.error) {
        toast.error(scheduleRes.error || t("loadScheduleError"))
        setFetchError(true)
      } else {
        setScheduleEntries(scheduleRes.data || [])
      }
      setLoadingSchedule(false)
    }

    void loadSchedule()
    return () => { cancelled = true }
  }, [t])

  useEffect(() => {
    if (daySchedule.length === 0) {
      setSelectedScheduleId("")
      return
    }

    const currentSelectionStillVisible = daySchedule.some((entry) => entry.id === selectedScheduleId)
    if (currentSelectionStillVisible) return

    const initialMatch = daySchedule.find(
      (entry) => entry.classroomId === initialClassroom && entry.subjectId === initialSubject
    )
    setSelectedScheduleId((initialMatch || daySchedule[0]).id)
  }, [daySchedule, initialClassroom, initialSubject, selectedScheduleId])

  useEffect(() => {
    if (!selectedSchedule) {
      setExistingAttendance([])
      setRecords({})
      return
    }

    let cancelled = false
    setLoadingExisting(true)
    setFetchError(false)
    api.get<any[]>(`/api/attendance?scheduleId=${selectedSchedule.id}&date=${selectedDate}`)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          toast.error(error)
          setFetchError(true)
          return
        }
        if (data && data.length > 0) {
          setExistingAttendance(data)
          const map: Record<string, AttendanceStatus> = {}
          for (const item of data) {
            map[item.studentId] = String(item.status).toUpperCase() === "ABSENT" ? "absent" : "present"
          }
          setRecords(map)
        } else {
          setExistingAttendance([])
          setRecords({})
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("loadError"))
          setFetchError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false)
      })

    return () => { cancelled = true }
  }, [selectedSchedule, selectedDate, retryTrigger, t])

  function getStatus(studentId: string): AttendanceStatus {
    return records[studentId] || "present"
  }

  function toggle(studentId: string) {
    setRecords((current) => ({
      ...current,
      [studentId]: getStatus(studentId) === "absent" ? "present" : "absent",
    }))
  }

  async function save() {
    if (!selectedSchedule) {
      toast.error(t("missingSession"))
      return
    }

    setSaving(true)
    try {
      const { error } = await api.post("/api/attendance", {
        scheduleId: selectedSchedule.id,
        classroomId: selectedSchedule.classroomId,
        subjectId: selectedSchedule.subjectId,
        date: selectedDate,
        records: students.map((student) => ({
          studentId: student.id,
          status: getStatus(student.id).toUpperCase(),
        })),
      })

      if (error) toast.error(error)
      else {
        toast.success(t("saveSuccess"))
        setRetryTrigger((current) => current + 1)
      }
    } catch {
      toast.error(t("saveError"))
    }
    setSaving(false)
  }

  if (loadingSchedule) return <LoadingSpinner message={tCommon("loading")} />

  const absentCount = students.filter((student) => getStatus(student.id) === "absent").length
  const presentCount = selectedSchedule ? students.length - absentCount : 0

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("scheduleBasedSubtitle")}</p>
          </div>
          {existingAttendance.length > 0 && <Badge variant="info">{t("existingRecord")}</Badge>}
        </div>

        <TeacherSubNav
          current="attendance"
          classroomId={selectedSchedule?.classroomId || initialClassroom}
          subjectId={selectedSchedule?.subjectId || initialSubject}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4 text-blue-600" />
            {t("attendanceDate")}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <Card padding="md" className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{t("todaySessions")}</h2>
            <p className="mt-1 text-xs text-gray-500">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(getDateLocale(locale))}</p>
          </div>
          <Badge variant={daySchedule.length ? "info" : "default"}>{daySchedule.length}</Badge>
        </div>

        {daySchedule.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <Clock className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">{t("noSessionsForDate")}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {daySchedule.map((entry) => {
              const selected = entry.id === selectedScheduleId
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedScheduleId(entry.id)}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    selected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-950">{getLocalizedSubjectName(entry.subject, locale)}</p>
                      <p className="mt-1 text-sm text-gray-600">{entry.classroom.name}</p>
                      <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        {entry.startTime} - {entry.endTime}
                      </p>
                    </div>
                    {selected && <Badge variant="info">{t("selectedSession")}</Badge>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {selectedSchedule && (
        <>
          <Card padding="md" className="mb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">{t("studentNumbers")}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {t("sessionSummary", {
                    classroom: selectedSchedule.classroom.name,
                    subject: getLocalizedSubjectName(selectedSchedule.subject, locale),
                    start: selectedSchedule.startTime,
                    end: selectedSchedule.endTime,
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Badge variant="success"><Check className="h-3 w-3" /> {presentCount}</Badge>
                {absentCount > 0 && <Badge variant="danger"><X className="h-3 w-3" /> {absentCount}</Badge>}
              </div>
            </div>
          </Card>

          <Card padding="md">
            {loadingStudents || loadingExisting ? (
              <LoadingSpinner />
            ) : fetchError ? (
              <ErrorDisplay message={t("recordLoadError")} onRetry={() => setRetryTrigger((current) => current + 1)} />
            ) : students.length === 0 ? (
              <p className="py-8 text-center text-gray-400">{t("emptyClassroom")}</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {students.map((student, index) => {
                  const status = getStatus(student.id)
                  const absent = status === "absent"
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggle(student.id)}
                      className={`aspect-square rounded-2xl border text-2xl font-black transition-all active:scale-95 ${
                        absent
                          ? "border-red-500 bg-red-600 text-white shadow-lg shadow-red-100"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                      aria-label={`${index + 1} - ${student.firstName} ${student.lastName} - ${absent ? tStatus("absent") : tStatus("present")}`}
                      title={`${index + 1} - ${student.firstName} ${student.lastName}`}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-4 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
            <Button
              fullWidth
              size="lg"
              loading={saving}
              onClick={save}
              disabled={!selectedSchedule || students.length === 0}
            >
              <Save className="h-5 w-5" />
              {t("saveAttendance")}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

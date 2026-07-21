"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Button, Card, ConfirmModal, ErrorDisplay, LoadingPage } from "@/components/ui"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  RefreshCw,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react"
import toast from "react-hot-toast"

type SessionEntry = {
  scheduleId: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  subjectName: string
  subjectNameFr?: string | null
  classroomName: string
  levelName: string
  streamName: string | null
  startTime: string
  endTime: string
  status: string | null
  notes: string
  confirmedBy: string | null
}

type SessionData = {
  date: string
  sessions: SessionEntry[]
}

export function TeacherRosterManager() {
  const { data: session } = useSession()
  const user = session?.user as any
  const locale = useLocale()
  const t = useTranslations("teacherAttendancePage")
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0])
  const [fetchError, setFetchError] = useState(false)
  const [retryTrigger, setRetryTrigger] = useState(0)
  const [bulkMarkStatus, setBulkMarkStatus] = useState<string | null>(null)

  const isSupervisor = user?.role === "SUPERVISOR" || user?.role === "SCHOOL_ADMIN"

  const statusOptions = [
    { value: "PRESENT", label: t("statusPresent"), icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200" },
    { value: "ABSENT", label: t("statusAbsent"), icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
    { value: "LATE", label: t("statusLate"), icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { value: "EXCUSED", label: t("statusExcused"), icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
  ]

  const fetchData = useCallback(async () => {
    if (!isSupervisor) return
    void retryTrigger
    setLoading(true)
    setFetchError(false)
    try {
      const { data: result, error } = await api.get<SessionData>(`/api/teacher-attendance?date=${dateStr}`)
      if (error) {
        toast.error(error)
        setFetchError(true)
        setLoading(false)
        return
      }
      setData(result || null)
    } catch {
      setFetchError(true)
      toast.error(t("loadError"))
    }
    setLoading(false)
  }, [dateStr, isSupervisor, retryTrigger, t])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function markSession(scheduleId: string, status: string) {
    setSaving(scheduleId)
    try {
      const { error } = await api.post("/api/teacher-attendance", {
        action: "mark",
        scheduleId,
        status,
        date: dateStr,
      })
      if (error) toast.error(error)
      else {
        toast.success(t("updated"))
        void fetchData()
      }
    } catch {
      toast.error(t("markError"))
    }
    setSaving(null)
  }

  async function handleBulkMark() {
    if (!bulkMarkStatus) return
    setLoading(true)
    const visibleScheduleIds = filteredSessions.map((item) => item.scheduleId)
    setBulkMarkStatus(null)
    try {
      const { error } = await api.post("/api/teacher-attendance", {
        action: "bulk-mark",
        status: bulkMarkStatus,
        date: dateStr,
        scheduleIds: visibleScheduleIds,
      })
      if (error) toast.error(error)
      else {
        toast.success(t("bulkMarked"))
        void fetchData()
      }
    } catch {
      toast.error(t("bulkMarkError"))
    }
  }

  const allSessions = data?.sessions || []
  const filteredSessions = allSessions.filter((entry) => {
    if (!filter) return true
    if (filter === "unmarked") return !entry.status
    if (filter === "marked") return !!entry.status
    if (filter === "present") return entry.status === "PRESENT"
    if (filter === "absent") return entry.status === "ABSENT"
    if (filter === "late") return entry.status === "LATE"
    if (filter === "excused") return entry.status === "EXCUSED"
    return true
  })

  const groupedTeachers = useMemo(() => {
    const teacherMap = new Map<string, { teacherId: string; teacherName: string; teacherEmail: string; sessions: SessionEntry[] }>()
    for (const sessionEntry of filteredSessions) {
      if (!teacherMap.has(sessionEntry.teacherId)) {
        teacherMap.set(sessionEntry.teacherId, {
          teacherId: sessionEntry.teacherId,
          teacherName: sessionEntry.teacherName,
          teacherEmail: sessionEntry.teacherEmail,
          sessions: [],
        })
      }
      teacherMap.get(sessionEntry.teacherId)!.sessions.push(sessionEntry)
    }
    return Array.from(teacherMap.values())
  }, [filteredSessions])

  const presentCount = allSessions.filter((item) => item.status === "PRESENT").length
  const absentCount = allSessions.filter((item) => item.status === "ABSENT").length
  const unmarkedCount = allSessions.filter((item) => !item.status).length
  const totalSessions = allSessions.length

  if (!isSupervisor) {
    return (
      <Card>
        <div className="py-12 text-center">
          <XCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">{t("unauthorized")}</p>
        </div>
      </Card>
    )
  }

  if (fetchError) {
    return <ErrorDisplay message={t("loadError")} onRetry={() => setRetryTrigger((value) => value + 1)} />
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            <Calendar className="inline h-4 w-4" />{" "}
            {new Date(dateStr).toLocaleDateString(getDateLocale(locale), { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button variant="ghost" size="sm" onClick={() => void fetchData()} aria-label={t("refreshData")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card padding="md">
          <div className="flex items-center gap-2 text-green-600">
            <UserCheck className="h-5 w-5" />
            <span className="text-sm font-medium">{t("statusPresent")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{presentCount}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-red-600">
            <UserX className="h-5 w-5" />
            <span className="text-sm font-medium">{t("statusAbsent")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{absentCount}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{t("statusUnmarked")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{unmarkedCount}</p>
        </Card>
        <Card padding="md" className={unmarkedCount > 0 ? "border-blue-200 bg-blue-50" : ""}>
          <div className="flex items-center gap-2 text-blue-600">
            <Calendar className="h-5 w-5" />
            <span className="text-sm font-medium">{t("todaySchedule")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{totalSessions}</p>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {statusOptions.map((option) => (
            <Button key={option.value} variant="secondary" size="sm" onClick={() => setBulkMarkStatus(option.value)}>
              <option.icon className="h-4 w-4" /> {t("markAllStatus", { status: option.label })}
            </Button>
          ))}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-52 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("allSessions")}</option>
          <option value="unmarked">{t("filterUnmarked")}</option>
          <option value="marked">{t("filterMarked")}</option>
          <option value="present">{t("filterPresent")}</option>
          <option value="absent">{t("filterAbsent")}</option>
          <option value="late">{t("filterLate")}</option>
          <option value="excused">{t("filterExcused")}</option>
        </select>
      </div>

      {groupedTeachers.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <UserCheck className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">{t("noSessions")}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedTeachers.map((teacher) => (
            <Card key={teacher.teacherId} padding="lg">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{teacher.teacherName}</h2>
                  <p className="text-xs text-gray-500">{t("sessionsCount", { count: teacher.sessions.length })}</p>
                </div>
              </div>

              <div className="space-y-3">
                {teacher.sessions.map((entry) => {
                  const currentStatus = entry.status || ""
                  const localizedSubject = getLocalizedSubjectName({ nameAr: entry.subjectName, nameFr: entry.subjectNameFr }, locale)
                  return (
                    <div key={entry.scheduleId} className="rounded-xl border border-gray-200 p-4">
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{localizedSubject}</p>
                            <Badge variant="info">{entry.classroomName}</Badge>
                            <Badge variant="default">{entry.startTime} - {entry.endTime}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>{entry.streamName || entry.levelName}</span>
                            {entry.confirmedBy ? <span>{t("confirmedBy", { name: entry.confirmedBy })}</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {statusOptions.map((option) => {
                            const isActive = currentStatus === option.value
                            return (
                              <button
                                key={option.value}
                                onClick={() => void markSession(entry.scheduleId, option.value)}
                                disabled={saving === entry.scheduleId}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                  isActive
                                    ? `${option.color} ring-1 ring-offset-1`
                                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                                }`}
                              >
                                <option.icon className="ml-1 inline h-3.5 w-3.5" />
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!bulkMarkStatus}
        onClose={() => setBulkMarkStatus(null)}
        onConfirm={() => void handleBulkMark()}
        title={t("bulkMarkTitle")}
        message={t("bulkMarkMessage", {
          status: bulkMarkStatus ? statusOptions.find((item) => item.value === bulkMarkStatus)?.label || "" : "",
        })}
        confirmText={t("confirm")}
        cancelText={t("cancel")}
        variant={bulkMarkStatus === "ABSENT" ? "danger" : "primary"}
      />
    </div>
  )
}

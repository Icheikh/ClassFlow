"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Badge, Modal, Input, LoadingPage } from "@/components/ui"
import { addUtcDays, formatDateOnly, getWeekStartDate } from "@/lib/date"
import {
  ArrowLeft,
  BookOpen,
  School,
  Calendar,
  Phone,
  Mail,
  ChevronRight,
  Wallet,
  Clock,
  Link as LinkIcon,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  ChevronLeft,
  ChevronRight as ChevronWeek,
  Printer,
} from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"

type DetailData = {
  teacher: { id: string; phone: string | null; user: { id: string; email: string; name: string; phone: string | null; isActive: boolean } }
  assignments: { id: string; subject: { nameAr: string; nameFr?: string | null; code: string | null }; classroom: { id: string; name: string; level: { name: string } }; hourlyRate: number | null; weeklyHours: number | null }[]
  recentLessons: { id: string; title: string; date: string; status: string; subject: { nameAr: string; nameFr?: string | null }; classroom: { name: string } }[]
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
    recentHourEntries: {
      id: string
      date: string
      hoursTaught: number
      notes: string | null
      subject: string
      classroom: string
      level: string
      stream: string | null
      recordedBy: string
      recordedAt: string
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

export default function TeacherDetailPage() {
  const locale = useLocale()
  const tPage = useTranslations("teacherDetailPage")
  const tCommon = useTranslations("common")
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editAssign, setEditAssign] = useState<{ id: string; hourlyRate: string; weeklyHours: string } | null>(null)
  const [weekStart, setWeekStart] = useState(() => formatDateOnly(getWeekStartDate()))

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    const { data } = await api.get<DetailData>(`/api/school/teachers/${id}?weekStart=${weekStart}`)
    if (data) setData(data)
    setLoading(false)
  }, [id, weekStart])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveAssignmentRate() {
    if (!editAssign) return
    const { error } = await api.put("/api/school/teacher-assignments", {
      id: editAssign.id,
      hourlyRate: editAssign.hourlyRate,
      weeklyHours: editAssign.weeklyHours,
    })
    if (error) toast.error(error)
    else { toast.success(tPage("saved")); setEditAssign(null); fetchData() }
  }

  if (loading) return <LoadingPage />
  if (!data) return <Card><p className="text-center py-8 text-gray-500">{tPage("notFound")}</p></Card>

  const t = data.teacher
  const payroll = data.payroll
  const attendanceLabels: Record<string, { label: string; variant: "success" | "danger" | "warning" | "info" | "default" }> = {
    PRESENT: { label: tPage("present"), variant: "success" },
    ABSENT: { label: tPage("absent"), variant: "danger" },
    LATE: { label: tPage("late"), variant: "warning" },
    EXCUSED: { label: tPage("excused"), variant: "info" },
  }

  function shiftWeek(days: number) {
    const nextWeek = addUtcDays(getWeekStartDate(weekStart), days)
    setWeekStart(formatDateOnly(nextWeek))
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link href="/school/teachers" className="hover:text-blue-600">{tPage("breadcrumbs")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{t.user.name}</span>
      </div>

      <Modal open={!!editAssign} onClose={() => setEditAssign(null)} title={tPage("assignmentRateTitle")}>
        <div className="space-y-4">
          <Input label={tPage("hourlyRateLabel")} type="number" value={editAssign?.hourlyRate || ""}
            onChange={(e) => setEditAssign((prev) => prev ? { ...prev, hourlyRate: e.target.value } : null)} placeholder="250" />
          <Input label={tPage("weeklyHoursLabel")} type="number" value={editAssign?.weeklyHours || ""}
            onChange={(e) => setEditAssign((prev) => prev ? { ...prev, weeklyHours: e.target.value } : null)} placeholder="4" />
          <Button fullWidth onClick={saveAssignmentRate}>{tCommon("save")}</Button>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
            {t.user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {t.user.name}
              <Badge variant={t.user.isActive ? "success" : "danger"}>
                {t.user.isActive ? tPage("active") : tPage("inactive")}
              </Badge>
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {t.user.email}</span>
              {t.user.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {t.user.phone}</span>}
            </div>
          </div>
        </div>
        <Link href="/school/teachers">
          <Button variant="secondary">                <ArrowLeft className="h-4 w-4" /> {tPage("back")}</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.assignments}</p><p className="text-xs text-gray-500">{tPage("subjectsCount")}</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><Calendar className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.lessonsThisMonth}</p><p className="text-xs text-gray-500">{tPage("lessonsThisMonth")}</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold">{payroll.totalHours}</p><p className="text-xs text-gray-500">{tPage("weekHours")}</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold">{payroll.estimatedEarnings.toLocaleString()}</p><p className="text-xs text-gray-500">{tPage("weeklyEstimatedPay")}</p></div>
          </div>
        </Card>
      </div>

      <Card padding="lg" className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /> {tPage("weeklyTracking")}</h3>
            <p className="text-xs text-gray-500 mt-1">{tPage("weekRange", { start: payroll.weekStart, end: payroll.weekEnd })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => shiftWeek(-7)} aria-label={tPage("previousWeek")}>
              <ChevronWeek className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(formatDateOnly(getWeekStartDate(e.target.value)))}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <Button variant="secondary" size="sm" onClick={() => shiftWeek(7)} aria-label={tPage("nextWeek")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Link href={`/school/teachers/${t.id}/weekly-report?weekStart=${weekStart}`} target="_blank" aria-label={tPage("printWeeklyReport")}>
              <Button variant="secondary" size="sm">
                <Printer className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="success"><UserCheck className="h-3 w-3" /> {tPage("attendanceDays", { count: payroll.attendanceSummary.presentDays })}</Badge>
            <Badge variant="danger"><AlertTriangle className="h-3 w-3" /> {tPage("absenceDays", { count: payroll.attendanceSummary.absentDays })}</Badge>
            {payroll.attendanceSummary.lateDays > 0 && (
              <Badge variant="warning">{tPage("lateDays", { count: payroll.attendanceSummary.lateDays })}</Badge>
            )}
            {payroll.attendanceSummary.excusedDays > 0 && (
              <Badge variant="info">{tPage("excusedDays", { count: payroll.attendanceSummary.excusedDays })}</Badge>
            )}
          </div>
        </div>

        <div className="grid gap-4 mb-6 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">{tPage("earningsSourceTitle")}</p>
            <p className="mt-2 text-gray-600">{tPage("earningsSourceText")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">{tPage("incompleteEarningsTitle")}</p>
            <p className="mt-2 text-gray-600">{tPage("incompleteEarningsText")}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <p className="font-medium text-blue-900">{tPage("fixDataTitle")}</p>
            <div className="mt-2 space-y-1">
              <Link href="/school/teaching-hours" className="block text-blue-700 hover:underline">{tPage("editTeachingHours")}</Link>
              <Link href="/school/teacher-attendance" className="block text-blue-700 hover:underline">{tPage("reviewAttendance")}</Link>
              <Link href={`/school/payroll?weekStart=${payroll.weekStart}`} className="block text-blue-700 hover:underline">{tPage("openPayroll")}</Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{tPage("weeklyAttendanceLog")}</h4>
            {payroll.attendanceRecords.length === 0 ? (
              <p className="text-sm text-gray-400">{tPage("noAttendanceThisWeek")}</p>
            ) : (
              <div className="space-y-2">
                {payroll.attendanceRecords.map((record) => {
                  const status = attendanceLabels[record.status] || { label: record.status, variant: "default" as const }
                  return (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{record.date}</p>
                        <p className="text-xs text-gray-500">{tPage("recordedBy", { name: record.markedBy })}</p>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{tPage("recentHoursTitle")}</h4>
            {payroll.recentHourEntries.length === 0 ? (
              <p className="text-sm text-gray-400">{tPage("noHoursThisWeek")}</p>
            ) : (
              <div className="space-y-2">
                {payroll.recentHourEntries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-gray-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{entry.subject} - {entry.classroom}</p>
                        <p className="text-xs text-gray-500">{entry.date} · {entry.recordedBy}</p>
                      </div>
                      <Badge variant="info">{tPage("hoursShort", { count: entry.hoursTaught })}</Badge>
                    </div>
                    {entry.notes && <p className="text-xs text-gray-500 mt-2">{entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card padding="lg" className="mb-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Calendar className="h-5 w-5" /> {tPage("weeklyTimelineTitle")}</h3>
        {payroll.activityTimeline.length === 0 ? (
          <p className="text-sm text-gray-400">{tPage("noWeeklyEvents")}</p>
        ) : (
          <div className="space-y-2">
            {payroll.activityTimeline.map((event) => (
              <div key={event.id} className="rounded-lg border border-gray-200 px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{event.subtitle}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-xs text-gray-500">{event.date}</p>
                    <p className="text-xs text-gray-400">{new Date(event.recordedAt).toLocaleTimeString(getDateLocale(locale), { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                {event.notes && <p className="text-xs text-gray-500 mt-2">{event.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Classrooms */}
      <Card padding="md" className="mb-6">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2"><School className="h-4 w-4" /> {tPage("classroomsTitle")}</h3>
        <div className="flex flex-wrap gap-2">
          {data.assignments.map((a) => (
            <Link key={a.id} href={`/school/classrooms/${a.classroom.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors">
              <LinkIcon className="h-3.5 w-3.5" />
              {a.classroom.name} - {a.classroom.level.name}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Assignments */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" /> {tPage("assignmentsTitle", { count: data.assignments.length })}</h3>
          </div>
          {data.assignments.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">{tPage("noAssignments")}</p>
          ) : (
            <div className="space-y-2">
              {data.assignments.map((a) => (
                <div key={a.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  {(() => {
                    const summary = payroll.assignmentSummaries.find((item) => item.id === a.id)
                    return (
                      <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">{getLocalizedSubjectName(a.subject, locale)}</span>
                      <Link href={`/school/classrooms/${a.classroom.id}`} className="text-xs text-blue-600 hover:underline">
                        {a.classroom.name} - {a.classroom.level.name}
                      </Link>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() =>
                      setEditAssign({ id: a.id, hourlyRate: String(a.hourlyRate || ""), weeklyHours: String(a.weeklyHours || "") })
                    } aria-label={tPage("editRateAria")}>
                      <Wallet className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {a.hourlyRate ? (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        {tPage("hourlyRateShort", { value: a.hourlyRate })}
                      </span>
                    ) : (
                      <span className="text-gray-300 cursor-pointer" onClick={() =>
                        setEditAssign({ id: a.id, hourlyRate: "", weeklyHours: "" })
                      }>{tPage("setRate")}</span>
                    )}
                    {a.weeklyHours && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {tPage("weeklyHoursShort", { value: a.weeklyHours })}
                      </span>
                    )}
                  </div>
                  {summary?.entryCount ? (
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span className="text-blue-700">
                        {tPage("weekHoursSummary", { value: summary.totalHours })}
                      </span>
                      <span className="text-green-700">
                        {tPage("weeklyPaySummary", { value: summary.estimatedEarnings.toLocaleString() })}
                      </span>
                    </div>
                  ) : null}
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Lessons */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> {tPage("recentLessonsTitle", { count: data.recentLessons.length })}</h3>
          </div>
          {data.recentLessons.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">{tPage("noLessons")}</p>
          ) : (
            <div className="space-y-2">
              {data.recentLessons.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>{getLocalizedSubjectName(l.subject, locale)}</span><span>·</span>
                      <span>{l.classroom.name}</span><span>·</span>
                      <span>{new Date(l.date).toLocaleDateString(getDateLocale(locale))}</span>
                    </div>
                  </div>
                  <Badge variant={l.status === "SUBMITTED" ? "success" : l.status === "DRAFT" ? "warning" : "default"} className="shrink-0">
                    {l.status === "SUBMITTED" ? tPage("submitted") : l.status === "DRAFT" ? tPage("draft") : l.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-5 w-5" /> {tPage("weeklyAssignmentsSummary")}</h3>
          <Link href={`/school/payroll?weekStart=${payroll.weekStart}`} className="text-sm text-blue-700 hover:underline">
            {tPage("openPayroll")}
          </Link>
        </div>

        {payroll.assignmentSummaries.length === 0 ? (
          <p className="text-sm text-gray-400">{tPage("activeAssignmentsNone")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-400 text-xs">
                  <th className="text-right py-2 px-2">{tPage("subject")}</th>
                  <th className="text-right py-2 px-2">{tPage("classroom")}</th>
                  <th className="text-center py-2 px-2">{tPage("expected")}</th>
                  <th className="text-center py-2 px-2">{tPage("recorded")}</th>
                  <th className="text-center py-2 px-2">{tPage("hourlyRatePerHour")}</th>
                  <th className="text-center py-2 px-2">{tPage("estimatedPay")}</th>
                  <th className="text-right py-2 px-2">{tPage("lastEntry")}</th>
                </tr>
              </thead>
              <tbody>
                {payroll.assignmentSummaries.map((assignment) => (
                  <tr key={assignment.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{assignment.subject}</td>
                    <td className="py-2 px-2 text-gray-600">{assignment.classroom} - {assignment.level}</td>
                    <td className="py-2 px-2 text-center">{assignment.weeklyHours ?? <span className="text-gray-300">—</span>}</td>
                    <td className="py-2 px-2 text-center">{assignment.totalHours}</td>
                    <td className="py-2 px-2 text-center">{assignment.hourlyRate ?? <span className="text-gray-300">—</span>}</td>
                    <td className="py-2 px-2 text-center font-medium text-green-700">
                      {assignment.hourlyRate != null ? assignment.estimatedEarnings.toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-500">
                      {assignment.lastRecordedBy
                        ? `${assignment.lastRecordedBy} · ${new Date(assignment.lastRecordedAt || "").toLocaleString(getDateLocale(locale))}`
                        : "—"}
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

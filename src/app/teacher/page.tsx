"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  School,
  Wallet,
} from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, ErrorDisplay, LoadingPage } from "@/components/ui"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"

type TeacherAssignmentSummary = {
  id: string
  classroom: { id: string; name: string; level: { name: string }; stream: { name: string } | null }
  subject: { id: string; nameAr: string; nameFr?: string | null }
  hourlyRate: number | null
  weeklyHours: number | null
  expectedScheduleHours: number
  confirmedHours: number
  compensationHours: number
  totalHours: number
  estimatedEarnings: number | null
}

type TodaySession = {
  id: string
  startTime: string
  endTime: string
  duration: number
  classroom: { id: string; name: string; level: { name: string }; stream: { name: string } | null }
  subject: { id: string; nameAr: string; nameFr?: string | null }
  status: string | null
  notes: string | null
  confirmedBy: string | null
}

type TeacherNotification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

type TeacherSummary = {
  teacher: { id: string; name: string; email: string }
  activeYear: { id: string; name: string } | null
  weekStart: string
  weekEnd: string
  assignments: TeacherAssignmentSummary[]
  todaySessions: TodaySession[]
  attendanceSummary: {
    total: number
    confirmed: number
    pending: number
    present: number
    absent: number
    late: number
    excused: number
  }
  weeklyPayroll: {
    confirmedHours: number
    compensationHours: number
    totalHours: number
    estimatedEarnings: number
    missingRates: number
  }
  notifications: TeacherNotification[]
  unreadNotifications: number
}

export default function TeacherPage() {
  const locale = useLocale()
  const t = useTranslations("teacherHome")
  const { data: session } = useSession()
  const [summary, setSummary] = useState<TeacherSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  async function fetchData() {
    setFetchError(false)
    setLoading(true)
    const { data, error } = await api.get<TeacherSummary>("/api/teacher/summary")
    if (error || !data) {
      setFetchError(true)
    } else {
      setSummary(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
  }, [])

  if (loading) return <LoadingPage />

  if (fetchError || !summary) {
    return (
      <div className="my-20">
        <ErrorDisplay onRetry={() => void fetchData()} />
      </div>
    )
  }

  const attendanceBadge = summary.attendanceSummary.pending
    ? { label: t("attendancePending"), variant: "default" as const, icon: Clock }
    : summary.attendanceSummary.absent
      ? { label: t("attendanceAbsent"), variant: "danger" as const, icon: AlertTriangle }
      : summary.attendanceSummary.late
        ? { label: t("attendanceLate"), variant: "warning" as const, icon: AlertTriangle }
        : summary.attendanceSummary.excused
          ? { label: t("attendanceExcused"), variant: "info" as const, icon: CheckCircle2 }
          : summary.attendanceSummary.confirmed
            ? { label: t("attendanceConfirmed"), variant: "success" as const, icon: CheckCircle2 }
            : { label: t("attendanceNoLessons"), variant: "default" as const, icon: Clock }
  const AttendanceIcon = attendanceBadge.icon
  const uniqueClassrooms = [...new Set(summary.assignments.map((assignment) => assignment.classroom.id))].length
  const formattedToday = new Date().toLocaleDateString(getDateLocale(locale), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("greeting", { name: session?.user?.name || summary.teacher.name })}</h1>
          <p className="mt-1 text-sm text-gray-500">
            <Calendar className="inline h-4 w-4" /> {formattedToday}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {summary.activeYear ? summary.activeYear.name : t("noActiveYear")}
          </p>
        </div>
        <Badge variant={attendanceBadge.variant}>
          <AttendanceIcon className="h-3 w-3" /> {attendanceBadge.label}
        </Badge>
      </div>

      <Card padding="md" className="bg-blue-50 border-blue-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-blue-700">{t("attendanceInfo")}</p>
          <Link href="/teacher/schedule">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4" />
              {t("openSchedule")}
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <SummaryTile icon={BookOpen} label={t("assignments")} value={summary.assignments.length} tone="blue" />
        <SummaryTile icon={School} label={t("classes")} value={uniqueClassrooms} tone="green" />
        <SummaryTile icon={Clock} label={t("todayLessons")} value={summary.todaySessions.length} tone="amber" />
        <SummaryTile icon={ClipboardCheck} label={t("confirmedToday")} value={`${summary.attendanceSummary.confirmed}/${summary.attendanceSummary.total}`} tone="cyan" />
        <SummaryTile icon={Wallet} label={t("weeklyHours")} value={summary.weeklyPayroll.totalHours} tone="slate" />
        <SummaryTile icon={Wallet} label={t("estimatedSalary")} value={t("currencyValue", { value: summary.weeklyPayroll.estimatedEarnings.toLocaleString() })} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("todayScheduleTitle")}</h2>
              <p className="mt-1 text-xs text-gray-500">{t("todayScheduleSubtitle")}</p>
            </div>
            <Badge variant={summary.attendanceSummary.pending ? "warning" : "success"}>
              {t("pendingCount", { count: summary.attendanceSummary.pending })}
            </Badge>
          </div>

          {summary.todaySessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{t("noTodaySessions")}</p>
          ) : (
            <div className="space-y-3">
              {summary.todaySessions.map((sessionItem) => (
                <div key={sessionItem.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{getLocalizedSubjectName(sessionItem.subject, locale)}</p>
                        <Badge variant="info">{sessionItem.classroom.name}</Badge>
                        <Badge variant={getStatusVariant(sessionItem.status)}>{getStatusLabel(sessionItem.status, t)}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {sessionItem.classroom.level.name}
                        {sessionItem.classroom.stream ? ` · ${sessionItem.classroom.stream.name}` : ""}
                        {sessionItem.confirmedBy ? ` · ${t("confirmedBy", { name: sessionItem.confirmedBy })}` : ""}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">
                      {sessionItem.startTime} - {sessionItem.endTime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t("attendanceAlertsTitle")}</h2>
            <Badge variant={summary.unreadNotifications ? "warning" : "default"}>
              <Bell className="h-3 w-3" />
              {summary.unreadNotifications}
            </Badge>
          </div>

          <div className="space-y-3">
            <AlertLine tone={summary.attendanceSummary.absent ? "danger" : "success"} text={t("absentSummary", { count: summary.attendanceSummary.absent })} />
            <AlertLine tone={summary.attendanceSummary.late ? "warning" : "success"} text={t("lateSummary", { count: summary.attendanceSummary.late })} />
            <AlertLine tone={summary.attendanceSummary.pending ? "warning" : "success"} text={t("pendingSummary", { count: summary.attendanceSummary.pending })} />
          </div>

          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("notificationsTitle")}</h3>
            {summary.notifications.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noNotifications")}</p>
            ) : (
              <div className="space-y-3">
                {summary.notifications.map((notification) => (
                  <div key={notification.id} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      {!notification.read ? <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{notification.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">{t("myAssignments")}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {t("weekRange", { start: summary.weekStart, end: summary.weekEnd })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{t("confirmedHoursValue", { count: summary.weeklyPayroll.confirmedHours })}</Badge>
            <Badge variant="default">{t("compensationHoursValue", { count: summary.weeklyPayroll.compensationHours })}</Badge>
            {summary.weeklyPayroll.missingRates > 0 ? (
              <Badge variant="warning">{t("missingRates", { count: summary.weeklyPayroll.missingRates })}</Badge>
            ) : null}
          </div>
        </div>

        {summary.assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t("noAssignments")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-400">
                  <th className="px-2 py-2 text-right">{t("subject")}</th>
                  <th className="px-2 py-2 text-right">{t("classroom")}</th>
                  <th className="px-2 py-2 text-center">{t("hourlyRate")}</th>
                  <th className="px-2 py-2 text-center">{t("scheduleHours")}</th>
                  <th className="px-2 py-2 text-center">{t("confirmedHours")}</th>
                  <th className="px-2 py-2 text-center">{t("compensationHours")}</th>
                  <th className="px-2 py-2 text-center">{t("estimatedEarning")}</th>
                  <th className="px-2 py-2 text-center">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-3 font-medium">{getLocalizedSubjectName(assignment.subject, locale)}</td>
                    <td className="px-2 py-3 text-gray-600">
                      {assignment.classroom.name}
                      <span className="mr-1 text-xs text-gray-400">
                        {assignment.classroom.stream ? `· ${assignment.classroom.stream.name}` : `· ${assignment.classroom.level.name}`}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center text-amber-700">
                      {assignment.hourlyRate != null ? t("rateValue", { value: assignment.hourlyRate }) : "—"}
                    </td>
                    <td className="px-2 py-3 text-center">{assignment.expectedScheduleHours}</td>
                    <td className="px-2 py-3 text-center">{assignment.confirmedHours}</td>
                    <td className="px-2 py-3 text-center">{assignment.compensationHours || "—"}</td>
                    <td className="px-2 py-3 text-center font-bold text-green-700">
                      {assignment.estimatedEarnings != null
                        ? t("currencyValue", { value: assignment.estimatedEarnings.toLocaleString() })
                        : "—"}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-center gap-1">
                        <Link href={`/teacher/attendance?classroomId=${assignment.classroom.id}&subjectId=${assignment.subject.id}`} aria-label={t("recordAttendance")}>
                          <Button variant="ghost" size="sm"><ClipboardCheck className="h-4 w-4" /></Button>
                        </Link>
                        <Link href={`/teacher/lessons?classroomId=${assignment.classroom.id}&subjectId=${assignment.subject.id}`} aria-label={t("recordLessons")}>
                          <Button variant="ghost" size="sm"><BookOpen className="h-4 w-4" /></Button>
                        </Link>
                        <Link href={`/teacher/grades?classroomId=${assignment.classroom.id}&subjectId=${assignment.subject.id}`} aria-label={t("manageGrades")}>
                          <Button variant="ghost" size="sm"><GraduationCap className="h-4 w-4" /></Button>
                        </Link>
                      </div>
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

function SummaryTile({ icon: Icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: string | number; tone: "blue" | "green" | "amber" | "cyan" | "slate" | "emerald" }) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-700",
    cyan: "bg-cyan-50 text-cyan-700",
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone]

  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-gray-500">{label}</p>
          <p className="truncate text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function AlertLine({ text, tone }: { text: string; tone: "success" | "warning" | "danger" }) {
  const className = tone === "danger"
    ? "border-red-200 bg-red-50 text-red-700"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-green-200 bg-green-50 text-green-700"
  return <p className={`rounded-lg border px-3 py-2 text-sm ${className}`}>{text}</p>
}

function getStatusLabel(status: string | null, t: ReturnType<typeof useTranslations<"teacherHome">>) {
  if (status === "PRESENT") return t("statusPresent")
  if (status === "ABSENT") return t("statusAbsent")
  if (status === "LATE") return t("statusLate")
  if (status === "EXCUSED") return t("statusExcused")
  return t("statusPending")
}

function getStatusVariant(status: string | null): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PRESENT") return "success"
  if (status === "ABSENT") return "danger"
  if (status === "LATE") return "warning"
  if (status === "EXCUSED") return "info"
  return "default"
}

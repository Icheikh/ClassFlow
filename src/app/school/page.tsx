"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { api, dashboardApi, type DashboardStats, type DashboardTodaySession } from "@/lib/api"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"
import { Badge, Button, Card, ErrorDisplay, LoadingPage } from "@/components/ui"
import {
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Receipt,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react"

export default function SchoolDashboardPage() {
  const tSchool = useTranslations("school")
  const tDashboard = useTranslations("dashboard")
  const locale = useLocale()
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [savingSession, setSavingSession] = useState<string | null>(null)
  const user = session?.user as any

  async function loadDashboard() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await dashboardApi.stats()

    if (error || !data) {
      setStats(null)
      setLoadError(error || "Failed to load dashboard")
    } else {
      setStats(data)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      setLoading(false)
      setLoadError("Unauthorized")
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      const { data, error } = await dashboardApi.stats()
      if (cancelled) return

      if (error || !data) {
        setStats(null)
        setLoadError(error || "Failed to load dashboard")
      } else {
        setStats(data)
      }

      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [status, retryKey])

  async function markDashboardSession(scheduleId: string, attendanceStatus: "PRESENT" | "ABSENT") {
    setSavingSession(`${scheduleId}:${attendanceStatus}`)
    const { error } = await api.post("/api/teacher-attendance", {
      action: "mark",
      scheduleId,
      status: attendanceStatus,
      date: stats?.today ? stats.today.slice(0, 10) : undefined,
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success(tDashboard("sessionMarked"))
      await loadDashboard()
    }

    setSavingSession(null)
  }

  if (loading) return <LoadingPage />

  if (loadError) {
    return (
      <div className="my-20">
        <ErrorDisplay message={loadError} onRetry={() => setRetryKey((value) => value + 1)} />
      </div>
    )
  }

  const cards = [
    { label: tSchool("students"), value: stats?.stats.students ?? 0, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: tDashboard("activeEnrollments"), value: stats?.stats.activeEnrollments ?? 0, icon: ClipboardCheck, color: "bg-green-50 text-green-600" },
    { label: tSchool("teachers"), value: stats?.stats.teachers ?? 0, icon: GraduationCap, color: "bg-purple-50 text-purple-600" },
    { label: tSchool("classrooms"), value: stats?.stats.classrooms ?? 0, icon: BookOpen, color: "bg-orange-50 text-orange-600" },
    { label: tDashboard("todayAbsences"), value: stats?.stats.todayAbsences ?? 0, icon: CalendarClock, color: "bg-red-50 text-red-600" },
    { label: tDashboard("pendingApprovals"), value: stats?.stats.pendingApprovals ?? 0, icon: BellRing, color: "bg-rose-50 text-rose-600" },
    { label: tDashboard("overdueInvoices"), value: stats?.stats.overdueInvoices ?? 0, icon: Receipt, color: "bg-amber-50 text-amber-700" },
    { label: tDashboard("todayLessons"), value: stats?.stats.todayLessons ?? 0, icon: FileCheck2, color: "bg-cyan-50 text-cyan-700" },
  ]

  const quickActions = [
    { href: "/school/teacher-attendance", label: tDashboard("quickActionAttendance"), icon: ClipboardCheck },
    { href: "/school/results", label: tDashboard("quickActionResults"), icon: FileCheck2 },
    { href: "/school/notifications", label: tDashboard("quickActionNotifications"), icon: BellRing },
    { href: "/school/invoices", label: tDashboard("quickActionFinance"), icon: CreditCard },
    { href: "/school/students", label: tDashboard("quickActionStudents"), icon: Users },
    { href: "/school/settings", label: tDashboard("quickActionSettings"), icon: Settings2 },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">{tDashboard("operatingTitle")}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{tSchool("dashboard")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{tDashboard("operatingSubtitle")}</p>
            <p className="mt-3 text-sm text-slate-500">{stats?.schoolName || user?.school?.name}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ContextBadge
              label={tDashboard("todayLabel")}
              value={stats?.today ? new Date(stats.today).toLocaleDateString(getDateLocale(locale), {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }) : "—"}
            />
            <ContextBadge label={tDashboard("activeYearLabel")} value={stats?.activeYearName || tDashboard("notConfigured")} />
            <ContextBadge label={tDashboard("activeTermLabel")} value={stats?.activeTermName || tDashboard("notConfigured")} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
              </div>
              <div className={`rounded-lg p-3 ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card padding="lg">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">{tDashboard("dailyOperationsTitle")}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{tDashboard("dailyOperationsSubtitle")}</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <OperationMetric label={tDashboard("operationTotal")} value={stats?.dailyOperations.summary.total || 0} />
            <OperationMetric label={tDashboard("operationConfirmed")} value={stats?.dailyOperations.summary.confirmed || 0} tone="success" />
            <OperationMetric label={tDashboard("operationPending")} value={stats?.dailyOperations.summary.pending || 0} tone="warning" />
            <OperationMetric label={tDashboard("operationIssues")} value={(stats?.dailyOperations.summary.absent || 0) + (stats?.dailyOperations.summary.late || 0)} tone="danger" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <SessionPanel
            title={tDashboard("currentSessions")}
            emptyText={tDashboard("noCurrentSessions")}
            sessions={stats?.dailyOperations.currentSessions || []}
            locale={locale}
            t={tDashboard}
          />
          <SessionPanel
            title={tDashboard("pendingSessions")}
            emptyText={tDashboard("noPendingSessions")}
            sessions={stats?.dailyOperations.pendingSessions || []}
            locale={locale}
            t={tDashboard}
            showActions
            savingSession={savingSession}
            onMark={markDashboardSession}
          />
          <SessionPanel
            title={tDashboard("issueSessions")}
            emptyText={tDashboard("noIssueSessions")}
            sessions={stats?.dailyOperations.issueSessions || []}
            locale={locale}
            t={tDashboard}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Link href="/school/teacher-attendance" className="text-sm font-medium text-blue-700 hover:underline">
            {tDashboard("openFullAttendance")}
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-rose-600" />
            <h2 className="text-lg font-semibold">{tDashboard("needsAttention")}</h2>
          </div>
          {stats?.attentionItems.length ? (
            <div className="space-y-3">
              {stats.attentionItems.map((item) => (
                <Link key={item.key} href={item.href} className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{tDashboard(item.title)}</p>
                      <p className="mt-1 text-sm text-slate-500">{tDashboard(item.description)}</p>
                    </div>
                    <span className={attentionToneClass(item.tone)}>{item.count}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{tDashboard("allStable")}</p>
          )}
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">{tDashboard("dailyChecklist")}</h2>
          </div>
          <div className="space-y-4">
            {stats?.dailyChecklist.map((item) => {
              const progress = item.total > 0 ? Math.min(100, Math.round((item.done / item.total) * 100)) : 0
              return (
                <Link key={item.key} href={item.href} className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{tDashboard(item.title)}</p>
                      <p className="mt-1 text-sm text-slate-500">{tDashboard(item.description)}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {tDashboard("completedLabel", { done: item.done, total: item.total })}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">{tDashboard("systemHealth")}</h2>
          </div>
          <div className="space-y-3">
            {stats?.healthChecks.map((item) => (
              <Link key={item.key} href={item.href} className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{tDashboard(item.title)}</p>
                    <p className="mt-1 text-sm text-slate-500">{tDashboard(item.description)}</p>
                  </div>
                  <div className="text-right">
                    <span className={healthToneClass(item.status)}>
                      {item.status === "good" ? tDashboard("healthGood") : tDashboard("healthNeedsAttention")}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{item.count}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold">{tDashboard("monthlySnapshot")}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {stats?.monthlySnapshot.map((metric) => (
              <Link key={metric.key} href={metric.href} className="rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                <p className="text-sm text-slate-500">{tDashboard(metric.label)}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {metric.key === "collectedThisMonth"
                    ? tDashboard("metricCurrency", { value: metric.value })
                    : tDashboard("metricCount", { value: metric.value })}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold">{tDashboard("quickActions")}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <p className="font-medium text-slate-900">{action.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ContextBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function attentionToneClass(tone: "danger" | "warning" | "info" | "success") {
  if (tone === "danger") return "rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700"
  if (tone === "warning") return "rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700"
  if (tone === "info") return "rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700"
  return "rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"
}

function healthToneClass(status: "good" | "warning" | "danger") {
  if (status === "good") return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
  if (status === "danger") return "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
  return "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
}

function OperationMetric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = {
    default: "bg-slate-50 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  }[tone]

  return (
    <div className={`min-w-20 rounded-lg px-3 py-2 ${toneClass}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] font-medium">{label}</p>
    </div>
  )
}

function SessionPanel({
  title,
  emptyText,
  sessions,
  locale,
  t,
  showActions = false,
  savingSession,
  onMark,
}: {
  title: string
  emptyText: string
  sessions: DashboardTodaySession[]
  locale: string
  t: ReturnType<typeof useTranslations<"dashboard">>
  showActions?: boolean
  savingSession?: string | null
  onMark?: (scheduleId: string, status: "PRESENT" | "ABSENT") => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Badge variant={sessions.length ? "info" : "default"}>{sessions.length}</Badge>
      </div>
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.scheduleId} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {getLocalizedSubjectName({ nameAr: session.subjectName, nameFr: session.subjectNameFr }, locale)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.teacherName} · {session.classroomName}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {session.streamName || session.levelName} · {session.startTime} - {session.endTime}
                  </p>
                </div>
                <Badge variant={getSessionBadgeVariant(session.status)}>
                  {getSessionStatusLabel(session.status, t)}
                </Badge>
              </div>

              {session.confirmedBy ? (
                <p className="mt-2 text-xs text-slate-400">{t("confirmedBy", { name: session.confirmedBy })}</p>
              ) : null}

              {showActions && onMark ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={savingSession === `${session.scheduleId}:PRESENT`}
                    onClick={() => onMark(session.scheduleId, "PRESENT")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("markPresent")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={savingSession === `${session.scheduleId}:ABSENT`}
                    onClick={() => onMark(session.scheduleId, "ABSENT")}
                  >
                    <TriangleAlert className="h-4 w-4" />
                    {t("markAbsent")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function getSessionStatusLabel(status: string | null, t: ReturnType<typeof useTranslations<"dashboard">>) {
  if (status === "PRESENT") return t("statusPresent")
  if (status === "ABSENT") return t("statusAbsent")
  if (status === "LATE") return t("statusLate")
  if (status === "EXCUSED") return t("statusExcused")
  return t("statusPending")
}

function getSessionBadgeVariant(status: string | null): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PRESENT") return "success"
  if (status === "ABSENT") return "danger"
  if (status === "LATE") return "warning"
  if (status === "EXCUSED") return "info"
  return "default"
}

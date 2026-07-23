"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Badge, Button, Card, LoadingPage, Pagination } from "@/components/ui"
import { api } from "@/lib/api"
import {
  Archive,
  BellRing,
  BookOpen,
  CheckCircle2,
  Eye,
  GraduationCap,
  Inbox,
  Send,
  Users,
} from "lucide-react"

type InternalNotification = {
  id: string
  title: string
  message: string
  type: string
  status: string
  read: boolean
  actionUrl: string | null
  createdAt: string
  metadata: Record<string, unknown> | null
}

type InternalNotificationsResponse = {
  notifications: InternalNotification[]
  unreadCount: number
  pendingCount: number
}

type NotificationFilter = "PENDING" | "ALL" | "HANDLED"

function getStatusVariant(status: string) {
  if (status === "PENDING") return "warning" as const
  if (status === "ACTIONED" || status === "RESOLVED") return "success" as const
  if (status === "DISMISSED" || status === "REJECTED" || status === "FAILED") return "danger" as const
  if (status === "APPROVED" || status === "SENT") return "success" as const
  return "default" as const
}

function getMetadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getMetadataNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MR" : "fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export default function SchoolNotificationsPage() {
  const t = useTranslations("notificationsPage")
  const locale = useLocale()
  const [loading, setLoading] = useState(true)
  const [savingNotification, setSavingNotification] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>("PENDING")
  const [page, setPage] = useState(1)
  const limit = 10
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPendingInternal"),
    RESOLVED: t("statusResolved"),
    DISMISSED: t("statusDismissed"),
    ACTIONED: t("statusActioned"),
  }

  const typeLabels: Record<string, string> = {
    ATTENDANCE_RECORDED: t("internalTypeAttendance"),
    RESULTS_RECORDED: t("internalTypeResults"),
    RESULTS_UPDATED: t("internalTypeResultsUpdated"),
    LESSON_RECORDED: t("internalTypeLesson"),
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const notificationsRes = await api.get<InternalNotificationsResponse>("/api/school/notifications")

    if (notificationsRes.error) toast.error(notificationsRes.error)

    setNotifications(notificationsRes.data?.notifications || [])
    setUnreadCount(notificationsRes.data?.unreadCount || 0)
    setPendingCount(notificationsRes.data?.pendingCount || 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])
  useEffect(() => { setPage(1) }, [filter])

  async function updateNotification(id: string, status: "PENDING" | "RESOLVED" | "DISMISSED") {
    setSavingNotification(id)
    const { error } = await api.patch(`/api/school/notifications/${id}`, { status })
    if (error) toast.error(error)
    else {
      toast.success(status === "PENDING" ? t("notificationReopened") : t("notificationUpdated"))
      await loadData()
    }
    setSavingNotification(null)
  }

  async function sendToParents(notification: InternalNotification) {
    setSavingNotification(notification.id)
    const { data, error } = await api.post<{ campaignId: string; recipientsCount: number }>(
      `/api/school/notifications/${notification.id}/send`,
      {}
    )
    if (error) toast.error(error)
    else {
      toast.success(t("parentDraftCreated", { count: data?.recipientsCount || 0 }))
      await loadData()
    }
    setSavingNotification(null)
  }

  const visibleNotifications = notifications.filter((notification) => {
    if (filter === "PENDING") return notification.status === "PENDING"
    if (filter === "HANDLED") return notification.status !== "PENDING"
    return true
  })
  const paginatedNotifications = visibleNotifications.slice((page - 1) * limit, page * limit)
  const handledCount = notifications.filter((notification) => notification.status !== "PENDING").length
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(visibleNotifications.length / limit))
    if (page > maxPage) setPage(maxPage)
  }, [visibleNotifications.length, limit, page])

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">{t("operationsInboxEyebrow")}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{t("operationsInboxTitle")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t("operationsInboxSubtitle")}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("externalSendingNotEnabled")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard icon={Inbox} label={t("pendingInternal")} value={pendingCount} tone="amber" />
        <SummaryCard icon={BellRing} label={t("unreadInternal")} value={unreadCount} tone="blue" />
        <SummaryCard icon={CheckCircle2} label={t("handledInternal")} value={handledCount} tone="green" />
      </div>

      <Card padding="lg">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{t("managerAlerts")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("managerAlertsSubtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["PENDING", "ALL", "HANDLED"] as NotificationFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  filter === item ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item === "PENDING" ? t("filterPending") : item === "HANDLED" ? t("filterHandled") : t("filterAll")}
              </button>
            ))}
          </div>
        </div>

        {visibleNotifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <Inbox className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">{t("noInternalAlerts")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("noInternalAlertsHint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                locale={locale}
                saving={savingNotification === notification.id}
                statusLabel={statusLabels[notification.status] || notification.status}
                typeLabel={typeLabels[notification.type] || notification.type}
                onResolve={() => void updateNotification(notification.id, "RESOLVED")}
                onDismiss={() => void updateNotification(notification.id, "DISMISSED")}
                onReopen={() => void updateNotification(notification.id, "PENDING")}
                onSend={() => void sendToParents(notification)}
                t={t}
              />
            ))}
            <Pagination page={page} total={visibleNotifications.length} limit={limit} onChange={setPage} />
          </div>
        )}
      </Card>

    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox
  label: string
  value: number
  tone: "amber" | "blue" | "green"
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  }[tone]

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

function NotificationCard({
  notification,
  locale,
  saving,
  statusLabel,
  typeLabel,
  onResolve,
  onDismiss,
  onReopen,
  onSend,
  t,
}: {
  notification: InternalNotification
  locale: string
  saving: boolean
  statusLabel: string
  typeLabel: string
  onResolve: () => void
  onDismiss: () => void
  onReopen: () => void
  onSend: () => void
  t: ReturnType<typeof useTranslations<"notificationsPage">>
}) {
  const classroomName = getMetadataText(notification.metadata, "classroomName")
  const subjectName = getMetadataText(notification.metadata, "subjectName")
  const teacherName = getMetadataText(notification.metadata, "teacherName")
  const notificationDate = getMetadataText(notification.metadata, "date")
  const startTime = getMetadataText(notification.metadata, "startTime")
  const endTime = getMetadataText(notification.metadata, "endTime")
  const lessonTitle = getMetadataText(notification.metadata, "lessonTitle")
  const lessonDuration = getMetadataNumber(notification.metadata, "duration")
  const absentCount = getMetadataNumber(notification.metadata, "absentCount")
  const [expanded, setExpanded] = useState(false)
  const Icon = notification.type === "ATTENDANCE_RECORDED"
    ? Users
    : notification.type === "LESSON_RECORDED"
      ? BookOpen
      : notification.type.startsWith("RESULTS")
        ? GraduationCap
        : BellRing
  const canSendToParents = notification.type === "ATTENDANCE_RECORDED" && notification.status === "PENDING"

  return (
    <div className={`rounded-2xl border p-4 ${notification.status === "PENDING" ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-2xl bg-white p-2 text-blue-700 shadow-sm">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="font-semibold text-slate-950">{notification.title}</h3>
            <Badge variant={getStatusVariant(notification.status)}>{statusLabel}</Badge>
            <Badge variant="default">{typeLabel}</Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{notification.message}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {classroomName && <span className="rounded-full bg-white px-2 py-1">{classroomName}</span>}
            {subjectName && <span className="rounded-full bg-white px-2 py-1">{subjectName}</span>}
            {teacherName && <span className="rounded-full bg-white px-2 py-1">{teacherName}</span>}
            <span className="rounded-full bg-white px-2 py-1">{formatDate(notification.createdAt, locale)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="secondary" size="sm" onClick={() => setExpanded((current) => !current)}>
            <Eye className="h-4 w-4" /> {expanded ? t("hidePreview") : t("review")}
          </Button>
          {canSendToParents && (
            <Button size="sm" loading={saving} onClick={onSend}>
              <Send className="h-4 w-4" /> {t("sendToParents")}
            </Button>
          )}
          {notification.status === "PENDING" ? (
            <>
              <Button variant="outline" size="sm" loading={saving} onClick={onResolve}>
                <CheckCircle2 className="h-4 w-4" /> {t("markResolved")}
              </Button>
              <Button variant="ghost" size="sm" loading={saving} onClick={onDismiss}>
                <Archive className="h-4 w-4" /> {t("dismiss")}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" loading={saving} onClick={onReopen}>
              <BellRing className="h-4 w-4" /> {t("reopen")}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
          <h4 className="mb-3 font-semibold text-slate-900">{t("previewDetails")}</h4>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <DetailItem label={t("classroom")} value={classroomName || t("unspecified")} />
            <DetailItem label={t("subject")} value={subjectName || t("unspecified")} />
            <DetailItem label={t("teacher")} value={teacherName || t("unspecified")} />
            <DetailItem
              label={t("notificationDate")}
              value={notificationDate ? formatDate(notificationDate, locale) : formatDate(notification.createdAt, locale)}
            />
            <DetailItem
              label={t("sessionTime")}
              value={startTime && endTime ? `${startTime} - ${endTime}` : t("unspecified")}
            />
            {notification.type === "LESSON_RECORDED" ? (
              <>
                <DetailItem label={t("lessonTitle")} value={lessonTitle || notification.title} />
                <DetailItem
                  label={t("lessonDuration")}
                  value={lessonDuration == null ? t("unspecified") : t("lessonDurationValue", { count: lessonDuration })}
                />
              </>
            ) : (
              <DetailItem
                label={t("absentStudents")}
                value={absentCount == null ? t("unspecified") : t("absentCountValue", { count: absentCount })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  )
}

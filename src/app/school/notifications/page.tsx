"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { api } from "@/lib/api"
import {
  Archive,
  BellRing,
  BookOpen,
  CheckCircle2,
  Eye,
  GraduationCap,
  Inbox,
  Megaphone,
  Send,
  Users,
  XCircle,
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

type Campaign = {
  id: string
  title: string
  message: string
  type: string
  channel: string
  status: string
  audienceType: string
  recipientsCount: number
  createdAt: string
  createdByUser?: { id: string; name: string }
  approvedByUser?: { id: string; name: string } | null
  statusSummary?: Record<string, number>
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
  const [savingCampaign, setSavingCampaign] = useState<string | null>(null)
  const [filter, setFilter] = useState<NotificationFilter>("PENDING")
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPendingInternal"),
    RESOLVED: t("statusResolved"),
    DISMISSED: t("statusDismissed"),
    ACTIONED: t("statusActioned"),
    DRAFT: t("statusDraft"),
    PENDING_APPROVAL: t("statusPendingApproval"),
    APPROVED: t("statusApproved"),
    SCHEDULED: t("statusScheduled"),
    REJECTED: t("statusRejected"),
    SENT: t("statusSent"),
    FAILED: t("statusFailed"),
  }

  const typeLabels: Record<string, string> = {
    ATTENDANCE_RECORDED: t("internalTypeAttendance"),
    RESULTS_RECORDED: t("internalTypeResults"),
    RESULTS_UPDATED: t("internalTypeResultsUpdated"),
    LESSON_RECORDED: t("internalTypeLesson"),
    ATTENDANCE: t("typeAttendance"),
    RESULTS: t("typeResults"),
    FEES: t("typeFees"),
    GENERAL: t("typeGeneral"),
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [notificationsRes, campaignsRes] = await Promise.all([
      api.get<InternalNotificationsResponse>("/api/school/notifications"),
      api.get<Campaign[]>("/api/school/notifications/campaigns"),
    ])

    if (notificationsRes.error) toast.error(notificationsRes.error)
    if (campaignsRes.error) toast.error(campaignsRes.error)

    setNotifications(notificationsRes.data?.notifications || [])
    setUnreadCount(notificationsRes.data?.unreadCount || 0)
    setPendingCount(notificationsRes.data?.pendingCount || 0)
    setCampaigns(campaignsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

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

  async function updateCampaignStatus(id: string, action: "submit" | "approve" | "reject") {
    setSavingCampaign(`${id}:${action}`)
    const endpoint = `/api/school/notifications/campaigns/${id}/${action}`
    const payload = action === "reject" ? { reason: t("defaultRejectReason") } : undefined
    const { error } = await api.post(endpoint, payload)
    if (error) toast.error(error)
    else {
      toast.success(
        action === "submit" ? t("campaignSubmitted")
          : action === "approve" ? t("campaignApproved")
            : t("campaignRejected")
      )
      await loadData()
    }
    setSavingCampaign(null)
  }

  const visibleNotifications = notifications.filter((notification) => {
    if (filter === "PENDING") return notification.status === "PENDING"
    if (filter === "HANDLED") return notification.status !== "PENDING"
    return true
  })
  const handledCount = notifications.filter((notification) => notification.status !== "PENDING").length
  const draftCampaigns = campaigns.filter((campaign) => ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(campaign.status))

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard icon={Inbox} label={t("pendingInternal")} value={pendingCount} tone="amber" />
        <SummaryCard icon={BellRing} label={t("unreadInternal")} value={unreadCount} tone="blue" />
        <SummaryCard icon={CheckCircle2} label={t("handledInternal")} value={handledCount} tone="green" />
        <SummaryCard icon={Megaphone} label={t("parentDrafts")} value={draftCampaigns.length} tone="rose" />
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
            {visibleNotifications.map((notification) => (
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
          </div>
        )}
      </Card>

      <Card padding="lg">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{t("parentCampaignsSection")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("parentCampaignsSubtitle")}</p>
          </div>
          <Badge variant="default">{t("recordsCount", { count: campaigns.length })}</Badge>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            {t("noParentCampaigns")}
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.slice(0, 12).map((campaign) => (
              <div key={campaign.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{campaign.title}</h3>
                      <Badge variant={getStatusVariant(campaign.status)}>{statusLabels[campaign.status] || campaign.status}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{campaign.message}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{typeLabels[campaign.type] || campaign.type}</span>
                      <span>{t("recipientsLabel", { count: campaign.recipientsCount })}</span>
                      <span>{formatDate(campaign.createdAt, locale)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/school/notifications/${campaign.id}`}>
                      <Button variant="secondary" size="sm">
                        <Eye className="h-4 w-4" /> {t("details")}
                      </Button>
                    </Link>
                    {(campaign.status === "DRAFT" || campaign.status === "REJECTED") && (
                      <Button
                        size="sm"
                        loading={savingCampaign === `${campaign.id}:submit`}
                        onClick={() => void updateCampaignStatus(campaign.id, "submit")}
                      >
                        <Send className="h-4 w-4" /> {t("submitForApproval")}
                      </Button>
                    )}
                    {campaign.status === "PENDING_APPROVAL" && (
                      <>
                        <Button
                          size="sm"
                          loading={savingCampaign === `${campaign.id}:approve`}
                          onClick={() => void updateCampaignStatus(campaign.id, "approve")}
                        >
                          <CheckCircle2 className="h-4 w-4" /> {t("approve")}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={savingCampaign === `${campaign.id}:reject`}
                          onClick={() => void updateCampaignStatus(campaign.id, "reject")}
                        >
                          <XCircle className="h-4 w-4" /> {t("reject")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
  tone: "amber" | "blue" | "green" | "rose"
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
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
          {notification.actionUrl && (
            <Link href={notification.actionUrl}>
              <Button variant="secondary" size="sm">
                <Eye className="h-4 w-4" /> {t("review")}
              </Button>
            </Link>
          )}
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
    </div>
  )
}

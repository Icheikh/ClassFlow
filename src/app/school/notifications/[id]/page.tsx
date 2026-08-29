"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { api } from "@/lib/api"
import { getMonthLabel } from "@/lib/finance"
import { ArrowRight, CheckCircle2, Clock3, Send, Users, XCircle } from "lucide-react"

type Recipient = {
  id: string
  phone: string | null
  channel: string
  status: string
  errorMessage: string | null
  user: { id: string; name: string; phone: string | null } | null
  student: { id: string; firstName: string; lastName: string; studentNumber: string | null } | null
  parent: { id: string; phone: string | null } | null
}

type CampaignDetail = {
  id: string
  title: string
  message: string
  type: string
  channel: string
  status: string
  audienceType: string
  audienceFilters: string | null
  exclusionFilters: string | null
  recipientsCount: number
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectedReason: string | null
  createdByUser: { id: string; name: string } | null
  approvedByUser: { id: string; name: string } | null
  template: { id: string; name: string } | null
  recipients: Recipient[]
}

function parseJson(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatPhone(phone?: string | null, unavailableLabel = "—") {
  if (!phone) return unavailableLabel
  if (phone.startsWith("+")) return phone
  return `+${phone}`
}

export default function NotificationCampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const locale = useLocale()
  const t = useTranslations("notificationsPage")
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [sending, setSending] = useState(false)
  const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
    DRAFT: { label: t("statusDraft"), variant: "default" },
    PENDING_APPROVAL: { label: t("statusPendingApproval"), variant: "warning" },
    APPROVED: { label: t("statusApproved"), variant: "success" },
    SCHEDULED: { label: t("statusScheduled"), variant: "warning" },
    REJECTED: { label: t("statusRejected"), variant: "danger" },
    SENDING: { label: "جاري الإرسال", variant: "warning" },
    SENT: { label: t("statusSent"), variant: "success" },
    PARTIAL: { label: "إرسال جزئي", variant: "warning" },
    FAILED: { label: t("statusFailed"), variant: "danger" },
  }
  const audienceTypeLabels: Record<string, string> = {
    ALL_PARENTS: t("audienceAllParents"),
    CLASSROOM: t("audienceClassroom"),
    LEVEL: t("audienceLevel"),
    STREAM: t("audienceStream"),
    STUDENTS: t("audienceStudents"),
    UNPAID_FEES: t("audienceUnpaidFees"),
  }
  const channelLabels: Record<string, string> = {
    WHATSAPP: t("whatsapp"),
    IN_APP: t("inApp"),
  }
  const campaignTypeLabels: Record<string, string> = {
    FEES: t("typeFees"),
    RESULTS: t("typeResults"),
    ATTENDANCE: t("typeAttendance"),
    EVENTS: t("typeEvent"),
    CUSTOM: t("typeCustom"),
  }
  const recipientStatusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
    PENDING: { label: t("recipientStatusPending"), variant: "default" },
    SENT: { label: t("recipientStatusSent"), variant: "success" },
    FAILED: { label: t("recipientStatusFailed"), variant: "danger" },
    SKIPPED: { label: t("recipientStatusSkipped"), variant: "warning" },
  }

  const loadCampaign = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data, error } = await api.get<CampaignDetail>(`/api/school/notifications/campaigns/${id}`)
    if (error) toast.error(error)
    else setCampaign(data || null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void loadCampaign()
  }, [loadCampaign])

  async function updateCampaignStatus(action: "submit" | "approve" | "reject") {
    if (!campaign) return
    const payload = action === "reject" ? { reason: t("defaultRejectReason") } : undefined
    const { error } = await api.post(`/api/school/notifications/campaigns/${campaign.id}/${action}`, payload)
    if (error) toast.error(error)
    else {
      toast.success(
        action === "submit" ? t("campaignSubmitted")
          : action === "approve" ? t("campaignApproved")
            : t("campaignRejected")
      )
      await loadCampaign()
    }
  }

  async function sendCampaign() {
    if (!campaign) return
    setSending(true)
    const { data, error } = await api.post<{ sent: number; failed: number; skipped: number }>(
      `/api/school/notifications/campaigns/${campaign.id}/send`,
      {}
    )
    if (error) {
      toast.error(error)
    } else if (data) {
      const parts = []
      if (data.sent > 0) parts.push(`${data.sent} مرسل`)
      if (data.failed > 0) parts.push(`${data.failed} فاشل`)
      if (data.skipped > 0) parts.push(`${data.skipped} م skipped`)
      toast.success(`تم الإرسال: ${parts.join(" | ")}`)
      await loadCampaign()
    }
    setSending(false)
  }

  function getDeliveryMeta(status: string) {
    if (status === "APPROVED") return { label: t("deliveryApproved"), variant: "warning" as const }
    if (status === "SCHEDULED") return { label: t("deliveryScheduled"), variant: "warning" as const }
    if (status === "SENDING") return { label: "جاري الإرسال", variant: "warning" as const }
    if (status === "SENT") return { label: t("deliverySent"), variant: "success" as const }
    if (status === "PARTIAL") return { label: "إرسال جزئي", variant: "warning" as const }
    if (status === "FAILED") return { label: t("deliveryFailed"), variant: "danger" as const }
    if (status === "PENDING_APPROVAL") return { label: t("deliveryPendingApproval"), variant: "default" as const }
    return { label: t("deliveryNotStarted"), variant: "default" as const }
  }

  if (loading) return <LoadingPage />
  if (!campaign) {
    return (
      <Card padding="lg">
        <p className="text-center text-gray-500">{t("campaignNotFound")}</p>
      </Card>
    )
  }

  const status = statusLabels[campaign.status] || { label: campaign.status, variant: "default" as const }
  const parsedAudience = parseJson(campaign.audienceFilters)
  const parsedExclusions = parseJson(campaign.exclusionFilters)
  const deliveryStatus = getDeliveryMeta(campaign.status)
  const pendingRecipients = campaign.recipients.filter((recipient) => recipient.status === "PENDING").length
  const sentRecipients = campaign.recipients.filter((recipient) => recipient.status === "SENT").length
  const failedRecipients = campaign.recipients.filter((recipient) => recipient.status === "FAILED").length
  const missingPhoneRecipients = campaign.recipients.filter(
    (recipient) => !recipient.phone && !recipient.parent?.phone && !recipient.user?.phone
  ).length
  const audienceDetails = [
    parsedAudience?.classroomId ? { label: t("classroom"), value: t("specificClassroom") } : null,
    parsedAudience?.levelId ? { label: t("level"), value: t("specificLevel") } : null,
    parsedAudience?.streamId ? { label: t("stream"), value: t("specificStream") } : null,
    parsedAudience?.month ? { label: t("month"), value: getMonthLabel(parsedAudience.month, locale) } : null,
    Array.isArray(parsedAudience?.studentIds) && parsedAudience.studentIds.length > 0
      ? { label: t("specificStudents"), value: String(parsedAudience.studentIds.length) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]
  const exclusionDetails = [
    Array.isArray(parsedExclusions?.studentIds) && parsedExclusions.studentIds.length > 0
      ? { label: t("excludedStudents"), value: String(parsedExclusions.studentIds.length) }
      : null,
    Array.isArray(parsedExclusions?.parentUserIds) && parsedExclusions.parentUserIds.length > 0
      ? { label: t("excludedParents"), value: String(parsedExclusions.parentUserIds.length) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/school/notifications" className="mb-3 inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
            <ArrowRight className="h-4 w-4" /> {t("backToNotifications")}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{campaign.title}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-2 text-sm text-gray-500">{campaign.message}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(campaign.status === "DRAFT" || campaign.status === "REJECTED") && (
            <Button onClick={() => void updateCampaignStatus("submit")}>
              <Send className="h-4 w-4" /> {t("submitForApproval")}
            </Button>
          )}
          {campaign.status === "PENDING_APPROVAL" && (
            <>
              <Button onClick={() => void updateCampaignStatus("approve")}>
                <CheckCircle2 className="h-4 w-4" /> {t("approve")}
              </Button>
              <Button variant="danger" onClick={() => void updateCampaignStatus("reject")}>
                <XCircle className="h-4 w-4" /> {t("reject")}
              </Button>
            </>
          )}
          {campaign.status === "APPROVED" && (
            <Button onClick={() => void sendCampaign()} loading={sending}>
              <Send className="h-4 w-4" /> إرسال الآن
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">{t("approvalStatus")}</span>
          </div>
          <div className="mt-3">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <Send className="h-4 w-4" />
            <span className="text-sm">{t("deliveryStatus")}</span>
          </div>
          <div className="mt-3">
            <Badge variant={deliveryStatus.variant}>{deliveryStatus.label}</Badge>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <Users className="h-4 w-4" />
            <span className="text-sm">{t("recipients")}</span>
          </div>
          <p className="mt-3 text-2xl font-bold">{campaign.recipientsCount}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock3 className="h-4 w-4" />
            <span className="text-sm">{t("remainingToSend")}</span>
          </div>
          <p className="mt-3 text-2xl font-bold">{pendingRecipients}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <p className="text-sm text-gray-500">{t("sentSuccessfully")}</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{sentRecipients}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">{t("sendFailed")}</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{failedRecipients}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">{t("withoutAvailablePhone")}</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{missingPhoneRecipients}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">{t("campaignInfo")}</h2>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("type")}</p>
              <p className="mt-1 font-medium">{campaignTypeLabels[campaign.type] || campaign.type}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("channel")}</p>
              <p className="mt-1 font-medium">{channelLabels[campaign.channel] || campaign.channel}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("audience")}</p>
              <p className="mt-1 font-medium">{audienceTypeLabels[campaign.audienceType] || campaign.audienceType}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("recipientCount")}</p>
              <p className="mt-1 font-medium">{campaign.recipientsCount}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("creator")}</p>
              <p className="mt-1 font-medium">{campaign.createdByUser?.name || t("unknownUser")}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("approver")}</p>
              <p className="mt-1 font-medium">{campaign.approvedByUser?.name || t("notApprovedYet")}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("sentCount")}</p>
              <p className="mt-1 font-medium">{sentRecipients}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">{t("failedCount")}</p>
              <p className="mt-1 font-medium">{failedRecipients}</p>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-4 text-lg font-semibold">{t("campaignScope")}</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-gray-500">{t("audienceFilter")}</p>
              <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
                {audienceDetails.length === 0 ? (
                  <p className="text-gray-700">{t("noExtraAudienceFilter")}</p>
                ) : (
                  audienceDetails.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-800">{item.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-gray-500">{t("exclusions")}</p>
              <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
                {exclusionDetails.length === 0 ? (
                  <p className="text-gray-700">{t("noExclusions")}</p>
                ) : (
                  exclusionDetails.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-800">{item.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            {campaign.rejectedReason && (
              <div>
                <p className="text-gray-500">{t("rejectionReason")}</p>
                <div className="mt-2 rounded-xl bg-red-50 p-3 text-red-700">{campaign.rejectedReason}</div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("recipients")}</h2>
          <span className="text-sm text-gray-500">{t("recordsCount", { count: campaign.recipients.length })}</span>
        </div>

        {campaign.recipients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
            {t("noRecipientsForCampaign")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-3 font-medium text-gray-500">{t("parent")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("student")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("phoneNumber")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("channel")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("status")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("note")}</th>
                </tr>
              </thead>
              <tbody>
                {campaign.recipients.map((recipient) => {
                  const recipientStatus = recipientStatusLabels[recipient.status] || { label: recipient.status, variant: "default" as const }
                  return (
                    <tr key={recipient.id} className="border-b last:border-0">
                      <td className="py-3 text-gray-700">{recipient.user?.name || t("unknownUser")}</td>
                      <td className="py-3 text-gray-700">
                        {recipient.student ? `${recipient.student.firstName} ${recipient.student.lastName}` : t("unspecified")}
                      </td>
                      <td className="py-3 text-gray-700 dir-ltr text-left">{formatPhone(recipient.phone || recipient.parent?.phone || recipient.user?.phone, t("unavailable"))}</td>
                      <td className="py-3 text-gray-700">{channelLabels[recipient.channel] || recipient.channel}</td>
                      <td className="py-3"><Badge variant={recipientStatus.variant}>{recipientStatus.label}</Badge></td>
                      <td className="py-3 text-gray-500">{recipient.errorMessage || t("emptyNote")}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
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

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  DRAFT: { label: "مسودة", variant: "default" },
  PENDING_APPROVAL: { label: "بانتظار الاعتماد", variant: "warning" },
  APPROVED: { label: "معتمد", variant: "success" },
  SCHEDULED: { label: "مجدول", variant: "warning" },
  REJECTED: { label: "مرفوض", variant: "danger" },
  SENT: { label: "مرسل", variant: "success" },
  FAILED: { label: "فشل", variant: "danger" },
}

const audienceTypeLabels: Record<string, string> = {
  ALL_PARENTS: "كل الأولياء",
  CLASSROOM: "أولياء قسم",
  LEVEL: "أولياء مستوى",
  STREAM: "أولياء شعبة",
  STUDENTS: "أولياء طلاب محددين",
  UNPAID_FEES: "أولياء المتأخرين في الرسوم",
}

const channelLabels: Record<string, string> = {
  WHATSAPP: "واتساب",
  IN_APP: "داخل النظام",
}

const campaignTypeLabels: Record<string, string> = {
  FEES: "رسوم",
  RESULTS: "نتائج",
  ATTENDANCE: "غياب",
  EVENTS: "فعاليات",
  CUSTOM: "إشعار مخصص",
}

const recipientStatusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  PENDING: { label: "بانتظار الإرسال", variant: "default" },
  SENT: { label: "تم الإرسال", variant: "success" },
  FAILED: { label: "فشل الإرسال", variant: "danger" },
  SKIPPED: { label: "تم الاستبعاد", variant: "warning" },
}

function parseJson(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatPhone(phone?: string | null) {
  if (!phone) return "غير متوفر"
  if (phone.startsWith("+")) return phone
  return `+${phone}`
}

function getDeliveryMeta(status: string) {
  if (status === "APPROVED") return { label: "جاهزة للإرسال", variant: "warning" as const }
  if (status === "SCHEDULED") return { label: "مجدولة للإرسال", variant: "warning" as const }
  if (status === "SENT") return { label: "تم الإرسال", variant: "success" as const }
  if (status === "FAILED") return { label: "فشل الإرسال", variant: "danger" as const }
  if (status === "PENDING_APPROVAL") return { label: "بانتظار الاعتماد أولاً", variant: "default" as const }
  return { label: "لم تبدأ بعد", variant: "default" as const }
}

export default function NotificationCampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)

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
    const payload = action === "reject" ? { reason: "بحاجة إلى تعديل قبل الإرسال" } : undefined
    const { error } = await api.post(`/api/school/notifications/campaigns/${campaign.id}/${action}`, payload)
    if (error) toast.error(error)
    else {
      toast.success(
        action === "submit" ? "تم إرسال الحملة للاعتماد"
          : action === "approve" ? "تم اعتماد الحملة"
            : "تم رفض الحملة"
      )
      await loadCampaign()
    }
  }

  if (loading) return <LoadingPage />
  if (!campaign) {
    return (
      <Card padding="lg">
        <p className="text-center text-gray-500">الحملة غير موجودة</p>
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
    parsedAudience?.classroomId ? { label: "القسم", value: "قسم محدد" } : null,
    parsedAudience?.levelId ? { label: "المستوى", value: "مستوى محدد" } : null,
    parsedAudience?.streamId ? { label: "الشعبة", value: "شعبة محددة" } : null,
    parsedAudience?.month ? { label: "الشهر", value: getMonthLabel(parsedAudience.month) } : null,
    Array.isArray(parsedAudience?.studentIds) && parsedAudience.studentIds.length > 0
      ? { label: "طلاب محددون", value: String(parsedAudience.studentIds.length) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]
  const exclusionDetails = [
    Array.isArray(parsedExclusions?.studentIds) && parsedExclusions.studentIds.length > 0
      ? { label: "استبعاد طلاب", value: String(parsedExclusions.studentIds.length) }
      : null,
    Array.isArray(parsedExclusions?.parentUserIds) && parsedExclusions.parentUserIds.length > 0
      ? { label: "استبعاد أولياء", value: String(parsedExclusions.parentUserIds.length) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/school/notifications" className="mb-3 inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
            <ArrowRight className="h-4 w-4" /> العودة إلى مركز الإشعارات
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
              <Send className="h-4 w-4" /> إرسال للاعتماد
            </Button>
          )}
          {campaign.status === "PENDING_APPROVAL" && (
            <>
              <Button onClick={() => void updateCampaignStatus("approve")}>
                <CheckCircle2 className="h-4 w-4" /> اعتماد
              </Button>
              <Button variant="danger" onClick={() => void updateCampaignStatus("reject")}>
                <XCircle className="h-4 w-4" /> رفض
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">حالة الاعتماد</span>
          </div>
          <div className="mt-3">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <Send className="h-4 w-4" />
            <span className="text-sm">حالة الإرسال</span>
          </div>
          <div className="mt-3">
            <Badge variant={deliveryStatus.variant}>{deliveryStatus.label}</Badge>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <Users className="h-4 w-4" />
            <span className="text-sm">المستلمون</span>
          </div>
          <p className="mt-3 text-2xl font-bold">{campaign.recipientsCount}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock3 className="h-4 w-4" />
            <span className="text-sm">المتبقي للإرسال</span>
          </div>
          <p className="mt-3 text-2xl font-bold">{pendingRecipients}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <p className="text-sm text-gray-500">تم الإرسال بنجاح</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{sentRecipients}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">فشل الإرسال</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{failedRecipients}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">بدون رقم متاح</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{missingPhoneRecipients}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">معلومات الحملة</h2>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">النوع</p>
              <p className="mt-1 font-medium">{campaignTypeLabels[campaign.type] || campaign.type}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">القناة</p>
              <p className="mt-1 font-medium">{channelLabels[campaign.channel] || campaign.channel}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">الجمهور</p>
              <p className="mt-1 font-medium">{audienceTypeLabels[campaign.audienceType] || campaign.audienceType}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">عدد المستلمين</p>
              <p className="mt-1 font-medium">{campaign.recipientsCount}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">المنشئ</p>
              <p className="mt-1 font-medium">{campaign.createdByUser?.name || "غير معروف"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">المعتمد</p>
              <p className="mt-1 font-medium">{campaign.approvedByUser?.name || "لم يعتمد بعد"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">تم الإرسال</p>
              <p className="mt-1 font-medium">{sentRecipients}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">فشل الإرسال</p>
              <p className="mt-1 font-medium">{failedRecipients}</p>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-4 text-lg font-semibold">نطاق الحملة</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-gray-500">مرشح الجمهور</p>
              <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
                {audienceDetails.length === 0 ? (
                  <p className="text-gray-700">لا توجد تصفية إضافية. الحملة تشمل كل الجمهور المختار.</p>
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
              <p className="text-gray-500">الاستثناءات</p>
              <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
                {exclusionDetails.length === 0 ? (
                  <p className="text-gray-700">لا توجد استثناءات في هذه الحملة.</p>
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
                <p className="text-gray-500">سبب الرفض</p>
                <div className="mt-2 rounded-xl bg-red-50 p-3 text-red-700">{campaign.rejectedReason}</div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">المستلمون</h2>
          <span className="text-sm text-gray-500">{campaign.recipients.length} سجل</span>
        </div>

        {campaign.recipients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
            لا يوجد مستلمون لهذه الحملة
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-3 font-medium text-gray-500">الولي</th>
                  <th className="pb-3 font-medium text-gray-500">الطالب</th>
                  <th className="pb-3 font-medium text-gray-500">الرقم</th>
                  <th className="pb-3 font-medium text-gray-500">القناة</th>
                  <th className="pb-3 font-medium text-gray-500">الحالة</th>
                  <th className="pb-3 font-medium text-gray-500">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
	                {campaign.recipients.map((recipient) => {
	                  const recipientStatus = recipientStatusLabels[recipient.status] || { label: recipient.status, variant: "default" as const }
	                  return (
                    <tr key={recipient.id} className="border-b last:border-0">
                      <td className="py-3 text-gray-700">{recipient.user?.name || "غير معروف"}</td>
                      <td className="py-3 text-gray-700">
                        {recipient.student ? `${recipient.student.firstName} ${recipient.student.lastName}` : "غير محدد"}
                      </td>
                      <td className="py-3 text-gray-700 dir-ltr text-left">{formatPhone(recipient.phone || recipient.parent?.phone || recipient.user?.phone)}</td>
                      <td className="py-3 text-gray-700">{channelLabels[recipient.channel] || recipient.channel}</td>
                      <td className="py-3"><Badge variant={recipientStatus.variant}>{recipientStatus.label}</Badge></td>
                      <td className="py-3 text-gray-500">{recipient.errorMessage || "-"}</td>
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

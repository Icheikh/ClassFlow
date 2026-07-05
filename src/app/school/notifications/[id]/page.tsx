"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import toast from "react-hot-toast"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { api } from "@/lib/api"
import { ArrowRight, CheckCircle2, Send, XCircle } from "lucide-react"

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

function parseJson(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">معلومات الحملة</h2>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">النوع</p>
              <p className="mt-1 font-medium">{campaign.type}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">القناة</p>
              <p className="mt-1 font-medium">{campaign.channel}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-gray-500">الجمهور</p>
              <p className="mt-1 font-medium">{campaign.audienceType}</p>
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
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-4 text-lg font-semibold">بيانات التصفية</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-gray-500">مرشح الجمهور</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(parsedAudience, null, 2)}</pre>
            </div>
            <div>
              <p className="text-gray-500">الاستثناءات</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(parsedExclusions, null, 2)}</pre>
            </div>
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
                  const recipientStatus = statusLabels[recipient.status] || { label: recipient.status, variant: "default" as const }
                  return (
                    <tr key={recipient.id} className="border-b last:border-0">
                      <td className="py-3 text-gray-700">{recipient.user?.name || "غير معروف"}</td>
                      <td className="py-3 text-gray-700">
                        {recipient.student ? `${recipient.student.firstName} ${recipient.student.lastName}` : "غير محدد"}
                      </td>
                      <td className="py-3 text-gray-700">{recipient.phone || recipient.parent?.phone || recipient.user?.phone || "غير متوفر"}</td>
                      <td className="py-3 text-gray-700">{recipient.channel}</td>
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

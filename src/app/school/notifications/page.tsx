"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Badge, Button, Card, Input, LoadingPage, Select, Textarea } from "@/components/ui"
import { api } from "@/lib/api"
import { BellRing, CheckCircle2, Send, XCircle } from "lucide-react"

type Template = {
  id: string
  name: string
  type: string
  channel: string
  titleTemplate: string
  messageTemplate: string
  requiresApproval: boolean
}

type Campaign = {
  id: string
  title: string
  type: string
  channel: string
  status: string
  audienceType: string
  recipientsCount: number
  createdAt: string
  createdByUser?: { id: string; name: string }
  approvedByUser?: { id: string; name: string } | null
  template?: { id: string; name: string } | null
  statusSummary?: Record<string, number>
}

type OptionItem = { id: string; name: string }

const typeOptions = [
  { value: "GENERAL", label: "إشعار عام" },
  { value: "ATTENDANCE", label: "غياب وحضور" },
  { value: "FEES", label: "رسوم" },
  { value: "RESULTS", label: "نتائج" },
  { value: "EVENT", label: "فعالية" },
]

const audienceOptions = [
  { value: "ALL_PARENTS", label: "كل الأولياء" },
  { value: "CLASSROOM", label: "أولياء قسم" },
  { value: "LEVEL", label: "أولياء مستوى" },
  { value: "STREAM", label: "أولياء شعبة" },
  { value: "UNPAID_FEES", label: "أولياء المتأخرين في الرسوم" },
]

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  DRAFT: { label: "مسودة", variant: "default" },
  PENDING_APPROVAL: { label: "بانتظار الاعتماد", variant: "warning" },
  APPROVED: { label: "معتمد", variant: "success" },
  SCHEDULED: { label: "مجدول", variant: "warning" },
  REJECTED: { label: "مرفوض", variant: "danger" },
  SENT: { label: "مرسل", variant: "success" },
  FAILED: { label: "فشل", variant: "danger" },
}

export default function SchoolNotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [classrooms, setClassrooms] = useState<OptionItem[]>([])
  const [levels, setLevels] = useState<OptionItem[]>([])
  const [streams, setStreams] = useState<OptionItem[]>([])

  const [templateForm, setTemplateForm] = useState({
    name: "",
    type: "GENERAL",
    channel: "WHATSAPP",
    titleTemplate: "",
    messageTemplate: "",
  })

  const [campaignForm, setCampaignForm] = useState({
    templateId: "",
    type: "GENERAL",
    channel: "WHATSAPP",
    title: "",
    message: "",
    audienceType: "ALL_PARENTS",
    classroomId: "",
    levelId: "",
    streamId: "",
    month: "",
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [templatesRes, campaignsRes, classroomsRes, levelsRes, streamsRes] = await Promise.all([
      api.get<Template[]>("/api/school/notifications/templates"),
      api.get<Campaign[]>("/api/school/notifications/campaigns"),
      api.get<OptionItem[]>("/api/school/classrooms"),
      api.get<OptionItem[]>("/api/school/levels"),
      api.get<OptionItem[]>("/api/school/streams"),
    ])

    if (templatesRes.error) toast.error(templatesRes.error)
    if (campaignsRes.error) toast.error(campaignsRes.error)
    if (classroomsRes.error) toast.error(classroomsRes.error)
    if (levelsRes.error) toast.error(levelsRes.error)
    if (streamsRes.error) toast.error(streamsRes.error)

    setTemplates(templatesRes.data || [])
    setCampaigns(campaignsRes.data || [])
    setClassrooms(classroomsRes.data || [])
    setLevels(levelsRes.data || [])
    setStreams(streamsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function createTemplate() {
    if (!templateForm.name || !templateForm.titleTemplate || !templateForm.messageTemplate) {
      toast.error("أكمل بيانات القالب")
      return
    }

    setSavingTemplate(true)
    const { data, error } = await api.post<Template>("/api/school/notifications/templates", {
      ...templateForm,
      requiresApproval: true,
    })

    if (error) toast.error(error)
    else if (data) {
      toast.success("تم حفظ القالب")
      setTemplateForm({
        name: "",
        type: "GENERAL",
        channel: "WHATSAPP",
        titleTemplate: "",
        messageTemplate: "",
      })
      await loadData()
    }
    setSavingTemplate(false)
  }

  async function createCampaign() {
    if (!campaignForm.title || !campaignForm.message) {
      toast.error("أدخل عنوان الإشعار ونصه")
      return
    }

    const filters: Record<string, string> = {}
    if (campaignForm.classroomId) filters.classroomId = campaignForm.classroomId
    if (campaignForm.levelId) filters.levelId = campaignForm.levelId
    if (campaignForm.streamId) filters.streamId = campaignForm.streamId
    if (campaignForm.month) filters.month = campaignForm.month

    setSavingCampaign(true)
    const { error } = await api.post("/api/school/notifications/campaigns", {
      templateId: campaignForm.templateId || null,
      type: campaignForm.type,
      channel: campaignForm.channel,
      title: campaignForm.title,
      message: campaignForm.message,
      audience: {
        audienceType: campaignForm.audienceType,
        filters,
        exclusions: {},
      },
    })

    if (error) toast.error(error)
    else {
      toast.success("تم إنشاء الحملة كمسودة")
      setCampaignForm({
        templateId: "",
        type: "GENERAL",
        channel: "WHATSAPP",
        title: "",
        message: "",
        audienceType: "ALL_PARENTS",
        classroomId: "",
        levelId: "",
        streamId: "",
        month: "",
      })
      await loadData()
    }
    setSavingCampaign(false)
  }

  async function updateCampaignStatus(id: string, action: "submit" | "approve" | "reject") {
    const endpoint = `/api/school/notifications/campaigns/${id}/${action}`
    const payload = action === "reject" ? { reason: "بحاجة إلى تعديل قبل الإرسال" } : undefined
    const { error } = await api.post(endpoint, payload)
    if (error) toast.error(error)
    else {
      toast.success(
        action === "submit" ? "تم إرسال الحملة للاعتماد"
          : action === "approve" ? "تم اعتماد الحملة"
            : "تم رفض الحملة"
      )
      await loadData()
    }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مركز الإشعارات</h1>
          <p className="text-sm text-gray-500 mt-1">
            جميع الرسائل إلى الأولياء تمر من هنا أولاً قبل الإرسال الفعلي عبر واتساب.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          الإرسال الخارجي لم يُفعّل بعد. هذه المرحلة تغطي القوالب، الحملات، والموافقات.
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">قالب إشعار</h2>
            <p className="text-sm text-gray-500 mt-1">أنشئ قالبًا يعاد استخدامه للرسوم أو الغياب أو النتائج.</p>
          </div>

          <div className="grid gap-4">
            <Input
              label="اسم القالب"
              value={templateForm.name}
              onChange={(e) => setTemplateForm((current) => ({ ...current, name: e.target.value }))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="نوع الإشعار"
                value={templateForm.type}
                onChange={(value) => setTemplateForm((current) => ({ ...current, type: value }))}
                options={typeOptions}
              />
              <Select
                label="القناة"
                value={templateForm.channel}
                onChange={(value) => setTemplateForm((current) => ({ ...current, channel: value }))}
                options={[{ value: "WHATSAPP", label: "واتساب" }, { value: "IN_APP", label: "داخل النظام" }]}
              />
            </div>
            <Input
              label="عنوان الرسالة"
              value={templateForm.titleTemplate}
              onChange={(e) => setTemplateForm((current) => ({ ...current, titleTemplate: e.target.value }))}
            />
            <Textarea
              label="نص القالب"
              rows={4}
              value={templateForm.messageTemplate}
              onChange={(e) => setTemplateForm((current) => ({ ...current, messageTemplate: e.target.value }))}
            />
            <Button loading={savingTemplate} onClick={createTemplate}>
              <BellRing className="h-4 w-4" /> حفظ القالب
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">حملة جديدة</h2>
            <p className="text-sm text-gray-500 mt-1">أنشئ حملة ثم أرسلها للاعتماد قبل أي إرسال فعلي للأولياء.</p>
          </div>

          <div className="grid gap-4">
            <Select
              label="قالب جاهز"
              value={campaignForm.templateId}
              onChange={(value) => {
                const selectedTemplate = templates.find((template) => template.id === value)
                setCampaignForm((current) => ({
                  ...current,
                  templateId: value,
                  type: selectedTemplate?.type || current.type,
                  channel: selectedTemplate?.channel || current.channel,
                  title: selectedTemplate?.titleTemplate || current.title,
                  message: selectedTemplate?.messageTemplate || current.message,
                }))
              }}
              options={[{ value: "", label: "بدون قالب" }, ...templates.map((template) => ({ value: template.id, label: template.name }))]}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="نوع الإشعار"
                value={campaignForm.type}
                onChange={(value) => setCampaignForm((current) => ({ ...current, type: value }))}
                options={typeOptions}
              />
              <Select
                label="الجمهور"
                value={campaignForm.audienceType}
                onChange={(value) => setCampaignForm((current) => ({ ...current, audienceType: value }))}
                options={audienceOptions}
              />
            </div>
            <Input
              label="عنوان الحملة"
              value={campaignForm.title}
              onChange={(e) => setCampaignForm((current) => ({ ...current, title: e.target.value }))}
            />
            <Textarea
              label="نص الحملة"
              rows={4}
              value={campaignForm.message}
              onChange={(e) => setCampaignForm((current) => ({ ...current, message: e.target.value }))}
            />

            {(campaignForm.audienceType === "CLASSROOM" || campaignForm.audienceType === "UNPAID_FEES") && (
              <Select
                label="القسم"
                value={campaignForm.classroomId}
                onChange={(value) => setCampaignForm((current) => ({ ...current, classroomId: value }))}
                options={[{ value: "", label: "كل الأقسام" }, ...classrooms.map((item) => ({ value: item.id, label: item.name }))]}
              />
            )}

            {campaignForm.audienceType === "LEVEL" && (
              <Select
                label="المستوى"
                value={campaignForm.levelId}
                onChange={(value) => setCampaignForm((current) => ({ ...current, levelId: value }))}
                options={levels.map((item) => ({ value: item.id, label: item.name }))}
              />
            )}

            {campaignForm.audienceType === "STREAM" && (
              <Select
                label="الشعبة"
                value={campaignForm.streamId}
                onChange={(value) => setCampaignForm((current) => ({ ...current, streamId: value }))}
                options={streams.map((item) => ({ value: item.id, label: item.name }))}
              />
            )}

            {campaignForm.audienceType === "UNPAID_FEES" && (
              <Input
                label="شهر الرسوم"
                type="month"
                value={campaignForm.month}
                onChange={(e) => setCampaignForm((current) => ({ ...current, month: e.target.value }))}
              />
            )}

            <Button loading={savingCampaign} onClick={createCampaign}>
              <Send className="h-4 w-4" /> إنشاء الحملة
            </Button>
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">الحملات الحالية</h2>
          <p className="text-sm text-gray-500 mt-1">راجع الحالة الحالية لكل حملة، ثم اعتمد أو ارفض.</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
            لا توجد حملات حتى الآن
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const status = statusLabels[campaign.status] || { label: campaign.status, variant: "default" as const }
              return (
                <div key={campaign.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{campaign.title}</h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>النوع: {campaign.type}</span>
                        <span>الجمهور: {campaign.audienceType}</span>
                        <span>المستلمون: {campaign.recipientsCount}</span>
                        <span>المنشئ: {campaign.createdByUser?.name || "غير معروف"}</span>
                        {campaign.approvedByUser && <span>المعتمد: {campaign.approvedByUser.name}</span>}
                      </div>
                      {campaign.statusSummary && (
                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          {Object.entries(campaign.statusSummary).map(([key, value]) => (
                            <span key={key} className="rounded-full bg-gray-100 px-2 py-1">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(campaign.status === "DRAFT" || campaign.status === "REJECTED") && (
                        <Button size="sm" onClick={() => void updateCampaignStatus(campaign.id, "submit")}>
                          <Send className="h-4 w-4" /> إرسال للاعتماد
                        </Button>
                      )}
                      {campaign.status === "PENDING_APPROVAL" && (
                        <>
                          <Button size="sm" onClick={() => void updateCampaignStatus(campaign.id, "approve")}>
                            <CheckCircle2 className="h-4 w-4" /> اعتماد
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void updateCampaignStatus(campaign.id, "reject")}>
                            <XCircle className="h-4 w-4" /> رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

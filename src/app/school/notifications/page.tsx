"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Badge, Button, Card, Input, LoadingPage, Select, Textarea } from "@/components/ui"
import { api } from "@/lib/api"
import { BellRing, CheckCircle2, Eye, Send, XCircle } from "lucide-react"

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
  message: string
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

export default function SchoolNotificationsPage() {
  const t = useTranslations("notificationsPage")
  const searchParams = useSearchParams()
  const initialAudienceType = searchParams?.get("audienceType") || "ALL_PARENTS"
  const initialClassroomId = searchParams?.get("classroomId") || ""
  const initialLevelId = searchParams?.get("levelId") || ""
  const initialStreamId = searchParams?.get("streamId") || ""
  const initialType = searchParams?.get("type") || "GENERAL"
  const initialMonth = searchParams?.get("month") || ""
  const [loading, setLoading] = useState(true)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [classrooms, setClassrooms] = useState<OptionItem[]>([])
  const [levels, setLevels] = useState<OptionItem[]>([])
  const [streams, setStreams] = useState<OptionItem[]>([])
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("")
  const [campaignTypeFilter, setCampaignTypeFilter] = useState("")

  const [templateForm, setTemplateForm] = useState({
    name: "",
    type: "GENERAL",
    channel: "WHATSAPP",
    titleTemplate: "",
    messageTemplate: "",
  })

  const [campaignForm, setCampaignForm] = useState({
    templateId: "",
    type: initialType,
    channel: "WHATSAPP",
    title: "",
    message: "",
    audienceType: initialAudienceType,
    classroomId: initialClassroomId,
    levelId: initialLevelId,
    streamId: initialStreamId,
    month: initialMonth,
  })
  const typeOptions = [
    { value: "GENERAL", label: t("typeGeneral") },
    { value: "ATTENDANCE", label: t("typeAttendance") },
    { value: "FEES", label: t("typeFees") },
    { value: "RESULTS", label: t("typeResults") },
    { value: "EVENT", label: t("typeEvent") },
  ]
  const audienceOptions = [
    { value: "ALL_PARENTS", label: t("audienceAllParents") },
    { value: "CLASSROOM", label: t("audienceClassroom") },
    { value: "LEVEL", label: t("audienceLevel") },
    { value: "STREAM", label: t("audienceStream") },
    { value: "UNPAID_FEES", label: t("audienceUnpaidFees") },
  ]
  const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
    DRAFT: { label: t("statusDraft"), variant: "default" },
    PENDING_APPROVAL: { label: t("statusPendingApproval"), variant: "warning" },
    APPROVED: { label: t("statusApproved"), variant: "success" },
    SCHEDULED: { label: t("statusScheduled"), variant: "warning" },
    REJECTED: { label: t("statusRejected"), variant: "danger" },
    SENT: { label: t("statusSent"), variant: "success" },
    FAILED: { label: t("statusFailed"), variant: "danger" },
  }

  function getCampaignAudienceSummary(campaign: Campaign) {
    return audienceOptions.find((option) => option.value === campaign.audienceType)?.label || campaign.audienceType
  }

  function getCampaignTypeSummary(type: string) {
    return typeOptions.find((option) => option.value === type)?.label || type
  }

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

  useEffect(() => {
    setCampaignForm((current) => ({
      ...current,
      type: initialType,
      audienceType: initialAudienceType,
      classroomId: initialClassroomId,
      levelId: initialLevelId,
      streamId: initialStreamId,
      month: initialMonth,
    }))
  }, [initialAudienceType, initialClassroomId, initialLevelId, initialMonth, initialStreamId, initialType])

  async function createTemplate() {
    if (!templateForm.name || !templateForm.titleTemplate || !templateForm.messageTemplate) {
      toast.error(t("fillTemplateFields"))
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
    if (!error && data) toast.success(t("templateSaved"))
    setSavingTemplate(false)
  }

  async function createCampaign() {
    if (!campaignForm.title || !campaignForm.message) {
      toast.error(t("fillCampaignFields"))
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
        toast.success(t("campaignCreated"))
        setCampaignForm({
          templateId: "",
          type: initialType,
          channel: "WHATSAPP",
          title: "",
          message: "",
          audienceType: initialAudienceType,
          classroomId: initialClassroomId,
          levelId: initialLevelId,
          streamId: initialStreamId,
          month: initialMonth,
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
        action === "submit" ? t("campaignSubmitted")
          : action === "approve" ? t("campaignApproved")
            : t("campaignRejected")
      )
      await loadData()
    }
  }

  const visibleCampaigns = campaigns.filter((campaign) => {
    if (campaignStatusFilter && campaign.status !== campaignStatusFilter) return false
    if (campaignTypeFilter && campaign.type !== campaignTypeFilter) return false
    return true
  })

  const campaignStats = {
    total: campaigns.length,
    pendingApproval: campaigns.filter((campaign) => campaign.status === "PENDING_APPROVAL").length,
    approved: campaigns.filter((campaign) => campaign.status === "APPROVED").length,
    sent: campaigns.filter((campaign) => campaign.status === "SENT").length,
  }

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مركز الإشعارات</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("externalSendingNotEnabled")}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("allCampaigns")}</p>
          <p className="text-2xl font-bold">{campaignStats.total}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("pendingApproval")}</p>
          <p className="text-2xl font-bold text-amber-600">{campaignStats.pendingApproval}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("approvedReady")}</p>
          <p className="text-2xl font-bold text-blue-700">{campaignStats.approved}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("sent")}</p>
          <p className="text-2xl font-bold text-green-600">{campaignStats.sent}</p>
        </Card>
      </div>

      {(initialClassroomId || initialLevelId || initialStreamId || initialMonth || initialAudienceType !== "ALL_PARENTS") && (
        <Card padding="md" className="border-blue-100 bg-blue-50">
          <p className="text-sm font-medium text-blue-900">{t("openedWithContext")}</p>
          <p className="mt-1 text-sm text-blue-700">
            {t("openedWithContextText")}
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{t("templateTitle")}</h2>
            <p className="text-sm text-gray-500 mt-1">{t("templateSubtitle")}</p>
          </div>

          <div className="grid gap-4">
            <Input
              label={t("templateName")}
              value={templateForm.name}
              onChange={(e) => setTemplateForm((current) => ({ ...current, name: e.target.value }))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label={t("notificationType")}
                value={templateForm.type}
                onChange={(value) => setTemplateForm((current) => ({ ...current, type: value }))}
                options={typeOptions}
              />
              <Select
                label={t("channel")}
                value={templateForm.channel}
                onChange={(value) => setTemplateForm((current) => ({ ...current, channel: value }))}
                options={[{ value: "WHATSAPP", label: t("whatsapp") }, { value: "IN_APP", label: t("inApp") }]}
              />
            </div>
            <Input
              label={t("messageTitle")}
              value={templateForm.titleTemplate}
              onChange={(e) => setTemplateForm((current) => ({ ...current, titleTemplate: e.target.value }))}
            />
            <Textarea
              label={t("templateBody")}
              rows={4}
              value={templateForm.messageTemplate}
              onChange={(e) => setTemplateForm((current) => ({ ...current, messageTemplate: e.target.value }))}
            />
            <Button loading={savingTemplate} onClick={createTemplate}>
              <BellRing className="h-4 w-4" /> {t("saveTemplate")}
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{t("newCampaignTitle")}</h2>
            <p className="text-sm text-gray-500 mt-1">{t("newCampaignSubtitle")}</p>
          </div>

          <div className="grid gap-4">
            <Select
              label={t("readyTemplate")}
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
              options={[{ value: "", label: t("withoutTemplate") }, ...templates.map((template) => ({ value: template.id, label: template.name }))]}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label={t("notificationType")}
                value={campaignForm.type}
                onChange={(value) => setCampaignForm((current) => ({ ...current, type: value }))}
                options={typeOptions}
              />
              <Select
                label={t("audience")}
                value={campaignForm.audienceType}
                onChange={(value) => setCampaignForm((current) => ({ ...current, audienceType: value }))}
                options={audienceOptions}
              />
            </div>
            <Input
              label={t("campaignTitle")}
              value={campaignForm.title}
              onChange={(e) => setCampaignForm((current) => ({ ...current, title: e.target.value }))}
            />
            <Textarea
              label={t("campaignBody")}
              rows={4}
              value={campaignForm.message}
              onChange={(e) => setCampaignForm((current) => ({ ...current, message: e.target.value }))}
            />

            {(campaignForm.audienceType === "CLASSROOM" || campaignForm.audienceType === "UNPAID_FEES") && (
              <Select
                label={t("classroom")}
                value={campaignForm.classroomId}
                onChange={(value) => setCampaignForm((current) => ({ ...current, classroomId: value }))}
                options={[{ value: "", label: t("allClassrooms") }, ...classrooms.map((item) => ({ value: item.id, label: item.name }))]}
              />
            )}

            {campaignForm.audienceType === "LEVEL" && (
              <Select
                label={t("level")}
                value={campaignForm.levelId}
                onChange={(value) => setCampaignForm((current) => ({ ...current, levelId: value }))}
                options={levels.map((item) => ({ value: item.id, label: item.name }))}
              />
            )}

            {campaignForm.audienceType === "STREAM" && (
              <Select
                label={t("stream")}
                value={campaignForm.streamId}
                onChange={(value) => setCampaignForm((current) => ({ ...current, streamId: value }))}
                options={streams.map((item) => ({ value: item.id, label: item.name }))}
              />
            )}

            {campaignForm.audienceType === "UNPAID_FEES" && (
              <Input
                label={t("feesMonth")}
                type="month"
                value={campaignForm.month}
                onChange={(e) => setCampaignForm((current) => ({ ...current, month: e.target.value }))}
              />
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {t("draftHint")}
            </div>

            <Button loading={savingCampaign} onClick={createCampaign}>
              <Send className="h-4 w-4" /> {t("createCampaign")}
            </Button>
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="mb-4">
            <h2 className="text-lg font-semibold">{t("currentCampaigns")}</h2>
            <p className="text-sm text-gray-500 mt-1">{t("currentCampaignsSubtitle")}</p>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <Select
            label={t("filterByStatus")}
            value={campaignStatusFilter}
            onChange={setCampaignStatusFilter}
            options={[
              { value: "", label: t("allStatuses") },
              ...Object.entries(statusLabels).map(([value, meta]) => ({ value, label: meta.label })),
            ]}
          />
          <Select
            label={t("filterByType")}
            value={campaignTypeFilter}
            onChange={setCampaignTypeFilter}
            options={[{ value: "", label: t("allTypes") }, ...typeOptions]}
          />
        </div>

        {visibleCampaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-500">
            {t("noMatchingCampaigns")}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleCampaigns.map((campaign) => {
              const status = statusLabels[campaign.status] || { label: campaign.status, variant: "default" as const }
              return (
                <div key={campaign.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{campaign.title}</h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{campaign.message}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>{t("typeLabel", { value: getCampaignTypeSummary(campaign.type) })}</span>
                        <span>{t("audienceLabel", { value: getCampaignAudienceSummary(campaign) })}</span>
                        <span>{t("recipientsLabel", { count: campaign.recipientsCount })}</span>
                        <span>{t("creatorLabel", { name: campaign.createdByUser?.name || t("unknownUser") })}</span>
                        {campaign.approvedByUser && <span>{t("approverLabel", { name: campaign.approvedByUser.name })}</span>}
                      </div>
                      {campaign.statusSummary && (
                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          {Object.entries(campaign.statusSummary).map(([key, value]) => (
                            <span key={key} className="rounded-full bg-gray-100 px-2 py-1">
                              {(statusLabels[key]?.label || key)}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/school/notifications/${campaign.id}`}>
                        <Button variant="secondary" size="sm">
                          <Eye className="h-4 w-4" /> {t("details")}
                        </Button>
                      </Link>
                      {(campaign.status === "DRAFT" || campaign.status === "REJECTED") && (
                        <Button size="sm" onClick={() => void updateCampaignStatus(campaign.id, "submit")}>
                          <Send className="h-4 w-4" /> {t("submitForApproval")}
                        </Button>
                      )}
                      {campaign.status === "PENDING_APPROVAL" && (
                        <>
                          <Button size="sm" onClick={() => void updateCampaignStatus(campaign.id, "approve")}>
                            <CheckCircle2 className="h-4 w-4" /> {t("approve")}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void updateCampaignStatus(campaign.id, "reject")}>
                            <XCircle className="h-4 w-4" /> {t("reject")}
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

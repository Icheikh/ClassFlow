"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Input, LoadingPage, Textarea } from "@/components/ui"
import toast from "react-hot-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { getDateLocale } from "@/lib/locale"

type TemplateSummary = {
  id: string
  name: string
  sourceType: string
  sourceFileName: string | null
  isActive: boolean
  updatedAt: string
}

type TemplateDetail = {
  id: string
  name: string
  sourceType: string
  sourceFileName: string | null
  sourceDescription: string | null
  sourcePreview: string | null
  definitionVersion: number
  isActive: boolean
  title: string
  subtitle: string | null
  footerNote: string | null
  notesLabel: string
  signatureLabel: string
  classroomLabel: string
  termLabel: string
  statsLabel: string
  studentsCountLabel: string
  classAverageLabel: string
  showRank: boolean
  showWeightedScore: boolean
  showRuleNotes: boolean
  showPolicyNote: boolean
  showSubjectCoefficient: boolean
  showSchoolContacts: boolean
  showNotesSection: boolean
  showSignatureSection: boolean
  createdAt: string
  updatedAt: string
}

type SettingsResponse = {
  name: string
  phone: string
  email: string
  address: string
  activeTemplateId: string
  templates: TemplateSummary[]
  template: TemplateDetail
}

type ClassroomOption = {
  id: string
  name: string
  level: { name: string; stage: { name: string } }
  stream: { name: string } | null
}

type TermOption = {
  id: string
  name: string
  isActive: boolean
}

function createEmptyTemplate(t: (key: string) => string): TemplateDetail {
  return {
    id: "",
    name: t("defaultTemplateName"),
    sourceType: "CUSTOM",
    sourceFileName: null,
    sourceDescription: null,
    sourcePreview: null,
    definitionVersion: 1,
    isActive: true,
    title: t("defaultReportTitle"),
    subtitle: "",
    footerNote: "",
    notesLabel: t("defaultNotesLabel"),
    signatureLabel: t("defaultSignatureLabel"),
    classroomLabel: t("defaultClassroomLabel"),
    termLabel: t("defaultTermLabel"),
    statsLabel: t("defaultStatsLabel"),
    studentsCountLabel: t("defaultStudentsCountLabel"),
    classAverageLabel: t("defaultClassAverageLabel"),
    showRank: true,
    showWeightedScore: true,
    showRuleNotes: true,
    showPolicyNote: true,
    showSubjectCoefficient: true,
    showSchoolContacts: true,
    showNotesSection: true,
    showSignatureSection: true,
    createdAt: "",
    updatedAt: "",
  }
}

function createEmptyForm(t: (key: string) => string): SettingsResponse {
  return {
    name: "",
    phone: "",
    email: "",
    address: "",
    activeTemplateId: "",
    templates: [],
    template: createEmptyTemplate(t),
  }
}

const TEMPLATE_PLACEHOLDERS = [
  "{{school.name}}",
  "{{school.address}}",
  "{{school.phone}}",
  "{{school.contacts}}",
  "{{classroom.name}}",
  "{{classroom.stage}}",
  "{{classroom.level}}",
  "{{classroom.stream}}",
  "{{classroom.fullLabel}}",
  "{{term.name}}",
  "{{resultRule.name}}",
  "{{resultRule.fullName}}",
  "{{stats.students}}",
  "{{stats.classAverage}}",
  "{{publication.status}}",
]

export default function SchoolSettingsPage() {
  const router = useRouter()
  const user = useCurrentUser()
  const locale = useLocale()
  const t = useTranslations("settingsPage")
  const sourceOptions = [
    { value: "CUSTOM", label: t("sourceOptionCustom") },
    { value: "SYSTEM", label: t("sourceOptionSystem") },
    { value: "WORD", label: t("sourceOptionWord") },
    { value: "EXCEL", label: t("sourceOptionExcel") },
    { value: "JSON_IMPORT", label: t("sourceOptionJsonImport") },
  ]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [importPayload, setImportPayload] = useState("")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [exportPayload, setExportPayload] = useState("")
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [terms, setTerms] = useState<TermOption[]>([])
  const [previewClassroomId, setPreviewClassroomId] = useState("")
  const [previewTermId, setPreviewTermId] = useState("")
  const [form, setForm] = useState<SettingsResponse>(() => createEmptyForm(t))

  function updateTemplate<Key extends keyof TemplateDetail>(key: Key, value: TemplateDetail[Key]) {
    setForm((current) => ({
      ...current,
      template: {
        ...current.template,
        [key]: value,
      },
    }))
  }

  function applySettings(data: SettingsResponse) {
    setForm({
      ...data,
        template: {
          ...data.template,
          subtitle: data.template.subtitle || "",
          footerNote: data.template.footerNote || "",
          sourceFileName: data.template.sourceFileName || "",
          sourceDescription: data.template.sourceDescription || "",
          sourcePreview: data.template.sourcePreview || "",
        },
      })
  }

  async function reloadSettings() {
    const { data, error } = await api.get<SettingsResponse>("/api/school/settings")
    if (error) {
      toast.error(error)
    } else if (data) {
      applySettings(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!user.role) return
    if (user.role !== "SCHOOL_ADMIN") {
      router.replace("/school")
      return
    }

    async function loadInitialSettings() {
      const [settingsRes, classroomsRes, termsRes] = await Promise.all([
        api.get<SettingsResponse>("/api/school/settings"),
        api.get<ClassroomOption[]>("/api/school/classrooms"),
        api.get<TermOption[]>("/api/school/terms"),
      ])

      if (settingsRes.error) toast.error(settingsRes.error)
      else if (settingsRes.data) applySettings(settingsRes.data)

      if (classroomsRes.error) toast.error(classroomsRes.error)
      else if (classroomsRes.data) {
        setClassrooms(classroomsRes.data)
        if (classroomsRes.data[0]) setPreviewClassroomId(classroomsRes.data[0].id)
      }

      if (termsRes.error) toast.error(termsRes.error)
      else if (termsRes.data) {
        setTerms(termsRes.data)
        const activeTerm = termsRes.data.find((term) => term.isActive)
        if (activeTerm) setPreviewTermId(activeTerm.id)
        else if (termsRes.data[0]) setPreviewTermId(termsRes.data[0].id)
      }

      setLoading(false)
    }

    void loadInitialSettings()
  }, [router, user.role])

  if (user.role && user.role !== "SCHOOL_ADMIN") {
    return <LoadingPage />
  }

  async function save() {
    if (!form.name) {
      toast.error(t("schoolNameRequired"))
      return
    }

    setSaving(true)
    const { data, error } = await api.put<SettingsResponse>("/api/school/settings", form)
    if (error) {
      toast.error(error)
    } else if (data) {
      applySettings(data)
      toast.success(t("settingsSaved"))
    }
    setSaving(false)
  }

  async function createTemplateCopy() {
    setTemplateBusy(true)
    const { data, error } = await api.post<{
      activeTemplateId: string
      templates: TemplateSummary[]
      template: TemplateDetail
    }>("/api/school/result-report-templates", {
      action: "create",
      name: `${form.template.name} - ${t("templateCopySuffix")}`,
    })

    if (error) {
      toast.error(error)
    } else if (data?.template) {
      setForm((current) => ({
        ...current,
        activeTemplateId: data.activeTemplateId,
        templates: data.templates,
        template: {
          ...data.template,
          subtitle: data.template.subtitle || "",
          footerNote: data.template.footerNote || "",
          sourceFileName: data.template.sourceFileName || "",
          sourceDescription: data.template.sourceDescription || "",
          sourcePreview: data.template.sourcePreview || "",
        },
      }))
      setExportPayload("")
      toast.success(t("templateCopyCreated"))
    }
    setTemplateBusy(false)
  }

  async function activateTemplate(templateId: string) {
    if (!templateId || templateId === form.activeTemplateId) return

    setTemplateBusy(true)
    const { data, error } = await api.post<{
      activeTemplateId: string
      templates: TemplateSummary[]
      template: TemplateDetail
    }>("/api/school/result-report-templates", {
      action: "activate",
      templateId,
    })

    if (error) {
      toast.error(error)
    } else if (data?.template) {
      setForm((current) => ({
        ...current,
        activeTemplateId: data.activeTemplateId,
        templates: data.templates,
        template: {
          ...data.template,
          subtitle: data.template.subtitle || "",
          footerNote: data.template.footerNote || "",
          sourceFileName: data.template.sourceFileName || "",
          sourceDescription: data.template.sourceDescription || "",
          sourcePreview: data.template.sourcePreview || "",
        },
      }))
      setExportPayload("")
    }
    setTemplateBusy(false)
  }

  async function exportTemplate() {
    setTemplateBusy(true)
    const { data, error } = await api.post<{ export: unknown }>("/api/school/result-report-templates", {
      action: "export",
      templateId: form.activeTemplateId,
    })

    if (error) {
      toast.error(error)
    } else if (data?.export) {
      const serialized = JSON.stringify(data.export, null, 2)
      setExportPayload(serialized)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(serialized).catch(() => null)
      }
      toast.success(t("templateExportPrepared"))
    }
    setTemplateBusy(false)
  }

  async function importTemplate() {
    if (!importPayload.trim()) {
      toast.error(t("pasteTemplateJson"))
      return
    }

    setTemplateBusy(true)
    const { data, error } = await api.post<{
      activeTemplateId: string
      templates: TemplateSummary[]
      template: TemplateDetail
    }>("/api/school/result-report-templates", {
      action: "import",
      payload: importPayload,
    })

    if (error) {
      toast.error(error)
    } else if (data?.template) {
      setForm((current) => ({
        ...current,
        activeTemplateId: data.activeTemplateId,
        templates: data.templates,
        template: {
          ...data.template,
          subtitle: data.template.subtitle || "",
          footerNote: data.template.footerNote || "",
          sourceFileName: data.template.sourceFileName || "",
          sourceDescription: data.template.sourceDescription || "",
        },
      }))
      setExportPayload("")
      setImportPayload("")
      toast.success(t("templateImported"))
    }
    setTemplateBusy(false)
  }

  async function importTemplateFile() {
    if (!importFile) {
      toast.error(t("selectWordOrExcel"))
      return
    }

    const formData = new FormData()
    formData.set("file", importFile)
    formData.set("name", importFile.name.replace(/\.[^.]+$/, ""))

    setTemplateBusy(true)
    const { data, error } = await api.postForm<{
      activeTemplateId: string
      templates: TemplateSummary[]
      template: TemplateDetail
    }>("/api/school/result-report-templates/import-file", formData)

    if (error) {
      toast.error(error)
    } else if (data?.template) {
      setForm((current) => ({
        ...current,
        activeTemplateId: data.activeTemplateId,
        templates: data.templates,
        template: {
          ...data.template,
          subtitle: data.template.subtitle || "",
          footerNote: data.template.footerNote || "",
          sourceFileName: data.template.sourceFileName || "",
          sourceDescription: data.template.sourceDescription || "",
          sourcePreview: data.template.sourcePreview || "",
        },
      }))
      setImportFile(null)
      setExportPayload("")
      toast.success(t("templateFileImported"))
    }
    setTemplateBusy(false)
  }

  async function deleteTemplate() {
    if (form.templates.length <= 1) {
      toast.error(t("keepAtLeastOneTemplate"))
      return
    }

    const confirmed = window.confirm(t("confirmDeleteTemplate", { name: form.template.name }))
    if (!confirmed) return

    setTemplateBusy(true)
    const { error } = await api.delete(`/api/school/result-report-templates/${form.activeTemplateId}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("templateDeleted"))
      await reloadSettings()
      setExportPayload("")
    }
    setTemplateBusy(false)
  }

  function openPreview() {
    if (!previewClassroomId || !previewTermId || !form.activeTemplateId) {
      toast.error(t("selectPreviewContext"))
      return
    }

    const params = new URLSearchParams({
      classroomId: previewClassroomId,
      termId: previewTermId,
      templateId: form.activeTemplateId,
      preview: "1",
    })

    window.open(`/school/results/report?${params.toString()}`, "_blank", "noopener,noreferrer")
  }

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
        <Card padding="lg">
          <div className="space-y-4">
            <Input label={t("schoolName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t("email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label={t("address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t("templatesTitle")}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("templatesSubtitle")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={createTemplateCopy} loading={templateBusy}>
                {t("copyCurrentTemplate")}
              </Button>
              <Button variant="secondary" onClick={exportTemplate} loading={templateBusy}>
                {t("exportJson")}
              </Button>
              <Button variant="danger" onClick={deleteTemplate} loading={templateBusy}>
                {t("deleteTemplate")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">{t("activeTemplate")}</label>
                <select
                  value={form.activeTemplateId}
                  onChange={(e) => void activateTemplate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {form.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isActive ? ` ${t("activeBadge")}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{t("templateInfo")}</p>
                <p className="mt-2">{t("source")}: {sourceOptions.find((item) => item.value === form.template.sourceType)?.label || form.template.sourceType}</p>
                <p className="mt-1">{t("updatedAt")}: {form.template.updatedAt ? new Date(form.template.updatedAt).toLocaleString(getDateLocale(locale)) : "—"}</p>
                <p className="mt-1">{t("originalReference")}: {form.template.sourceFileName || t("unspecified")}</p>
              </div>

              {form.template.sourcePreview ? (
                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">{t("importedSourcePreview")}</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-6 text-gray-700">
                    {form.template.sourcePreview}
                  </pre>
                </div>
              ) : null}

              <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{t("templatePreview")}</p>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">{t("previewClassroom")}</label>
                    <select
                      value={previewClassroomId}
                      onChange={(e) => setPreviewClassroomId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t("selectClassroom")}</option>
                      {classrooms.map((classroom) => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name} · {classroom.level.stage.name} - {classroom.level.name}
                          {classroom.stream ? ` - ${classroom.stream.name}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">{t("previewTerm")}</label>
                    <select
                      value={previewTermId}
                      onChange={(e) => setPreviewTermId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t("selectTerm")}</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name} {term.isActive ? ` ${t("activeBadge")}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button variant="secondary" onClick={openPreview}>
                    {t("openLivePreview")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Textarea
                label={t("importJsonTemplate")}
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                rows={8}
                placeholder={t("importJsonPlaceholder")}
              />
              <Button onClick={importTemplate} loading={templateBusy}>
                {t("importAndActivate")}
              </Button>

              <div className="rounded-xl border border-dashed border-gray-300 p-4">
                <p className="text-sm font-medium text-gray-900">{t("importWordOrExcel")}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("importWordOrExcelText")}
                </p>
                <input
                  type="file"
                  accept=".docx,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="mt-3 block w-full text-sm text-gray-700 file:ml-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700"
                />
                <p className="mt-2 text-xs text-gray-500">
                  {importFile ? t("selectedFile", { name: importFile.name }) : t("noFileSelected")}
                </p>
                <Button className="mt-3" variant="secondary" onClick={importTemplateFile} loading={templateBusy}>
                  {t("uploadFileCreateTemplate")}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t("templateSystemName")}
              value={form.template.name}
              onChange={(e) => updateTemplate("name", e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t("sourceType")}</label>
              <select
                value={form.template.sourceType}
                onChange={(e) => updateTemplate("sourceType", e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t("sourceFileName")}
              value={form.template.sourceFileName || ""}
              onChange={(e) => updateTemplate("sourceFileName", e.target.value)}
              placeholder={t("sourceFilePlaceholder")}
            />
            <Input
              label={t("reportTitle")}
              value={form.template.title}
              onChange={(e) => updateTemplate("title", e.target.value)}
            />
            <Input
              label={t("reportSubtitle")}
              value={form.template.subtitle || ""}
              onChange={(e) => updateTemplate("subtitle", e.target.value)}
            />
            <Input
              label={t("notesSectionTitle")}
              value={form.template.notesLabel}
              onChange={(e) => updateTemplate("notesLabel", e.target.value)}
            />
            <Input
              label={t("signatureSectionTitle")}
              value={form.template.signatureLabel}
              onChange={(e) => updateTemplate("signatureLabel", e.target.value)}
            />
            <Textarea
              label={t("sourceDescription")}
              value={form.template.sourceDescription || ""}
              onChange={(e) => updateTemplate("sourceDescription", e.target.value)}
              rows={3}
              placeholder={t("sourceDescriptionPlaceholder")}
            />
          </div>

          <div>
            <h3 className="font-medium text-gray-900">{t("bindingTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t("bindingText")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t("classroomCardTitle")}
              value={form.template.classroomLabel}
              onChange={(e) => updateTemplate("classroomLabel", e.target.value)}
            />
            <Input
              label={t("termCardTitle")}
              value={form.template.termLabel}
              onChange={(e) => updateTemplate("termLabel", e.target.value)}
            />
            <Input
              label={t("statsCardTitle")}
              value={form.template.statsLabel}
              onChange={(e) => updateTemplate("statsLabel", e.target.value)}
            />
            <Input
              label={t("studentsCountText")}
              value={form.template.studentsCountLabel}
              onChange={(e) => updateTemplate("studentsCountLabel", e.target.value)}
            />
            <Input
              label={t("classAverageText")}
              value={form.template.classAverageLabel}
              onChange={(e) => updateTemplate("classAverageLabel", e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">{t("availablePlaceholders")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                <code key={placeholder} className="rounded bg-white px-2 py-1 text-xs text-blue-800">
                  {placeholder}
                </code>
              ))}
            </div>
          </div>

          <Textarea
            label={t("footerNote")}
            value={form.template.footerNote || ""}
            onChange={(e) => updateTemplate("footerNote", e.target.value)}
            rows={3}
          />

          <div>
            <h3 className="font-medium text-gray-900">{t("visibleElementsTitle")}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t("visibleElementsText")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showRank} onChange={(e) => updateTemplate("showRank", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showRank")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showWeightedScore} onChange={(e) => updateTemplate("showWeightedScore", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showWeightedScore")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showRuleNotes} onChange={(e) => updateTemplate("showRuleNotes", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showRuleNotes")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showPolicyNote} onChange={(e) => updateTemplate("showPolicyNote", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showPolicyNote")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showSubjectCoefficient} onChange={(e) => updateTemplate("showSubjectCoefficient", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showSubjectCoefficient")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showSchoolContacts} onChange={(e) => updateTemplate("showSchoolContacts", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showSchoolContacts")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showNotesSection} onChange={(e) => updateTemplate("showNotesSection", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showNotesSection")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showSignatureSection} onChange={(e) => updateTemplate("showSignatureSection", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t("showSignatureSection")}
            </label>
          </div>

          <Textarea
            label={t("lastExportedJson")}
            value={exportPayload}
            onChange={() => null}
            rows={10}
            readOnly
            placeholder={t("exportPlaceholder")}
          />

          <p className="text-xs text-gray-500">
            {t("phaseNote")}
          </p>

          <Button fullWidth loading={saving} onClick={save}>
            {t("saveAll")}
          </Button>
        </div>
      </Card>
    </div>
  )
}

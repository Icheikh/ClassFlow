"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Input, LoadingPage, Textarea } from "@/components/ui"
import toast from "react-hot-toast"

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
  definitionVersion: number
  isActive: boolean
  title: string
  subtitle: string | null
  footerNote: string | null
  notesLabel: string
  signatureLabel: string
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

const EMPTY_TEMPLATE: TemplateDetail = {
  id: "",
  name: "القالب الرئيسي",
  sourceType: "CUSTOM",
  sourceFileName: null,
  sourceDescription: null,
  definitionVersion: 1,
  isActive: true,
  title: "كشف نتائج القسم",
  subtitle: "",
  footerNote: "",
  notesLabel: "ملاحظات الإدارة",
  signatureLabel: "الختم والتوقيع",
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

const EMPTY_FORM: SettingsResponse = {
  name: "",
  phone: "",
  email: "",
  address: "",
  activeTemplateId: "",
  templates: [],
  template: EMPTY_TEMPLATE,
}

const SOURCE_OPTIONS = [
  { value: "CUSTOM", label: "قالب مخصص داخل النظام" },
  { value: "SYSTEM", label: "قالب نظامي" },
  { value: "WORD", label: "مستند Word" },
  { value: "EXCEL", label: "ملف Excel" },
  { value: "JSON_IMPORT", label: "استيراد JSON" },
]

export default function SchoolSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [importPayload, setImportPayload] = useState("")
  const [exportPayload, setExportPayload] = useState("")
  const [form, setForm] = useState<SettingsResponse>(EMPTY_FORM)

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
    async function loadInitialSettings() {
      const { data, error } = await api.get<SettingsResponse>("/api/school/settings")
      if (error) {
        toast.error(error)
      } else if (data) {
        applySettings(data)
      }
      setLoading(false)
    }

    void loadInitialSettings()
  }, [])

  async function save() {
    if (!form.name) {
      toast.error("اسم المدرسة مطلوب")
      return
    }

    setSaving(true)
    const { data, error } = await api.put<SettingsResponse>("/api/school/settings", form)
    if (error) {
      toast.error(error)
    } else if (data) {
      applySettings(data)
      toast.success("تم حفظ الإعدادات")
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
      name: `${form.template.name} - نسخة`,
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
      toast.success("تم إنشاء نسخة جديدة من القالب")
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
      toast.success("تم تجهيز تصدير القالب")
    }
    setTemplateBusy(false)
  }

  async function importTemplate() {
    if (!importPayload.trim()) {
      toast.error("ألصق JSON القالب أولاً")
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
      toast.success("تم استيراد القالب وتفعيله")
    }
    setTemplateBusy(false)
  }

  async function deleteTemplate() {
    if (form.templates.length <= 1) {
      toast.error("يجب الإبقاء على قالب واحد على الأقل")
      return
    }

    const confirmed = window.confirm(`سيتم حذف القالب "${form.template.name}"`)
    if (!confirmed) return

    setTemplateBusy(true)
    const { error } = await api.delete(`/api/school/result-report-templates/${form.activeTemplateId}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success("تم حذف القالب")
      await reloadSettings()
      setExportPayload("")
    }
    setTemplateBusy(false)
  }

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">إعدادات المدرسة</h1>
        <Card padding="lg">
          <div className="space-y-4">
            <Input label="اسم المدرسة" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="العنوان" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </Card>
      </div>

      <Card padding="lg">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">قوالب كشوف النتائج</h2>
              <p className="mt-1 text-sm text-gray-500">
                لكل مدرسة عدة قوالب، والنظام يولد الكشف دائماً وفق القالب النشط.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={createTemplateCopy} loading={templateBusy}>
                نسخ القالب الحالي
              </Button>
              <Button variant="secondary" onClick={exportTemplate} loading={templateBusy}>
                تصدير JSON
              </Button>
              <Button variant="danger" onClick={deleteTemplate} loading={templateBusy}>
                حذف القالب
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">القالب النشط</label>
                <select
                  value={form.activeTemplateId}
                  onChange={(e) => void activateTemplate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {form.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.isActive ? "• نشط" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">معلومات القالب</p>
                <p className="mt-2">المصدر: {SOURCE_OPTIONS.find((item) => item.value === form.template.sourceType)?.label || form.template.sourceType}</p>
                <p className="mt-1">آخر تعديل: {form.template.updatedAt ? new Date(form.template.updatedAt).toLocaleString("ar") : "—"}</p>
                <p className="mt-1">المرجع الأصلي: {form.template.sourceFileName || "غير محدد"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Textarea
                label="استيراد قالب JSON"
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                rows={8}
                placeholder='ألصق هنا JSON الذي تم تصديره من مدرسة أخرى أو من هذا النظام.'
              />
              <Button onClick={importTemplate} loading={templateBusy}>
                استيراد وتفعيل
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="اسم القالب داخل النظام"
              value={form.template.name}
              onChange={(e) => updateTemplate("name", e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">نوع المصدر</label>
              <select
                value={form.template.sourceType}
                onChange={(e) => updateTemplate("sourceType", e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="اسم ملف المرجع"
              value={form.template.sourceFileName || ""}
              onChange={(e) => updateTemplate("sourceFileName", e.target.value)}
              placeholder="مثال: result-template.docx"
            />
            <Input
              label="عنوان الكشف"
              value={form.template.title}
              onChange={(e) => updateTemplate("title", e.target.value)}
            />
            <Input
              label="عنوان فرعي"
              value={form.template.subtitle || ""}
              onChange={(e) => updateTemplate("subtitle", e.target.value)}
            />
            <Input
              label="عنوان خانة الملاحظات"
              value={form.template.notesLabel}
              onChange={(e) => updateTemplate("notesLabel", e.target.value)}
            />
            <Input
              label="عنوان خانة التوقيع"
              value={form.template.signatureLabel}
              onChange={(e) => updateTemplate("signatureLabel", e.target.value)}
            />
            <Textarea
              label="وصف مصدر القالب"
              value={form.template.sourceDescription || ""}
              onChange={(e) => updateTemplate("sourceDescription", e.target.value)}
              rows={3}
              placeholder="مثال: مبني على الكشف القديم للمدرسة من ملف Word لسنة 2025"
            />
          </div>

          <Textarea
            label="ملاحظة أسفل الكشف"
            value={form.template.footerNote || ""}
            onChange={(e) => updateTemplate("footerNote", e.target.value)}
            rows={3}
          />

          <div>
            <h3 className="font-medium text-gray-900">العناصر الظاهرة في الكشف</h3>
            <p className="mt-1 text-sm text-gray-500">
              هذه الخيارات تحدد ما سيظهر عند توليد الكشف النهائي من هذا القالب.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showRank} onChange={(e) => updateTemplate("showRank", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار الرتبة
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showWeightedScore} onChange={(e) => updateTemplate("showWeightedScore", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار المجموع الموزون
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showRuleNotes} onChange={(e) => updateTemplate("showRuleNotes", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار قاعدة الحساب
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showPolicyNote} onChange={(e) => updateTemplate("showPolicyNote", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار سياسة الفصل
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showSubjectCoefficient} onChange={(e) => updateTemplate("showSubjectCoefficient", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار ضارب المادة
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showSchoolContacts} onChange={(e) => updateTemplate("showSchoolContacts", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار عنوان المدرسة وهاتفها
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showNotesSection} onChange={(e) => updateTemplate("showNotesSection", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار خانة الملاحظات
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <input type="checkbox" checked={form.template.showSignatureSection} onChange={(e) => updateTemplate("showSignatureSection", e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              إظهار خانة التوقيع
            </label>
          </div>

          <Textarea
            label="آخر JSON تم تصديره"
            value={exportPayload}
            onChange={() => null}
            rows={10}
            readOnly
            placeholder="عند الضغط على تصدير JSON سيظهر محتوى القالب هنا."
          />

          <p className="text-xs text-gray-500">
            هذه المرحلة تبني محرك القوالب داخل النظام. استيراد ملفات Word وExcel نفسها وتحويلها تلقائياً إلى هذا القالب سيكون المرحلة التالية.
          </p>

          <Button fullWidth loading={saving} onClick={save}>
            حفظ إعدادات المدرسة والقالب النشط
          </Button>
        </div>
      </Card>
    </div>
  )
}

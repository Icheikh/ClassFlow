"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Input, LoadingPage } from "@/components/ui"
import toast from "react-hot-toast"

type SettingsResponse = {
  name: string
  phone: string
  email: string
  address: string
  template: {
    title: string
    subtitle: string
    footerNote: string
    notesLabel: string
    signatureLabel: string
    showRank: boolean
    showWeightedScore: boolean
    showRuleNotes: boolean
  }
}

export default function SchoolSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SettingsResponse>({
    name: "",
    phone: "",
    email: "",
    address: "",
    template: {
      title: "كشف نتائج القسم",
      subtitle: "",
      footerNote: "",
      notesLabel: "ملاحظات الإدارة",
      signatureLabel: "الختم والتوقيع",
      showRank: true,
      showWeightedScore: true,
      showRuleNotes: true,
    },
  })

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await api.get<SettingsResponse>("/api/school/settings")
      if (error) {
        toast.error(error)
      } else if (data) {
        setForm(data)
      }
      setLoading(false)
    }

    loadSettings()
  }, [])

  async function save() {
    if (!form.name) { toast.error("اسم المدرسة مطلوب"); return }
    setSaving(true)
    const { error } = await api.put("/api/school/settings", form)
    if (error) toast.error(error)
    else { toast.success("تم الحفظ") }
    setSaving(false)
  }

  if (loading) return <LoadingPage />

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">إعدادات المدرسة</h1>
      <Card padding="lg">
        <div className="space-y-4">
          <Input label="اسم المدرسة" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="العنوان" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </Card>

      <Card padding="lg" className="mt-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">قالب كشف النتائج</h2>
            <p className="text-sm text-gray-500 mt-1">
              هذا القالب خاص بالمدرسة ويظهر في صفحة طباعة النتائج. المدير يمكنه تعديله في أي وقت.
            </p>
          </div>
          <Input
            label="عنوان الكشف"
            value={form.template.title}
            onChange={(e) => setForm({ ...form, template: { ...form.template, title: e.target.value } })}
          />
          <Input
            label="عنوان فرعي"
            value={form.template.subtitle}
            onChange={(e) => setForm({ ...form, template: { ...form.template, subtitle: e.target.value } })}
          />
          <Input
            label="عنوان خانة الملاحظات"
            value={form.template.notesLabel}
            onChange={(e) => setForm({ ...form, template: { ...form.template, notesLabel: e.target.value } })}
          />
          <Input
            label="عنوان خانة التوقيع"
            value={form.template.signatureLabel}
            onChange={(e) => setForm({ ...form, template: { ...form.template, signatureLabel: e.target.value } })}
          />
          <Input
            label="ملاحظة أسفل الكشف"
            value={form.template.footerNote}
            onChange={(e) => setForm({ ...form, template: { ...form.template, footerNote: e.target.value } })}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.template.showRank}
                onChange={(e) => setForm({ ...form, template: { ...form.template, showRank: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              إظهار الرتبة
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.template.showWeightedScore}
                onChange={(e) => setForm({ ...form, template: { ...form.template, showWeightedScore: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              إظهار المجموع الموزون
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.template.showRuleNotes}
                onChange={(e) => setForm({ ...form, template: { ...form.template, showRuleNotes: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              إظهار ملاحظة قاعدة الحساب
            </label>
          </div>

          <p className="text-xs text-gray-500">
            حساب النتائج الأكاديمية يتم وفق القاعدة المنشورة للنظام، أما شكل الكشف نفسه فيبقى قابلاً للتخصيص حسب المدرسة.
          </p>
          <Button fullWidth loading={saving} onClick={save}>حفظ الإعدادات</Button>
        </div>
      </Card>
    </div>
  )
}

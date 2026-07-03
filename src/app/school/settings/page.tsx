"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import { Button, Card, Input, LoadingPage } from "@/components/ui"
import toast from "react-hot-toast"

export default function SchoolSettingsPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" })

  useEffect(() => {
    if (user?.school) {
      setForm({
        name: user.school.name || "",
        phone: user.school.phone || "",
        email: user.school.email || "",
        address: user.school.address || "",
      })
      setLoading(false)
    }
  }, [user])

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
          <p className="text-xs text-gray-500">حساب النتائج الأكاديمية يتم وفق القاعدة المعتمدة للنظام: معدل الاختبارات × 3 + الامتحان الأول × 1 + الامتحان الثاني × 2 + الامتحان الثالث × 3 ثم القسمة على 9.</p>
          <Button fullWidth loading={saving} onClick={save}>حفظ الإعدادات</Button>
        </div>
      </Card>
    </div>
  )
}

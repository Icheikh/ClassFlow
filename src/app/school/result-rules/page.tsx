"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Input, Textarea, Badge } from "@/components/ui"
import toast from "react-hot-toast"

type ResultRule = {
  id: string
  name: string
  testWeight: number
  exam1Weight: number
  exam2Weight: number
  exam3Weight: number
  denominator: number
  requireTest: boolean
  requireExam1: boolean
  requireExam2: boolean
  requireExam3: boolean
  status: string
  version: number
  notes: string | null
  publishedAt: string | null
}

type AuditLog = {
  id: string
  entityType: string
  action: string
  description: string | null
  createdAt: string
}

type ResultRuleResponse = {
  publishedRule: ResultRule
  draftRule: ResultRule | null
  auditLogs: AuditLog[]
}

type RuleForm = {
  name: string
  testWeight: string
  exam1Weight: string
  exam2Weight: string
  exam3Weight: string
  denominator: string
  requireTest: boolean
  requireExam1: boolean
  requireExam2: boolean
  requireExam3: boolean
  notes: string
}

function ruleToForm(rule: ResultRule): RuleForm {
  return {
    name: rule.name,
    testWeight: String(rule.testWeight),
    exam1Weight: String(rule.exam1Weight),
    exam2Weight: String(rule.exam2Weight),
    exam3Weight: String(rule.exam3Weight),
    denominator: String(rule.denominator),
    requireTest: rule.requireTest,
    requireExam1: rule.requireExam1,
    requireExam2: rule.requireExam2,
    requireExam3: rule.requireExam3,
    notes: rule.notes || "",
  }
}

export default function SchoolResultRulesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [data, setData] = useState<ResultRuleResponse | null>(null)
  const [form, setForm] = useState<RuleForm>({
    name: "",
    testWeight: "3",
    exam1Weight: "1",
    exam2Weight: "2",
    exam3Weight: "3",
    denominator: "9",
    requireTest: true,
    requireExam1: true,
    requireExam2: true,
    requireExam3: true,
    notes: "",
  })

  async function loadData() {
    const { data: response, error } = await api.get<ResultRuleResponse>("/api/school/result-rules")
    if (error) {
      toast.error(error)
      return
    }
    if (response) {
      setData(response)
      setForm(ruleToForm(response.draftRule || response.publishedRule))
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function saveDraft() {
    setSaving(true)
    const { error } = await api.post("/api/school/result-rules", {
      name: form.name,
      testWeight: form.testWeight,
      exam1Weight: form.exam1Weight,
      exam2Weight: form.exam2Weight,
      exam3Weight: form.exam3Weight,
      denominator: form.denominator,
      requireTest: form.requireTest,
      requireExam1: form.requireExam1,
      requireExam2: form.requireExam2,
      requireExam3: form.requireExam3,
      notes: form.notes,
    })

    if (error) toast.error(error)
    else {
      toast.success("تم حفظ المسودة")
      await loadData()
    }
    setSaving(false)
  }

  async function publishDraft() {
    setPublishing(true)
    const { error } = await api.put("/api/school/result-rules", { action: "publish" })
    if (error) toast.error(error)
    else {
      toast.success("تم نشر القاعدة")
      await loadData()
    }
    setPublishing(false)
  }

  async function discardDraft() {
    if (!confirm("سيتم حذف المسودة الحالية. هل أنت متأكد؟")) return
    const { error } = await api.delete("/api/school/result-rules")
    if (error) toast.error(error)
    else {
      toast.success("تم حذف المسودة")
      await loadData()
    }
  }

  if (loading || !data) {
    return (
      <Card>
        <p className="text-center text-gray-400 py-8">جاري تحميل قواعد النتائج...</p>
      </Card>
    )
  }

  const preview = `(${form.testWeight} × معدل الاختبارات + ${form.exam1Weight} × الامتحان الأول + ${form.exam2Weight} × الامتحان الثاني + ${form.exam3Weight} × الامتحان الثالث) ÷ ${form.denominator}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قواعد النتائج</h1>
          <p className="text-sm text-gray-500">المدير يضبط قاعدة الحساب لكل مدرسة، ثم ينشرها بعد المعاينة</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">المنشورة: الإصدار {data.publishedRule.version}</Badge>
          {data.draftRule && <Badge variant="warning">هناك مسودة جديدة</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card padding="lg" className="xl:col-span-2">
          <div className="space-y-4">
            <Input label="اسم القاعدة" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="وزن الاختبارات" type="number" step="0.1" min="0" value={form.testWeight} onChange={(e) => setForm({ ...form, testWeight: e.target.value })} />
              <Input label="وزن الامتحان الأول" type="number" step="0.1" min="0" value={form.exam1Weight} onChange={(e) => setForm({ ...form, exam1Weight: e.target.value })} />
              <Input label="وزن الامتحان الثاني" type="number" step="0.1" min="0" value={form.exam2Weight} onChange={(e) => setForm({ ...form, exam2Weight: e.target.value })} />
              <Input label="وزن الامتحان الثالث" type="number" step="0.1" min="0" value={form.exam3Weight} onChange={(e) => setForm({ ...form, exam3Weight: e.target.value })} />
            </div>

            <Input label="المقام" type="number" step="0.1" min="0.1" value={form.denominator} onChange={(e) => setForm({ ...form, denominator: e.target.value })} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.requireTest} onChange={(e) => setForm({ ...form, requireTest: e.target.checked })} />
                وجود الاختبارات إجباري
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.requireExam1} onChange={(e) => setForm({ ...form, requireExam1: e.target.checked })} />
                وجود الامتحان الأول إجباري
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.requireExam2} onChange={(e) => setForm({ ...form, requireExam2: e.target.checked })} />
                وجود الامتحان الثاني إجباري
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.requireExam3} onChange={(e) => setForm({ ...form, requireExam3: e.target.checked })} />
                وجود الامتحان الثالث إجباري
              </label>
            </div>

            <Textarea label="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="شرح مختصر لطريقة الحساب" />

            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <div className="font-medium mb-1">معاينة القاعدة</div>
              <div>{preview}</div>
            </div>

            <div className="flex gap-3">
              <Button fullWidth loading={saving} onClick={saveDraft}>حفظ كمسودة</Button>
              <Button variant="secondary" fullWidth loading={publishing} onClick={publishDraft} disabled={!data.draftRule}>نشر المسودة</Button>
              <Button variant="danger" fullWidth onClick={discardDraft} disabled={!data.draftRule}>حذف المسودة</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card padding="lg">
            <h2 className="font-semibold mb-3">القاعدة المنشورة</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div>الاسم: <span className="font-medium text-gray-900">{data.publishedRule.name}</span></div>
              <div>الإصدار: <span className="font-medium text-gray-900">{data.publishedRule.version}</span></div>
              <div>المعادلة: <span className="font-medium text-gray-900">{`(${data.publishedRule.testWeight} × الاختبارات + ${data.publishedRule.exam1Weight} × امتحان1 + ${data.publishedRule.exam2Weight} × امتحان2 + ${data.publishedRule.exam3Weight} × امتحان3) ÷ ${data.publishedRule.denominator}`}</span></div>
              {data.publishedRule.publishedAt && (
                <div>تاريخ النشر: <span className="font-medium text-gray-900">{new Date(data.publishedRule.publishedAt).toLocaleString("ar-MR")}</span></div>
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="font-semibold mb-3">آخر التغييرات</h2>
            <div className="space-y-3">
              {data.auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد تغييرات مسجلة بعد</p>
              ) : data.auditLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={log.entityType === "ASSESSMENT_OVERRIDE" ? "danger" : "info"}>{log.action}</Badge>
                    <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString("ar-MR")}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{log.description || `${log.entityType} - ${log.action}`}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

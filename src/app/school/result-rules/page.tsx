"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Input, Textarea, Badge, ConfirmModal } from "@/components/ui"
import { buildTermCalculationNote } from "@/lib/results"
import { getDateLocale } from "@/lib/locale"
import toast from "react-hot-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"

type ResultRule = {
  id: string
  name: string
  term1TestWeight: number
  term1ExamWeight: number
  term1Denominator: number
  term1RequireTest: boolean
  term1RequireExam: boolean
  term2TestWeight: number
  term2ExamWeight: number
  term2Denominator: number
  term2RequireTest: boolean
  term2RequireExam: boolean
  term3TestWeight: number
  term3ExamWeight: number
  term3Denominator: number
  term3RequireTest: boolean
  term3RequireExam: boolean
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
  term1TestWeight: string
  term1ExamWeight: string
  term1Denominator: string
  term1RequireTest: boolean
  term1RequireExam: boolean
  term2TestWeight: string
  term2ExamWeight: string
  term2Denominator: string
  term2RequireTest: boolean
  term2RequireExam: boolean
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
    term1TestWeight: String(rule.term1TestWeight),
    term1ExamWeight: String(rule.term1ExamWeight),
    term1Denominator: String(rule.term1Denominator),
    term1RequireTest: rule.term1RequireTest,
    term1RequireExam: rule.term1RequireExam,
    term2TestWeight: String(rule.term2TestWeight),
    term2ExamWeight: String(rule.term2ExamWeight),
    term2Denominator: String(rule.term2Denominator),
    term2RequireTest: rule.term2RequireTest,
    term2RequireExam: rule.term2RequireExam,
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

function buildRulePayload(form: RuleForm) {
  return {
    name: form.name,
    term1TestWeight: form.term1TestWeight,
    term1ExamWeight: form.term1ExamWeight,
    term1Denominator: form.term1Denominator,
    term1RequireTest: form.term1RequireTest,
    term1RequireExam: form.term1RequireExam,
    term2TestWeight: form.term2TestWeight,
    term2ExamWeight: form.term2ExamWeight,
    term2Denominator: form.term2Denominator,
    term2RequireTest: form.term2RequireTest,
    term2RequireExam: form.term2RequireExam,
    term3TestWeight: form.testWeight,
    term3ExamWeight: form.exam3Weight,
    term3Denominator: form.denominator,
    term3RequireTest: form.requireTest,
    term3RequireExam: form.requireExam3,
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
  }
}

function buildPreviewRule(form: RuleForm): ResultRule {
  return {
    id: "",
    name: form.name,
    term1TestWeight: Number(form.term1TestWeight),
    term1ExamWeight: Number(form.term1ExamWeight),
    term1Denominator: Number(form.term1Denominator),
    term1RequireTest: form.term1RequireTest,
    term1RequireExam: form.term1RequireExam,
    term2TestWeight: Number(form.term2TestWeight),
    term2ExamWeight: Number(form.term2ExamWeight),
    term2Denominator: Number(form.term2Denominator),
    term2RequireTest: form.term2RequireTest,
    term2RequireExam: form.term2RequireExam,
    term3TestWeight: Number(form.testWeight),
    term3ExamWeight: Number(form.exam3Weight),
    term3Denominator: Number(form.denominator),
    term3RequireTest: form.requireTest,
    term3RequireExam: form.requireExam3,
    testWeight: Number(form.testWeight),
    exam1Weight: Number(form.exam1Weight),
    exam2Weight: Number(form.exam2Weight),
    exam3Weight: Number(form.exam3Weight),
    denominator: Number(form.denominator),
    requireTest: form.requireTest,
    requireExam1: form.requireExam1,
    requireExam2: form.requireExam2,
    requireExam3: form.requireExam3,
    status: "DRAFT",
    version: 0,
    notes: form.notes,
    publishedAt: null,
  }
}

export default function SchoolResultRulesPage() {
  const router = useRouter()
  const user = useCurrentUser()
  const locale = useLocale()
  const t = useTranslations("resultRulesPage")
  const tCommon = useTranslations("common")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [data, setData] = useState<ResultRuleResponse | null>(null)
  const [form, setForm] = useState<RuleForm>({
    name: "",
    term1TestWeight: "3",
    term1ExamWeight: "1",
    term1Denominator: "4",
    term1RequireTest: true,
    term1RequireExam: true,
    term2TestWeight: "3",
    term2ExamWeight: "2",
    term2Denominator: "5",
    term2RequireTest: true,
    term2RequireExam: true,
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
  const [discardConfirm, setDiscardConfirm] = useState(false)

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
    if (!user.role) return
    if (user.role !== "SCHOOL_ADMIN") {
      router.replace("/school")
      return
    }

    loadData()
  }, [router, user.role])

  if (user.role && user.role !== "SCHOOL_ADMIN") {
    return <div className="min-h-[200px]" />
  }

  async function saveDraft() {
    setSaving(true)
    const { error } = await api.post("/api/school/result-rules", buildRulePayload(form))

    if (error) toast.error(error)
    else {
      toast.success(t("draftSaved"))
      await loadData()
    }
    setSaving(false)
  }

  async function publishDraft() {
    setPublishing(true)
    const { error } = await api.put("/api/school/result-rules", { action: "publish" })
    if (error) toast.error(error)
    else {
      toast.success(t("published"))
      await loadData()
    }
    setPublishing(false)
  }

  async function discardDraft() {
    const { error } = await api.delete("/api/school/result-rules")
    setDiscardConfirm(false)
    if (error) toast.error(error)
    else {
      toast.success(t("draftDeleted"))
      await loadData()
    }
  }

  if (loading || !data) {
    return (
      <Card>
        <p className="text-center text-gray-400 py-8">{t("loading")}</p>
      </Card>
    )
  }

  const previewRule = buildPreviewRule(form)
  const previewTerm1 = buildTermCalculationNote(previewRule, 1)
  const previewTerm2 = buildTermCalculationNote(previewRule, 2)
  const previewTerm3 = buildTermCalculationNote(previewRule, 3)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">{t("publishedVersion", { version: data.publishedRule.version })}</Badge>
          {data.draftRule && <Badge variant="warning">{t("hasDraft")}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card padding="lg" className="xl:col-span-2">
          <div className="space-y-4">
            <Input label={t("ruleName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                <p className="font-medium text-gray-900">{t("term12Title")}</p>
                <p className="mt-2 text-gray-600">
                  {t("term12Description")}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
                <p className="font-medium text-blue-900">{t("term3Title")}</p>
                <p className="mt-2 text-blue-800">
                  {t("term3Description")}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="font-medium text-amber-900">{t("workflowTitle")}</p>
                <p className="mt-2 text-amber-800">
                  {t("workflowDescription")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">{t("term1Title")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label={t("testWeight")} type="number" step="0.1" min="0" value={form.term1TestWeight} onChange={(e) => setForm({ ...form, term1TestWeight: e.target.value })} />
                  <Input label={t("term1ExamWeight")} type="number" step="0.1" min="0" value={form.term1ExamWeight} onChange={(e) => setForm({ ...form, term1ExamWeight: e.target.value })} />
                  <Input label={t("denominator")} type="number" step="0.1" min="0.1" value={form.term1Denominator} onChange={(e) => setForm({ ...form, term1Denominator: e.target.value })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.term1RequireTest} onChange={(e) => setForm({ ...form, term1RequireTest: e.target.checked })} />
                    {t("testRequired")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.term1RequireExam} onChange={(e) => setForm({ ...form, term1RequireExam: e.target.checked })} />
                    {t("exam1Required")}
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">{t("term2Title")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label={t("testWeight")} type="number" step="0.1" min="0" value={form.term2TestWeight} onChange={(e) => setForm({ ...form, term2TestWeight: e.target.value })} />
                  <Input label={t("term2ExamWeight")} type="number" step="0.1" min="0" value={form.term2ExamWeight} onChange={(e) => setForm({ ...form, term2ExamWeight: e.target.value })} />
                  <Input label={t("denominator")} type="number" step="0.1" min="0.1" value={form.term2Denominator} onChange={(e) => setForm({ ...form, term2Denominator: e.target.value })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.term2RequireTest} onChange={(e) => setForm({ ...form, term2RequireTest: e.target.checked })} />
                    {t("testRequired")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.term2RequireExam} onChange={(e) => setForm({ ...form, term2RequireExam: e.target.checked })} />
                    {t("exam2Required")}
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">{t("term3FinalTitle")}</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t("term3FinalDescription")}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Input label={t("testWeight")} type="number" step="0.1" min="0" value={form.testWeight} onChange={(e) => setForm({ ...form, testWeight: e.target.value })} />
                  <Input label={t("exam1Weight")} type="number" step="0.1" min="0" value={form.exam1Weight} onChange={(e) => setForm({ ...form, exam1Weight: e.target.value })} />
                  <Input label={t("exam2Weight")} type="number" step="0.1" min="0" value={form.exam2Weight} onChange={(e) => setForm({ ...form, exam2Weight: e.target.value })} />
                  <Input label={t("exam3Weight")} type="number" step="0.1" min="0" value={form.exam3Weight} onChange={(e) => setForm({ ...form, exam3Weight: e.target.value })} />
                  <Input label={t("denominator")} type="number" step="0.1" min="0.1" value={form.denominator} onChange={(e) => setForm({ ...form, denominator: e.target.value })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.requireTest} onChange={(e) => setForm({ ...form, requireTest: e.target.checked })} />
                    {t("testRequired")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.requireExam1} onChange={(e) => setForm({ ...form, requireExam1: e.target.checked })} />
                    {t("exam1Required")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.requireExam2} onChange={(e) => setForm({ ...form, requireExam2: e.target.checked })} />
                    {t("exam2Required")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.requireExam3} onChange={(e) => setForm({ ...form, requireExam3: e.target.checked })} />
                    {t("exam3Required")}
                  </label>
                </div>
              </div>
            </div>

            <Textarea label={t("notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("notesPlaceholder")} />

            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <div className="font-medium mb-1">{t("previewTitle")}</div>
              <div className="space-y-1">
                <div>{t("previewTerm1", { value: previewTerm1 })}</div>
                <div>{t("previewTerm2", { value: previewTerm2 })}</div>
                <div>{t("previewTerm3", { value: previewTerm3 })}</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button fullWidth loading={saving} onClick={saveDraft}>{t("saveDraft")}</Button>
              <Button variant="secondary" fullWidth loading={publishing} onClick={publishDraft} disabled={!data.draftRule}>{t("publishDraft")}</Button>
              <Button variant="danger" fullWidth onClick={() => setDiscardConfirm(true)} disabled={!data.draftRule}>{t("deleteDraft")}</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card padding="lg">
            <h2 className="font-semibold mb-3">{t("publishedRule")}</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div>{t("nameLabel")}: <span className="font-medium text-gray-900">{data.publishedRule.name}</span></div>
              <div>{t("versionLabel")}: <span className="font-medium text-gray-900">{data.publishedRule.version}</span></div>
              <div>{t("term1Title")}: <span className="font-medium text-gray-900">{buildTermCalculationNote(data.publishedRule, 1)}</span></div>
              <div>{t("term2Title")}: <span className="font-medium text-gray-900">{buildTermCalculationNote(data.publishedRule, 2)}</span></div>
              <div>{t("term3Title")}: <span className="font-medium text-gray-900">{buildTermCalculationNote(data.publishedRule, 3)}</span></div>
              {data.publishedRule.publishedAt && (
                <div>{t("publishedAt")}: <span className="font-medium text-gray-900">{new Date(data.publishedRule.publishedAt).toLocaleString(getDateLocale(locale))}</span></div>
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="font-semibold mb-3">{t("latestChanges")}</h2>
            <div className="space-y-3">
              {data.auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noLogs")}</p>
              ) : data.auditLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={log.entityType === "ASSESSMENT_OVERRIDE" ? "danger" : "info"}>{log.action}</Badge>
                    <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString(getDateLocale(locale))}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{log.description || `${log.entityType} - ${log.action}`}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={discardConfirm}
        onClose={() => setDiscardConfirm(false)}
        onConfirm={() => void discardDraft()}
        title={t("deleteDraftTitle")}
        message={t("deleteDraftMessage")}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </div>
  )
}

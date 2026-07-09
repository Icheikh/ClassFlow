"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Fragment } from "react"
import { api } from "@/lib/api"
import { Button, Card, Badge, Select } from "@/components/ui"
import { RESULT_PUBLICATION_STATUSES } from "@/lib/results"
import { CheckCircle2, ChevronDown, ChevronUp, Lock, Trophy, BarChart3, Printer, Info, ClipboardCheck } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type Classroom = {
  id: string
  name: string
  level: { name: string; stage: { name: string } }
  stream: { name: string } | null
}

type Term = {
  id: string
  name: string
  isActive: boolean
  academicYear: { name: string }
}

type ResultRow = {
  studentId: string
  studentName: string
  totalWeightedScore: number
  totalCoefficients: number
  average: number | null
  rank: number | null
  subjectResults: {
    subjectId: string
    subjectName: string
    testAverage: number | null
    exam1Average: number | null
    exam2Average: number | null
    exam3Average: number | null
    finalAverage: number | null
    coefficient: number
    weightedScore: number
  }[]
}

type ResultsResponse = {
  school: { id: string; name: string | null; address: string | null; phone: string | null }
  template: {
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
  }
  classroom: { id: string; name: string; level: { name: string; stage: { name: string } }; stream: { name: string } | null }
  term: { id: string; name: string }
  termCalculationNote: string
  termPolicyNote: string
  resultRule: { id: string; name: string; version: number; notes?: string | null }
  publicationStatus: string
  publication: { id: string; status: string; approvedAt: string | null; lockedAt: string | null } | null
  stats: { students: number; assessments: number; classAverage: number | null }
  readiness: {
    publishable: boolean
    studentsCount: number
    fullyComputedStudents: number
    assignedSubjectsCount: number
    readySubjectsCount: number
    missingCoefficientSubjects: { subjectId: string; subjectName: string }[]
    incompleteSubjects: {
      subjectId: string
      subjectName: string
      readyStudents: number
      studentsCount: number
      missingAssessmentTypes: string[]
    }[]
  }
  subjects: { id: string; nameAr: string }[]
  results: ResultRow[]
}

export default function SchoolResultsPage() {
  const searchParams = useSearchParams()
  const initialClassroomId = searchParams?.get("classroomId") || ""
  const initialTermId = searchParams?.get("termId") || ""

  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classroomId, setClassroomId] = useState(initialClassroomId)
  const [termId, setTermId] = useState(initialTermId)
  const [data, setData] = useState<ResultsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  useEffect(() => {
    async function loadMeta() {
      const [classroomsRes, termsRes] = await Promise.all([
        api.get<Classroom[]>("/api/school/classrooms"),
        api.get<Term[]>("/api/school/terms"),
      ])

      if (classroomsRes.data) {
        const nextClassrooms = classroomsRes.data
        setClassrooms(nextClassrooms)
        if (nextClassrooms[0]) {
          setClassroomId((current) => current || nextClassrooms[0].id)
        }
      }

      if (termsRes.data) {
        const nextTerms = termsRes.data
        setTerms(nextTerms)
        const activeTerm = nextTerms.find((term) => term.isActive)
        if (activeTerm) {
          setTermId((current) => current || activeTerm.id)
        }
      }

      setLoading(false)
    }

    loadMeta()
  }, [])

  useEffect(() => {
    async function loadResults() {
      if (!classroomId || !termId) return
      const { data: response, error } = await api.get<ResultsResponse>(`/api/school/results?classroomId=${classroomId}&termId=${termId}`)
      if (error) {
        toast.error(error)
        return
      }
      if (response) {
        setData(response)
        setExpandedStudentId(null)
      }
    }

    loadResults()
  }, [classroomId, termId])

  async function reloadResults(nextClassroomId = classroomId, nextTermId = termId) {
    if (!nextClassroomId || !nextTermId) return
    const { data: response, error } = await api.get<ResultsResponse>(`/api/school/results?classroomId=${nextClassroomId}&termId=${nextTermId}`)
    if (error) {
      toast.error(error)
      return
    }
    if (response) setData(response)
  }

async function updatePublicationStatus(status: string) {
    if (!classroomId || !termId) return
    setSaving(true)
    const { data, error } = await api.put<{ notificationCampaign?: { id: string; recipientsCount: number } | null }>("/api/school/results", { classroomId, termId, status })
    if (error) {
      toast.error(error)
    } else {
      if (status === RESULT_PUBLICATION_STATUSES.APPROVED && data?.notificationCampaign) {
        toast.success(`تم اعتماد النتائج وإنشاء حملة إشعار لعدد ${data.notificationCampaign.recipientsCount} مستلمين`)
      } else {
        toast.success(status === RESULT_PUBLICATION_STATUSES.LOCKED ? "تم قفل النتائج" : status === RESULT_PUBLICATION_STATUSES.APPROVED ? "تم اعتماد النتائج" : "تم فتح النتائج")
      }
      await reloadResults()
    }
    setSaving(false)
  }

  const subjectHeaders = useMemo(() => data?.subjects || [], [data])
  const hasComputedResults = (data?.results || []).some((row) => row.average != null)
  const canApproveOrLock = data?.readiness.publishable && hasComputedResults
  const computedStudents = data?.results.filter((row) => row.average != null) || []
  const topStudents = computedStudents.slice(0, 3)
  const publicationBadge = data?.publicationStatus === RESULT_PUBLICATION_STATUSES.LOCKED
    ? { label: "مقفول", variant: "danger" as const }
    : data?.publicationStatus === RESULT_PUBLICATION_STATUSES.APPROVED
      ? { label: "معتمد", variant: "success" as const }
      : { label: "مفتوح", variant: "info" as const }

  if (loading) {
    return (
      <Card>
        <p className="text-center text-gray-400 py-8">جاري التحميل...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">النتائج</h1>
          <p className="text-sm text-gray-500">مراجعة نتائج كل قسم حسب الفصل، ثم اعتمادها وقفلها بعد اكتمال الحسابات.</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <Badge variant={publicationBadge.variant}>{publicationBadge.label}</Badge>
          </div>
        )}
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="القسم"
            value={classroomId}
            onChange={setClassroomId}
            options={[
              { value: "", label: "اختر القسم" },
              ...classrooms.map((classroom) => ({
                value: classroom.id,
                label: `${classroom.name} - ${classroom.level.stage.name} - ${classroom.level.name}`,
              })),
            ]}
          />

          <Select
            label="الفصل"
            value={termId}
            onChange={setTermId}
            options={[
              { value: "", label: "اختر الفصل" },
              ...terms.map((term) => ({
                value: term.id,
                label: `${term.academicYear.name} - ${term.name}`,
              })),
            ]}
          />
        </div>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card padding="md">
              <div className="flex items-center gap-2 text-blue-700">
                <Info className="h-4 w-4" />
                <span className="text-sm font-medium">قاعدة الحساب الحالية</span>
              </div>
              <p className="mt-3 text-sm text-gray-700">{data.termCalculationNote}</p>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-2 text-amber-700">
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-sm font-medium">سياسة هذا الفصل</span>
              </div>
              <p className="mt-3 text-sm text-gray-700">{data.termPolicyNote}</p>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-2 text-purple-700">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">ماذا تعني الحالات؟</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                <p><span className="font-medium">مفتوح:</span> ما زالت المراجعة والتعديل ممكنة.</p>
                <p><span className="font-medium">معتمد:</span> النتائج صالحة ويمكن تجهيز نشرها.</p>
                <p><span className="font-medium">مقفول:</span> تم تثبيت النتائج ومنع تعديلها.</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Trophy className="h-5 w-5" />
                <span className="text-sm font-medium">معدل القسم</span>
              </div>
              <p className="text-2xl font-bold">{data.stats.classAverage != null ? data.stats.classAverage.toFixed(2) : "—"}</p>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm font-medium">عدد التقويمات</span>
              </div>
              <p className="text-2xl font-bold">{data.stats.assessments}</p>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <span className="text-sm font-medium">عدد التلاميذ</span>
              </div>
              <p className="text-2xl font-bold">{data.stats.students}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold text-lg">جاهزية المواد</h2>
                  <p className="text-sm text-gray-500">
                    يوضح هذا الجدول المواد الجاهزة للحساب والمواد التي ما زالت تنقصها تقويمات أو ضوارب.
                  </p>
                </div>
                <Badge variant={data.readiness.publishable ? "success" : "warning"}>
                  {data.readiness.readySubjectsCount}/{data.readiness.assignedSubjectsCount}
                </Badge>
              </div>

              {data.readiness.assignedSubjectsCount === 0 ? (
                <p className="py-8 text-center text-gray-400">لا توجد مواد مرتبطة بهذا القسم بعد.</p>
              ) : (
                <div className="space-y-3">
                  {subjectHeaders.map((subject) => {
                    const incomplete = data.readiness.incompleteSubjects.find((item) => item.subjectId === subject.id)
                    const missingCoefficient = data.readiness.missingCoefficientSubjects.some((item) => item.subjectId === subject.id)
                    const ready = !incomplete && !missingCoefficient

                    return (
                      <div key={subject.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">{subject.nameAr}</p>
                            <p className="mt-1 text-sm text-gray-500">
                              {ready
                                ? "المادة مكتملة ويمكن احتسابها لجميع التلاميذ."
                                : incomplete
                                  ? `${incomplete.readyStudents}/${incomplete.studentsCount} تلميذ مكتمل`
                                  : "ينقص تحديد الضارب لهذه المادة."}
                            </p>
                            {!ready && incomplete && incomplete.missingAssessmentTypes.length > 0 && (
                              <p className="mt-1 text-xs text-amber-700">
                                ينقص: {incomplete.missingAssessmentTypes.join("، ")}
                              </p>
                            )}
                          </div>
                          <Badge variant={ready ? "success" : "warning"}>
                            {ready ? "جاهزة" : "ناقصة"}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-4">
                <h2 className="font-semibold text-lg">ملخص القسم</h2>
                <p className="text-sm text-gray-500">
                  أفضل النتائج الحالية وعدد التلاميذ الذين اكتملت نتائجهم في هذا الفصل.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-700">مكتملون</p>
                  <p className="text-2xl font-bold text-blue-900">{data.readiness.fullyComputedStudents}</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-700">بانتظار الاستكمال</p>
                  <p className="text-2xl font-bold text-amber-900">{data.readiness.studentsCount - data.readiness.fullyComputedStudents}</p>
                </div>
              </div>

              {topStudents.length === 0 ? (
                <p className="py-6 text-center text-gray-400">لم تكتمل نتائج أي تلميذ بعد.</p>
              ) : (
                <div className="space-y-3">
                  {topStudents.map((row, index) => (
                    <div key={row.studentId} className="rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{row.studentName}</p>
                          <p className="text-sm text-gray-500">الرتبة الحالية: {row.rank || index + 1}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-400">المعدل</p>
                          <p className="text-xl font-bold text-blue-700">{row.average?.toFixed(2) || "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-lg">{data.classroom.name}</h2>
                <p className="text-sm text-gray-500">
                  {data.classroom.level.stage.name} - {data.classroom.level.name}
                  {data.classroom.stream ? ` - ${data.classroom.stream.name}` : ""}
                  {" · "}
                  {data.term.name}
                  {" · "}
                  {data.resultRule.name} (v{data.resultRule.version})
                </p>
                {data.template.showRuleNotes && (
                  <p className="mt-1 text-xs text-gray-400">{data.termCalculationNote}</p>
                )}
              </div>
            <div className="flex gap-2">
              <Link href={`/school/results/report?classroomId=${classroomId}&termId=${termId}`}>
                <Button variant="secondary">
                  <Printer className="h-4 w-4" /> طباعة كشف القسم
                </Button>
              </Link>
                <Button
                  variant="secondary"
                  loading={saving}
                  onClick={() => updatePublicationStatus(RESULT_PUBLICATION_STATUSES.OPEN)}
                  disabled={data.publicationStatus === RESULT_PUBLICATION_STATUSES.OPEN}
                >
                  فتح
                </Button>
                <Button
                  variant="secondary"
                  loading={saving}
                  onClick={() => updatePublicationStatus(RESULT_PUBLICATION_STATUSES.APPROVED)}
                  disabled={data.publicationStatus === RESULT_PUBLICATION_STATUSES.APPROVED || !canApproveOrLock}
                >
                  <CheckCircle2 className="h-4 w-4" /> اعتماد
                </Button>
                <Button
                  loading={saving}
                  onClick={() => updatePublicationStatus(RESULT_PUBLICATION_STATUSES.LOCKED)}
                  disabled={data.publicationStatus === RESULT_PUBLICATION_STATUSES.LOCKED || !canApproveOrLock || data.publicationStatus !== RESULT_PUBLICATION_STATUSES.APPROVED}
                >
                  <Lock className="h-4 w-4" /> قفل
                </Button>
              </div>
            </div>

            <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${data.readiness.publishable ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {data.readiness.publishable ? "النتائج مكتملة وقابلة للاعتماد" : "النتائج غير مكتملة بعد"}
                  </p>
                  <p className="mt-1">
                    المواد الجاهزة: {data.readiness.readySubjectsCount} من {data.readiness.assignedSubjectsCount}
                    {" · "}
                    التلاميذ المكتملون: {data.readiness.fullyComputedStudents} من {data.readiness.studentsCount}
                  </p>
                  <p className="mt-1">{data.termPolicyNote}</p>
                </div>
                <Badge variant={data.readiness.publishable ? "success" : "warning"}>
                  {data.readiness.publishable ? "جاهز للنشر" : "بانتظار الاستكمال"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <p className="text-xs opacity-70">الخطوة 1</p>
                  <p className="font-medium">إكمال التقويمات والضوارب</p>
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <p className="text-xs opacity-70">الخطوة 2</p>
                  <p className="font-medium">اعتماد النتائج</p>
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2">
                  <p className="text-xs opacity-70">الخطوة 3</p>
                  <p className="font-medium">قفل النتائج ثم طباعة الكشف</p>
                </div>
              </div>

              {!data.readiness.publishable && (
                <div className="mt-3 space-y-2">
                  {data.readiness.missingCoefficientSubjects.length > 0 && (
                    <p>
                      مواد بدون ضوارب: {data.readiness.missingCoefficientSubjects.map((item) => item.subjectName).join("، ")}
                    </p>
                  )}
                  {data.readiness.incompleteSubjects.slice(0, 4).map((subject) => (
                    <p key={subject.subjectId}>
                      {subject.subjectName}: {subject.readyStudents}/{subject.studentsCount} تلميذ مكتمل
                      {subject.missingAssessmentTypes.length > 0 ? ` · ينقص: ${subject.missingAssessmentTypes.join("، ")}` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {!hasComputedResults ? (
              <p className="text-center text-gray-400 py-8">لا توجد نتائج كافية لتوليد كشف هذا القسم بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      {data.template.showRank && <th className="text-right py-2 px-3">الرتبة</th>}
                      <th className="text-right py-2 px-3">التلميذ</th>
                      {subjectHeaders.map((subject) => (
                        <th key={subject.id} className="text-center py-2 px-3">{subject.nameAr}</th>
                      ))}
                      {data.template.showWeightedScore && <th className="text-center py-2 px-3">المجموع الموزون</th>}
                      <th className="text-center py-2 px-3">المعدل العام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row) => {
                      const isExpanded = expandedStudentId === row.studentId
                      const completedSubjects = row.subjectResults.filter((item) => item.finalAverage != null).length

                      return (
                        <Fragment key={row.studentId}>
                          <tr
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => setExpandedStudentId((current) => current === row.studentId ? null : row.studentId)}
                          >
                            {data.template.showRank && <td className="py-2 px-3 font-semibold">{row.rank ?? "—"}</td>}
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium">{row.studentName}</div>
                                  <div className="text-xs text-gray-400">
                                    مواد مكتملة: {completedSubjects}/{subjectHeaders.length}
                                  </div>
                                </div>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                              </div>
                            </td>
                            {subjectHeaders.map((subject) => {
                              const subjectResult = row.subjectResults.find((item) => item.subjectId === subject.id)
                              return (
                                <td key={subject.id} className="py-2 px-3 text-center">
                                  {subjectResult?.finalAverage != null ? (
                                    <div>
                                      <div className="font-medium">{subjectResult.finalAverage.toFixed(2)}</div>
                                      {data.template.showSubjectCoefficient && (
                                        <div className="text-xs text-gray-400">ض {subjectResult.coefficient}</div>
                                      )}
                                    </div>
                                  ) : "—"}
                                </td>
                              )
                            })}
                            {data.template.showWeightedScore && <td className="py-2 px-3 text-center">{row.totalWeightedScore.toFixed(2)}</td>}
                            <td className="py-2 px-3 text-center font-semibold text-blue-700">{row.average != null ? row.average.toFixed(2) : "—"}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b bg-gray-50/70">
                              <td colSpan={(data.template.showRank ? 1 : 0) + subjectHeaders.length + (data.template.showWeightedScore ? 1 : 0) + 2} className="px-4 py-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="font-semibold">تفاصيل حساب {row.studentName}</p>
                                      <p className="text-sm text-gray-500">{data.termCalculationNote}</p>
                                    </div>
                                    <Badge variant={row.average != null ? "success" : "warning"}>
                                      {row.average != null ? "النتيجة مكتملة" : "بانتظار الاستكمال"}
                                    </Badge>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b text-gray-500">
                                          <th className="px-3 py-2 text-right">المادة</th>
                                          <th className="px-3 py-2 text-center">الاختبارات</th>
                                          <th className="px-3 py-2 text-center">امتحان 1</th>
                                          <th className="px-3 py-2 text-center">امتحان 2</th>
                                          <th className="px-3 py-2 text-center">امتحان 3</th>
                                          <th className="px-3 py-2 text-center">ضارب المادة</th>
                                          <th className="px-3 py-2 text-center">معدل المادة</th>
                                          <th className="px-3 py-2 text-center">المجموع الموزون</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {subjectHeaders.map((subject) => {
                                          const subjectResult = row.subjectResults.find((item) => item.subjectId === subject.id)
                                          const missingState = subjectResult?.finalAverage == null

                                          return (
                                            <tr key={`${row.studentId}-${subject.id}`} className="border-b last:border-0">
                                              <td className="px-3 py-2 font-medium">{subject.nameAr}</td>
                                              <td className="px-3 py-2 text-center">{subjectResult?.testAverage?.toFixed(2) || "—"}</td>
                                              <td className="px-3 py-2 text-center">{subjectResult?.exam1Average?.toFixed(2) || "—"}</td>
                                              <td className="px-3 py-2 text-center">{subjectResult?.exam2Average?.toFixed(2) || "—"}</td>
                                              <td className="px-3 py-2 text-center">{subjectResult?.exam3Average?.toFixed(2) || "—"}</td>
                                              <td className="px-3 py-2 text-center">{subjectResult?.coefficient?.toFixed(2) || "—"}</td>
                                              <td className="px-3 py-2 text-center">
                                                {subjectResult?.finalAverage != null ? (
                                                  <span className="font-semibold text-blue-700">{subjectResult.finalAverage.toFixed(2)}</span>
                                                ) : (
                                                  <Badge variant="warning">ناقص</Badge>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                {!subjectResult || missingState ? "—" : subjectResult.weightedScore.toFixed(2)}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

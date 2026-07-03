"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Badge } from "@/components/ui"
import { RESULT_PUBLICATION_STATUSES } from "@/lib/results"
import { CheckCircle2, Lock, Trophy, BarChart3, Printer } from "lucide-react"
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
  }
  classroom: { id: string; name: string; level: { name: string; stage: { name: string } }; stream: { name: string } | null }
  term: { id: string; name: string }
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
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classroomId, setClassroomId] = useState("")
  const [termId, setTermId] = useState("")
  const [data, setData] = useState<ResultsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadMeta() {
      const [classroomsRes, termsRes] = await Promise.all([
        api.get<Classroom[]>("/api/school/classrooms"),
        api.get<Term[]>("/api/school/terms"),
      ])

      if (classroomsRes.data) {
        const nextClassrooms = classroomsRes.data
        setClassrooms(nextClassrooms)
        if (nextClassrooms[0]) setClassroomId((current) => current || nextClassrooms[0].id)
      }

      if (termsRes.data) {
        const nextTerms = termsRes.data
        setTerms(nextTerms)
        const activeTerm = nextTerms.find((term) => term.isActive)
        if (activeTerm) setTermId((current) => current || activeTerm.id)
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
      if (response) setData(response)
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
    const { error } = await api.put("/api/school/results", { classroomId, termId, status })
    if (error) {
      toast.error(error)
    } else {
      toast.success(status === RESULT_PUBLICATION_STATUSES.LOCKED ? "تم قفل النتائج" : status === RESULT_PUBLICATION_STATUSES.APPROVED ? "تم اعتماد النتائج" : "تم فتح النتائج")
      await reloadResults()
    }
    setSaving(false)
  }

  const subjectHeaders = useMemo(() => data?.subjects || [], [data])
  const hasComputedResults = (data?.results || []).some((row) => row.average != null)
  const canApproveOrLock = data?.readiness.publishable && hasComputedResults

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
          <p className="text-sm text-gray-500">مراجعة نتائج كل قسم حسب الفصل مع إمكانية الاعتماد والقفل</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                data.publicationStatus === RESULT_PUBLICATION_STATUSES.LOCKED
                  ? "danger"
                  : data.publicationStatus === RESULT_PUBLICATION_STATUSES.APPROVED
                    ? "success"
                    : "info"
              }
            >
              {data.publicationStatus === RESULT_PUBLICATION_STATUSES.LOCKED
                ? "مقفول"
                : data.publicationStatus === RESULT_PUBLICATION_STATUSES.APPROVED
                  ? "معتمد"
                  : "مفتوح"}
            </Badge>
          </div>
        )}
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">اختر القسم</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name} - {classroom.level.stage.name} - {classroom.level.name}
              </option>
            ))}
          </select>

          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">اختر الفصل</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.academicYear.name} - {term.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {data && (
        <>
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
                {data.template.showRuleNotes && data.resultRule.notes && (
                  <p className="mt-1 text-xs text-gray-400">{data.resultRule.notes}</p>
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
                </div>
                <Badge variant={data.readiness.publishable ? "success" : "warning"}>
                  {data.readiness.publishable ? "جاهز للنشر" : "بانتظار الاستكمال"}
                </Badge>
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
                    {data.results.map((row) => (
                      <tr key={row.studentId} className="border-b hover:bg-gray-50">
                        {data.template.showRank && <td className="py-2 px-3 font-semibold">{row.rank ?? "—"}</td>}
                        <td className="py-2 px-3">{row.studentName}</td>
                        {subjectHeaders.map((subject) => {
                          const subjectResult = row.subjectResults.find((item) => item.subjectId === subject.id)
                          return (
                            <td key={subject.id} className="py-2 px-3 text-center">
                              {subjectResult?.finalAverage != null ? (
                                <div>
                                  <div className="font-medium">{subjectResult.finalAverage.toFixed(2)}</div>
                                  <div className="text-xs text-gray-400">ض {subjectResult.coefficient}</div>
                                </div>
                              ) : "—"}
                            </td>
                          )
                        })}
                        {data.template.showWeightedScore && <td className="py-2 px-3 text-center">{row.totalWeightedScore.toFixed(2)}</td>}
                        <td className="py-2 px-3 text-center font-semibold text-blue-700">{row.average != null ? row.average.toFixed(2) : "—"}</td>
                      </tr>
                    ))}
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

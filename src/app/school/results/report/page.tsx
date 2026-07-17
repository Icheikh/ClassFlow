"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import toast from "react-hot-toast"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { api } from "@/lib/api"
import { RESULT_PUBLICATION_STATUSES } from "@/lib/results"

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
    finalAverage: number | null
    coefficient: number
  }[]
}

type ReportResponse = {
  school: { id: string; name: string | null; address: string | null; phone: string | null }
  template: {
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
  }
  classroom: { id: string; name: string; level: { name: string; stage: { name: string } }; stream: { name: string } | null }
  term: { id: string; name: string }
  termCalculationNote: string
  termPolicyNote: string
  resultRule: { id: string; name: string; version: number; notes?: string | null }
  publicationStatus: string
  publication: { id: string; status: string; approvedAt: string | null; lockedAt: string | null } | null
  stats: { students: number; assessments: number; classAverage: number | null }
  subjects: { id: string; nameAr: string }[]
  results: ResultRow[]
}

function getStatusLabel(status: string) {
  if (status === RESULT_PUBLICATION_STATUSES.LOCKED) return "مقفول"
  if (status === RESULT_PUBLICATION_STATUSES.APPROVED) return "معتمد"
  return "مفتوح"
}

function getStatusVariant(status: string) {
  if (status === RESULT_PUBLICATION_STATUSES.LOCKED) return "danger" as const
  if (status === RESULT_PUBLICATION_STATUSES.APPROVED) return "success" as const
  return "info" as const
}

export default function ResultsReportPage() {
  const searchParams = useSearchParams()
  const classroomId = searchParams?.get("classroomId") || ""
  const termId = searchParams?.get("termId") || ""
  const templateId = searchParams?.get("templateId") || ""
  const isPreview = searchParams?.get("preview") === "1"

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportResponse | null>(null)

  useEffect(() => {
    async function loadReport() {
      if (!classroomId || !termId) {
        setLoading(false)
        return
      }

      const query = new URLSearchParams({ classroomId, termId })
      if (templateId) query.set("templateId", templateId)
      const { data: response, error } = await api.get<ReportResponse>(`/api/school/results?${query.toString()}`)
      if (error) {
        toast.error(error)
      } else if (response) {
        setData(response)
      }
      setLoading(false)
    }

    void loadReport()
  }, [classroomId, termId, templateId])

  const subjectHeaders = useMemo(() => data?.subjects || [], [data])
  const hasComputedResults = (data?.results || []).some((row) => row.average != null)
  const visibleFooterSections = [
    data?.template.showNotesSection ? "notes" : null,
    data?.template.showSignatureSection ? "signature" : null,
  ].filter(Boolean).length

  if (loading) return <LoadingPage />

  if (!data) {
    return (
      <Card className="print:shadow-none print:border-0">
        <div className="py-12 text-center space-y-3" role="alert">
          <p className="text-lg font-semibold">تعذر تحميل كشف القسم</p>
          <Link href="/school/results">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" /> العودة إلى النتائج
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={isPreview ? "/school/settings" : "/school/results"}>
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> {isPreview ? "العودة إلى الإعدادات" : "العودة إلى النتائج"}
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> طباعة
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0 print:p-0">
        <div className="space-y-6 print:space-y-4">
          {isPreview && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              هذه معاينة مباشرة للقالب المختار قبل اعتماده على كشف النتائج النهائي.
            </div>
          )}
          <div className="border-b pb-4 print:pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{data.school.name || "المدرسة"}</h1>
                {data.template.showSchoolContacts && (data.school.address || data.school.phone) && (
                  <p className="mt-2 text-sm text-gray-500">
                    {data.school.address || "بدون عنوان"}
                    {data.school.phone ? ` · ${data.school.phone}` : ""}
                  </p>
                )}
              </div>
              <div className="text-left">
                <Badge variant={getStatusVariant(data.publicationStatus)}>
                  {getStatusLabel(data.publicationStatus)}
                </Badge>
                <p className="mt-2 text-sm text-gray-500">{data.template.title}</p>
                {data.template.subtitle && (
                  <p className="mt-1 text-xs text-gray-400">{data.template.subtitle}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">{data.template.classroomLabel}</p>
              <p className="font-semibold">{data.classroom.name}</p>
              <p className="text-sm text-gray-500">
                {data.classroom.level.stage.name} - {data.classroom.level.name}
                {data.classroom.stream ? ` - ${data.classroom.stream.name}` : ""}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">{data.template.termLabel}</p>
              <p className="font-semibold">{data.term.name}</p>
              <p className="text-sm text-gray-500">{data.resultRule.name} (v{data.resultRule.version})</p>
            </div>

            <div className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">{data.template.statsLabel}</p>
              <p className="font-semibold">{data.template.studentsCountLabel}: {data.stats.students}</p>
              <p className="text-sm text-gray-500">{data.template.classAverageLabel}: {data.stats.classAverage != null ? data.stats.classAverage.toFixed(2) : "—"}</p>
            </div>
          </div>

          {data.template.showRuleNotes && (
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {data.termCalculationNote}
            </div>
          )}

          {data.template.showPolicyNote && (
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {data.termPolicyNote}
            </div>
          )}

          {!hasComputedResults ? (
            <p className="py-12 text-center text-gray-400">لا توجد نتائج كافية لتوليد كشف هذا القسم بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    {data.template.showRank && <th className="px-3 py-2 text-right">الرتبة</th>}
                    <th className="px-3 py-2 text-right">التلميذ</th>
                    {subjectHeaders.map((subject) => (
                      <th key={subject.id} className="px-3 py-2 text-center">{subject.nameAr}</th>
                    ))}
                    {data.template.showWeightedScore && <th className="px-3 py-2 text-center">المجموع الموزون</th>}
                    <th className="px-3 py-2 text-center">المعدل العام</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((row) => (
                    <tr key={row.studentId} className="border-b">
                      {data.template.showRank && <td className="px-3 py-2 font-semibold">{row.rank ?? "—"}</td>}
                      <td className="px-3 py-2">{row.studentName}</td>
                      {subjectHeaders.map((subject) => {
                        const subjectResult = row.subjectResults.find((item) => item.subjectId === subject.id)
                        return (
                          <td key={subject.id} className="px-3 py-2 text-center">
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
                      {data.template.showWeightedScore && <td className="px-3 py-2 text-center">{row.totalWeightedScore.toFixed(2)}</td>}
                      <td className="px-3 py-2 text-center font-semibold text-blue-700">{row.average != null ? row.average.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.template.footerNote && (
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {data.template.footerNote}
            </div>
          )}

          {visibleFooterSections > 0 && (
            <div className={`grid gap-6 pt-8 text-sm text-gray-600 ${visibleFooterSections === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {data.template.showNotesSection && (
                <div className="space-y-3">
                  <p>{data.template.notesLabel}</p>
                  <div className="h-20 rounded-xl border border-dashed border-gray-300" />
                </div>
              )}
              {data.template.showSignatureSection && (
                <div className="space-y-3">
                  <p>{data.template.signatureLabel}</p>
                  <div className="h-20 rounded-xl border border-dashed border-gray-300" />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

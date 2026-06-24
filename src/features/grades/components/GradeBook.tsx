"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useClasses } from "@/hooks/useClasses"
import { useStudents } from "@/hooks/useStudents"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingSpinner } from "@/components/ui"
import { Plus, Save, Calculator, Eye, ChevronDown, ChevronUp } from "lucide-react"
import toast from "react-hot-toast"

type Assessment = {
  label: string
  type: string
  date: string
  scores: { studentId: string; studentName: string; score: number; maxScore: number; status: string }[]
}

type GradeData = {
  assessments: Assessment[]
  recent: { id: string; label: string; type: string; date: string; studentName: string; score: number; status: string }[]
}

const ASSESSMENT_TYPES = [
  { value: "TEST", label: "فرض" },
  { value: "EXAM", label: "امتحان" },
]

export function GradeBook() {
  const searchParams = useSearchParams()
  const { assignments, getSubjects, loading } = useClasses()

  const initialClassroom = searchParams.get("classroomId") || ""
  const initialSubject = searchParams.get("subjectId") || ""

  const [classroomId, setClassroomId] = useState(initialClassroom)
  const [subjectId, setSubjectId] = useState(initialSubject)
  const { students } = useStudents(classroomId)
  const [data, setData] = useState<GradeData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null)

  const [assessmentType, setAssessmentType] = useState("TEST")
  const [gradeLabel, setGradeLabel] = useState("")
  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (classroomId && subjectId) {
      api.get<GradeData>(`/api/grades?classroomId=${classroomId}&subjectId=${subjectId}`).then(({ data }) => {
        if (data) setData(data)
      })
    }
  }, [classroomId, subjectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gradeLabel.trim()) { toast.error("يرجى إدخال اسم التقويم"); return }
    const missing = students.filter((s) => !scores[s.id]?.trim())
    if (missing.length) { toast.error(`يرجى إدخال نتائج جميع التلاميذ (${missing.length} متبقي)`); return }

    setSaving(true)
    const result = await api.post("/api/grades", {
      scores: students.map((s) => ({ studentId: s.id, score: parseFloat(scores[s.id]) })),
      assessmentType, label: gradeLabel,
      classroomId, subjectId,
    })
    if (result.error) toast.error(result.error)
    else {
      toast.success("تم حفظ النتائج")
      setScores({}); setGradeLabel(""); setShowForm(false)
      api.get<GradeData>(`/api/grades?classroomId=${classroomId}&subjectId=${subjectId}`).then(({ data }) => { if (data) setData(data) })
    }
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const subjects = getSubjects(classroomId)
  const allScores = data?.assessments.flatMap((a) => a.scores.map((s) => s.score)) || []
  const overallAvg = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">دفتر النقاط</h1>
        {classroomId && subjectId && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-5 w-5" /> نتيجة جديدة
          </Button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <select value={classroomId} onChange={(v) => { setClassroomId(v); setSubjectId(""); setShowForm(false) }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
          <option value="">اختر القسم</option>
          {[...new Map(assignments.map((a) => [a.classroom.id, a.classroom])).entries()].map(([id, c]) => (
            <option key={id} value={id}>{c.name} - {(c as any).level?.name}</option>
          ))}
        </select>
        {classroomId && (
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">اختر المادة</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-2 text-blue-600 mb-1"><Calculator className="h-5 w-5" /><span className="text-sm font-medium">المعدل العام</span></div>
          <p className="text-2xl font-bold">{overallAvg || "—"}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-green-600 mb-1"><span className="text-sm font-medium">عدد التقويمات</span></div>
          <p className="text-2xl font-bold">{data?.assessments.length || 0}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-purple-600 mb-1"><span className="text-sm font-medium">آخر تقويم</span></div>
          <p className="text-lg font-bold truncate">{data?.assessments[0]?.label || "—"}</p>
        </Card>
      </div>

      {/* New Assessment Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6">
          <Card>
            <div className="space-y-4">
              <div className="flex gap-3">
                <select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}
                  className="w-40 px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="اسم التقويم (مثال: الفرض الأول)" value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between pb-2 border-b mb-2 text-sm font-medium text-gray-500">
                  <span>التلميذ</span><span>النقطة / 20</span>
                </div>
                {students.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">لا يوجد تلاميذ في هذا القسم</p>
                ) : (
                  students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2">
                      <span className="font-medium text-sm">{s.firstName} {s.lastName}</span>
                      <input type="number" step="0.25" min="0" max="20"
                        value={scores[s.id] || ""}
                        onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                        className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center" placeholder="0-20" />
                    </div>
                  ))
                )}
              </div>

              <Button fullWidth loading={saving} disabled={students.length === 0}><Save className="h-5 w-5" /> حفظ النتائج</Button>
            </div>
          </Card>
        </form>
      )}

      {/* Assessments List */}
      <div className="space-y-3">
        {!classroomId && !subjectId && (
          <Card><p className="text-center text-gray-400 py-6">اختر القسم والمادة لعرض النتائج</p></Card>
        )}
        {data?.assessments.length === 0 && classroomId && subjectId && !showForm && (
          <Card><p className="text-center text-gray-400 py-6">لا توجد نتائج مسجلة</p></Card>
        )}
        {data?.assessments.map((assessment) => {
          const isExpanded = expandedAssessment === assessment.label
          const avg = (assessment.scores.reduce((s, sc) => s + sc.score, 0) / assessment.scores.length).toFixed(2)
          return (
            <Card key={assessment.label}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedAssessment(isExpanded ? null : assessment.label)}>
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">{assessment.label}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Badge variant="default">{ASSESSMENT_TYPES.find(t => t.value === assessment.type)?.label || assessment.type}</Badge>
                      <span>{new Date(assessment.date).toLocaleDateString("ar-MR")}</span>
                      <span>المعدل: {avg}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{assessment.scores.length} تلميذ</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t">
                  <div className="divide-y">
                    {assessment.scores.map((sc) => (
                      <div key={sc.studentId} className="flex items-center justify-between py-2">
                        <span className="text-sm">{sc.studentName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{sc.score}</span>
                          <span className="text-xs text-gray-400">/ {sc.maxScore}</span>
                          <Badge variant={sc.status === "DRAFT" ? "warning" : "success"}>{sc.status === "DRAFT" ? "مسودة" : "مقبول"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

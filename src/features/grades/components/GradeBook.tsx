"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useClasses } from "@/hooks/useClasses"
import { useStudents } from "@/hooks/useStudents"
import { api } from "@/lib/api"
import { ASSESSMENT_TYPES, RESULT_PUBLICATION_STATUSES } from "@/lib/results"
import { Button, Card, Badge, LoadingSpinner, Input } from "@/components/ui"
import { Plus, Save, Calculator, ChevronDown, ChevronUp, Trash2, Edit2, Lock } from "lucide-react"
import toast from "react-hot-toast"

type Assessment = {
  id: string
  title: string
  type: string
  date: string
  maxScore: number
  status: string
  scores: { id: string; studentId: string; studentName: string; score: number; status: string }[]
}

type AssessmentRequirement = {
  type: string
  label: string
  required: boolean
  weight: number
  minimumCount: number
  count: number
  ready: boolean
}

type SubjectProgressRow = {
  studentId: string
  studentName: string
  testAverage: number | null
  exam1Average: number | null
  exam2Average: number | null
  exam3Average: number | null
  finalAverage: number | null
  ready: boolean
}

type GradeData = {
  term: { id: string; name: string; order: number }
  currentExamType: string | null
  currentExamLabel: string | null
  termCalculationNote: string
  termPolicyNote: string
  resultRule: { id: string; name: string; version: number }
  publicationStatus: string
  requiredAssessments: AssessmentRequirement[]
  subjectProgress: SubjectProgressRow[]
  assessments: Assessment[]
}

export function GradeBook() {
  const { data: session } = useSession()
  const user = session?.user as any
  const searchParams = useSearchParams()
  const { assignments, getSubjects, loading } = useClasses()

  const initialClassroom = searchParams?.get("classroomId") || ""
  const initialSubject = searchParams?.get("subjectId") || ""

  const [classroomId, setClassroomId] = useState(initialClassroom)
  const [subjectId, setSubjectId] = useState(initialSubject)
  const { students, loading: studentsLoading } = useStudents(classroomId)
  const [data, setData] = useState<GradeData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null)
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)

  const [assessmentType, setAssessmentType] = useState<string>(ASSESSMENT_TYPES.TEST)
  const [assessmentTitle, setAssessmentTitle] = useState("")
  const [maxScore, setMaxScore] = useState("20")
  const [assessmentDate, setAssessmentDate] = useState("")
  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const subjects = getSubjects(classroomId)
  const assessmentTypeOptions = data
    ? [
        { value: ASSESSMENT_TYPES.TEST, label: "الاختبارات" },
        ...(data.currentExamType && data.currentExamLabel
          ? [{ value: data.currentExamType, label: data.currentExamLabel }]
          : []),
      ]
    : [{ value: ASSESSMENT_TYPES.TEST, label: "الاختبارات" }]

  const classroomOptions = useMemo(
    () => [...new Map(assignments.map((assignment) => [assignment.classroom.id, assignment.classroom])).values()],
    [assignments]
  )

  useEffect(() => {
    async function loadData() {
      if (!classroomId || !subjectId) {
        setData(null)
        return
      }

      const { data: response, error } = await api.get<GradeData>(`/api/grades?classroomId=${classroomId}&subjectId=${subjectId}`)
      if (error) {
        toast.error(error)
        return
      }
      if (response) setData(response)
    }

    loadData()
  }, [classroomId, subjectId])

  async function reloadData(nextClassroomId = classroomId, nextSubjectId = subjectId) {
    if (!nextClassroomId || !nextSubjectId) {
      setData(null)
      return
    }

    const { data: response, error } = await api.get<GradeData>(`/api/grades?classroomId=${nextClassroomId}&subjectId=${nextSubjectId}`)
    if (error) {
      toast.error(error)
      return
    }
    if (response) setData(response)
  }

  function resetForm() {
    setEditingAssessment(null)
    setAssessmentType(ASSESSMENT_TYPES.TEST)
    setAssessmentTitle("")
    setMaxScore("20")
    setAssessmentDate("")
    setScores({})
  }

  function openCreateForm() {
    resetForm()
    setShowForm(true)
  }

  function openEditForm(assessment: Assessment) {
    setEditingAssessment(assessment)
    setAssessmentType(assessment.type)
    setAssessmentTitle(assessment.title)
    setMaxScore(String(assessment.maxScore))
    setAssessmentDate(new Date(assessment.date).toISOString().slice(0, 10))
    setScores(
      assessment.scores.reduce<Record<string, string>>((accumulator, score) => {
        accumulator[score.studentId] = String(score.score)
        return accumulator
      }, {})
    )
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!assessmentTitle.trim()) {
      toast.error("يرجى إدخال اسم التقويم")
      return
    }

    const missing = students.filter((student) => !scores[student.id]?.trim())
    if (missing.length) {
      toast.error(`يرجى إدخال نتائج جميع التلاميذ (${missing.length} متبقي)`)
      return
    }

    setSaving(true)
    const payload = {
      scores: students.map((student) => ({ studentId: student.id, score: parseFloat(scores[student.id]) })),
      assessmentType,
      title: assessmentTitle.trim(),
      classroomId,
      subjectId,
      maxScore,
      date: assessmentDate || undefined,
    }

    const result = editingAssessment
      ? await api.put("/api/grades", { id: editingAssessment.id, ...payload })
      : await api.post("/api/grades", payload)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(editingAssessment ? "تم تعديل التقويم" : "تم حفظ التقويم")
      resetForm()
      setShowForm(false)
      await reloadData()
    }
    setSaving(false)
  }

  async function deleteAssessment(assessment: Assessment) {
    if (!confirm(`سيتم حذف تقويم "${assessment.title}". هل أنت متأكد؟`)) return
    const { error } = await api.delete(`/api/grades?id=${assessment.id}`)
    if (error) toast.error(error)
    else {
      toast.success("تم الحذف")
      await reloadData()
    }
  }

  if (loading) return <LoadingSpinner />

  const allScores = data?.assessments.flatMap((assessment) => assessment.scores.map((score) => (score.score / assessment.maxScore) * 20)) || []
  const overallAvg = allScores.length ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(2) : null
  const isLocked = data?.publicationStatus === RESULT_PUBLICATION_STATUSES.LOCKED
  const canOverrideLockedResults = user?.role === "SCHOOL_ADMIN"
  const editingDisabled = isLocked && !canOverrideLockedResults
  const readyAverages = data?.subjectProgress.filter((row) => row.ready) || []
  const currentSubjectAverage = readyAverages.length
    ? (readyAverages.reduce((sum, row) => sum + (row.finalAverage || 0), 0) / readyAverages.length).toFixed(2)
    : null
  const missingRequirements = data?.requiredAssessments.filter((item) => item.required && !item.ready).length || 0
  const currentExamLabel = data?.currentExamLabel || "امتحان الفصل"

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">دفتر النقاط</h1>
          {data?.term && (
            <p className="text-sm text-gray-500 mt-1">
              الفصل الحالي: <span className="font-medium">{data.term.name}</span>
            </p>
          )}
        </div>
        {classroomId && subjectId && (
          <Button onClick={openCreateForm} disabled={editingDisabled || !data}>
            <Plus className="h-5 w-5" /> تقويم جديد
          </Button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <select
          value={classroomId}
          onChange={(e) => {
            setClassroomId(e.target.value)
            setSubjectId("")
            setShowForm(false)
            resetForm()
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">اختر القسم</option>
          {classroomOptions.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name} - {(classroom as any).level?.name}
            </option>
          ))}
        </select>

        {classroomId && (
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setShowForm(false)
              resetForm()
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">اختر المادة</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {data && (
        <div className="mb-6 flex items-center gap-3">
          <Badge variant={isLocked ? "danger" : data.publicationStatus === RESULT_PUBLICATION_STATUSES.APPROVED ? "success" : "info"}>
            {isLocked ? "النتائج مقفولة" : data.publicationStatus === RESULT_PUBLICATION_STATUSES.APPROVED ? "النتائج معتمدة" : "النتائج مفتوحة"}
          </Badge>
              <Badge variant="default">
                {data.resultRule.name} (v{data.resultRule.version})
              </Badge>
          {isLocked && !canOverrideLockedResults && (
            <span className="text-sm text-red-500 flex items-center gap-1">
              <Lock className="h-4 w-4" /> لا يمكن تعديل النقاط بعد القفل
            </span>
          )}
          {isLocked && canOverrideLockedResults && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <Lock className="h-4 w-4" /> النتائج مقفولة، لكن حساب المدير يمكنه التعديل مع تسجيل العملية في السجل
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Calculator className="h-5 w-5" />
            <span className="text-sm font-medium">متوسط النقاط المسجلة</span>
          </div>
          <p className="text-2xl font-bold">{overallAvg || "—"}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <span className="text-sm font-medium">معدل المادة الحالي</span>
          </div>
          <p className="text-2xl font-bold">{currentSubjectAverage || "—"}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <span className="text-sm font-medium">النواقص المطلوبة</span>
          </div>
          <p className="text-2xl font-bold">{missingRequirements}</p>
        </Card>
      </div>

      {data && classroomId && subjectId && (
        <Card className="mb-6">
          <div className="mb-4">
            <h3 className="font-semibold text-lg">حالة اكتمال المادة</h3>
            <p className="text-sm text-gray-500">
              {data.termPolicyNote}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {data.requiredAssessments.map((requirement) => (
              <div key={requirement.type} className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{requirement.label}</p>
                  <Badge variant={requirement.ready ? "success" : requirement.required ? "warning" : "default"}>
                    {requirement.ready ? "جاهز" : requirement.required ? "ناقص" : "اختياري"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-gray-500 space-y-1">
                  <p>الوزن: {requirement.weight}</p>
                  <p>الحد الأدنى: {requirement.minimumCount}</p>
                  <p>عدد التقويمات: {requirement.count}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showForm && data && (
        <form onSubmit={handleSubmit} className="mb-6">
          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {assessmentTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  placeholder="اسم التقويم"
                />
                <Input
                  type="number"
                  step="0.25"
                  min="1"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  placeholder="الدرجة القصوى"
                />
                <Input
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500">
                {data.termCalculationNote}. يجب تسجيل اختبار واحد على الأقل في هذا الفصل، ويمكن إضافة أكثر من اختبار ثم يحسب النظام معدل الاختبارات تلقائياً.
              </p>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between pb-2 border-b mb-2 text-sm font-medium text-gray-500">
                  <span>التلميذ</span>
                  <span>النقطة / {maxScore || 20}</span>
                </div>
                {studentsLoading ? (
                  <p className="text-center text-gray-400 py-4 text-sm">جاري تحميل التلاميذ...</p>
                ) : students.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">لا يوجد تلاميذ في هذا القسم</p>
                ) : (
                  students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between py-2">
                      <span className="font-medium text-sm">{student.firstName} {student.lastName}</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max={maxScore || "20"}
                        value={scores[student.id] || ""}
                        onChange={(e) => setScores({ ...scores, [student.id]: e.target.value })}
                        className="w-24 px-3 py-1.5 border rounded-lg text-sm text-center"
                        placeholder="0"
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="secondary" fullWidth onClick={() => { setShowForm(false); resetForm() }}>
                  إلغاء
                </Button>
                <Button fullWidth loading={saving} disabled={students.length === 0 || studentsLoading || editingDisabled}>
                  <Save className="h-5 w-5" /> {editingAssessment ? "حفظ التعديل" : "حفظ التقويم"}
                </Button>
              </div>
            </div>
          </Card>
        </form>
      )}

      <div className="space-y-3">
        {!classroomId && !subjectId && (
          <Card>
            <p className="text-center text-gray-400 py-6">اختر القسم والمادة لعرض دفتر النقاط</p>
          </Card>
        )}
        {data?.assessments.length === 0 && classroomId && subjectId && !showForm && (
          <Card>
            <p className="text-center text-gray-400 py-6">لا توجد تقويمات مسجلة</p>
          </Card>
        )}
        {data?.assessments.map((assessment) => {
          const isExpanded = expandedAssessment === assessment.id
          const avg = assessment.scores.length
            ? (
                assessment.scores.reduce((sum, score) => sum + (score.score / assessment.maxScore) * 20, 0) /
                assessment.scores.length
              ).toFixed(2)
            : "0.00"

          return (
            <Card key={assessment.id}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedAssessment(isExpanded ? null : assessment.id)}
              >
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">{assessment.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Badge variant="default">
                        {assessmentTypeOptions.find((type) => type.value === assessment.type)?.label || assessment.type}
                      </Badge>
                      <span>{new Date(assessment.date).toLocaleDateString("ar-MR")}</span>
                      <span>المعدل: {avg}</span>
                      <span>على {assessment.maxScore}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{assessment.scores.length} تلميذ</span>
                  {!editingDisabled && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditForm(assessment)
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-blue-500"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteAssessment(assessment)
                        }}
                        className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t">
                  <div className="divide-y">
                    {assessment.scores.map((score) => (
                      <div key={score.id} className="flex items-center justify-between py-2">
                        <span className="text-sm">{score.studentName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{score.score}</span>
                          <span className="text-xs text-gray-400">/ {assessment.maxScore}</span>
                          <Badge variant={score.status === "DRAFT" ? "warning" : "success"}>
                            {score.status === "DRAFT" ? "مسودة" : "معتمد"}
                          </Badge>
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

      {data && classroomId && subjectId && (
        <Card className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">التقدم الحالي لكل تلميذ في المادة</h3>
              <p className="text-sm text-gray-500">
                يظهر هنا المتوسط الحالي لكل عنصر، ثم معدل المادة النهائي عندما تكتمل العناصر المطلوبة.
              </p>
            </div>
            <Badge variant={missingRequirements === 0 ? "success" : "warning"}>
              {missingRequirements === 0 ? "المادة قابلة للحساب" : "المادة لم تكتمل بعد"}
            </Badge>
          </div>

          {data.subjectProgress.length === 0 ? (
            <p className="py-6 text-center text-gray-400">لا توجد بيانات كافية لعرض تقدم المادة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="px-3 py-2 text-right">التلميذ</th>
                    <th className="px-3 py-2 text-center">الاختبارات</th>
                    <th className="px-3 py-2 text-center">{currentExamLabel}</th>
                    <th className="px-3 py-2 text-center">معدل المادة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjectProgress.map((row) => (
                    <tr key={row.studentId} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{row.studentName}</td>
                      <td className="px-3 py-2 text-center">{row.testAverage?.toFixed(2) || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {data.currentExamType === ASSESSMENT_TYPES.EXAM_1
                          ? row.exam1Average?.toFixed(2) || "—"
                          : data.currentExamType === ASSESSMENT_TYPES.EXAM_2
                            ? row.exam2Average?.toFixed(2) || "—"
                            : row.exam3Average?.toFixed(2) || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.finalAverage != null ? (
                          <span className="font-semibold text-blue-700">{row.finalAverage.toFixed(2)}</span>
                        ) : (
                          <Badge variant="warning">بانتظار الاكتمال</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

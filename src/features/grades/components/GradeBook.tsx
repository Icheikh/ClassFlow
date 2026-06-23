import { useState, useEffect } from "react"
import { useClasses } from "@/hooks/useClasses"
import { useStudents } from "@/hooks/useStudents"
import { gradesApi, type GradeRecord } from "@/lib/api"
import { Button, Card, Select, Input, Badge, LoadingSpinner } from "@/components/ui"
import { Plus, Save, Calculator } from "lucide-react"
import toast from "react-hot-toast"

const ASSESSMENT_TYPES = [
  { value: "TEST", label: "فرض" },
  { value: "EXAM", label: "امتحان" },
]

export function GradeBook() {
  const { classrooms, getSubjects, loading } = useClasses()
  const [classroomId, setClassroomId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const { students } = useStudents(classroomId)
  const [grades, setGrades] = useState<GradeRecord[]>([])
  const [showForm, setShowForm] = useState(false)

  const [assessmentType, setAssessmentType] = useState("TEST")
  const [gradeLabel, setGradeLabel] = useState("")
  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (classroomId && subjectId) {
      gradesApi.list(classroomId, subjectId).then(({ data }) => {
        if (data) setGrades(data)
      })
    }
  }, [classroomId, subjectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gradeLabel.trim()) { toast.error("يرجى إدخال اسم التقويم"); return }
    const missing = students.filter((s) => !scores[s.id]?.trim())
    if (missing.length) { toast.error("يرجى إدخال نتائج جميع التلاميذ"); return }

    setSaving(true)
    const result = await gradesApi.save({
      scores: students.map((s) => ({ studentId: s.id, score: parseFloat(scores[s.id]) })),
      assessmentType, label: gradeLabel,
      classroomId, subjectId, termId: "",
    })
    if (result.error) toast.error(result.error)
    else {
      toast.success("تم حفظ النتائج")
      setScores({}); setGradeLabel(""); setShowForm(false)
      gradesApi.list(classroomId, subjectId).then(({ data }) => { if (data) setGrades(data) })
    }
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const avg = grades.length
    ? (grades.reduce((s, g) => s + g.score, 0) / grades.length).toFixed(2)
    : null

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
        <Select value={classroomId} onChange={(v) => { setClassroomId(v); setSubjectId("") }}
          options={classrooms.map((c) => ({ value: c.id, label: c.name }))} placeholder="اختر القسم" />
        {classroomId && (
          <Select value={subjectId} onChange={setSubjectId}
            options={getSubjects(classroomId).map((s) => ({ value: s.id, label: s.name }))} placeholder="اختر المادة" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-2 text-blue-600 mb-1"><Calculator className="h-5 w-5" /><span className="text-sm font-medium">المعدل</span></div>
          <p className="text-2xl font-bold">{avg || "—"}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-green-600 mb-1"><span className="text-sm font-medium">عدد النتائج</span></div>
          <p className="text-2xl font-bold">{grades.length}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-purple-600 mb-1"><span className="text-sm font-medium">آخر تقويم</span></div>
          <p className="text-lg font-bold">{grades[0]?.label || "—"}</p>
        </Card>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6">
          <Card>
            <div className="space-y-4">
              <Select value={assessmentType} onChange={setAssessmentType}
                options={ASSESSMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} label="نوع التقويم" />
              <Input label="اسم التقويم" value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} placeholder="مثال: الفرض الأول" />

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between pb-2 border-b mb-2 text-sm font-medium text-gray-500">
                  <span>التلميذ</span><span>النقطة / 20</span>
                </div>
                {students.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2">
                    <span className="font-medium text-sm">{s.firstName} {s.lastName}</span>
                    <input type="number" step="0.25" min="0" max="20"
                      value={scores[s.id] || ""}
                      onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                      className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center" placeholder="0-20" />
                  </div>
                ))}
              </div>

              <Button fullWidth loading={saving}><Save className="h-5 w-5" /> حفظ النتائج</Button>
            </div>
          </Card>
        </form>
      )}

      <Card padding="sm">
        <div className="divide-y">
          {grades.length === 0 ? (
            <p className="text-center text-gray-400 py-4">لا توجد نتائج مسجلة</p>
          ) : grades.slice(0, 20).map((g, i) => (
            <div key={g.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{i + 1}</span>
                <span className="font-medium">{g.label}</span>
                <Badge variant="default">{ASSESSMENT_TYPES.find(t => t.value === g.assessmentType)?.label}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{new Date(g.date).toLocaleDateString("ar-MR")}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
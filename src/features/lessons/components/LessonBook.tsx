import { useState, useEffect } from "react"
import { useClasses } from "@/hooks/useClasses"
import { lessonsApi, type Lesson } from "@/lib/api"
import { Button, Card, Select, Input, Textarea, LoadingSpinner } from "@/components/ui"
import { BookOpen, Plus, Save } from "lucide-react"
import toast from "react-hot-toast"

export function LessonBook() {
  const { classrooms, getSubjects, loading } = useClasses()
  const [classroomId, setClassroomId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [homework, setHomework] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (classroomId && subjectId) {
      lessonsApi.list(classroomId, subjectId).then(({ data }) => {
        if (data) setLessons(data)
      })
    }
  }, [classroomId, subjectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error("يرجى إدخال عنوان الدرس"); return }
    setSaving(true)
    const result = await lessonsApi.create({ title, description, homework, notes, classroomId, subjectId })
    if (result.error) toast.error(result.error)
    else {
      toast.success("تم تسجيل الدرس")
      setTitle(""); setDescription(""); setHomework(""); setNotes("")
      setShowForm(false)
      lessonsApi.list(classroomId, subjectId).then(({ data }) => { if (data) setLessons(data) })
    }
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">دفتر الدروس</h1>
        {classroomId && subjectId && (
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-5 w-5" /> درس جديد
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

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6">
          <Card>
            <div className="space-y-4">
              <Input label="عنوان الدرس" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="أدخل عنوان الدرس" />
              <Textarea label="شرح الدرس" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="وصف الدرس..." />
              <Textarea label="الواجب المنزلي" value={homework} onChange={(e) => setHomework(e.target.value)} rows={2} placeholder="الواجبات..." />
              <Textarea label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
              <Button fullWidth loading={saving}><Save className="h-5 w-5" /> حفظ الدرس</Button>
            </div>
          </Card>
        </form>
      )}

      <div className="space-y-3">
        {!classroomId && !subjectId && (
          <Card><p className="text-center text-gray-400">اختر القسم والمادة لعرض الدروس</p></Card>
        )}
        {lessons.length === 0 && classroomId && subjectId && !showForm && (
          <Card><p className="text-center text-gray-400">لا توجد دروس مسجلة</p></Card>
        )}
        {lessons.map((lesson) => (
          <Card key={lesson.id}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">{lesson.title}</h3>
              </div>
              <span className="text-sm text-gray-500">{new Date(lesson.date).toLocaleDateString("ar-MR")}</span>
            </div>
            {lesson.description && <p className="text-sm text-gray-600 mb-2">{lesson.description}</p>}
            {lesson.homework && (
              <div className="bg-yellow-50 p-2 rounded text-sm mb-1">
                <span className="font-medium">الواجب: </span>{lesson.homework}
              </div>
            )}
            <div className="flex gap-2 text-xs text-gray-400">
              <span>{lesson.classroom.name}</span><span>·</span><span>{lesson.subject.nameAr}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
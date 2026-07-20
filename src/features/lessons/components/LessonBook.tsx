"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useClasses } from "@/hooks/useClasses"
import { api } from "@/lib/api"
import { Button, Card, LoadingSpinner, ConfirmModal, ErrorDisplay, TeacherSubNav } from "@/components/ui"
import { BookOpen, Plus, Save, Clock, Edit3, Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"

type Lesson = {
  id: string
  title: string
  description: string | null
  homework: string | null
  notes: string | null
  duration: number | null
  status: string
  date: string
  classroom: { id: string; name: string }
  subject: { id: string; nameAr: string; nameFr: string | null }
}

export function LessonBook() {
  const locale = useLocale()
  const t = useTranslations("lessonBook")
  const tCommon = useTranslations("common")
  const searchParams = useSearchParams()
  const { assignments, loading } = useClasses()

  const initialClassroom = searchParams?.get("classroomId") || ""
  const initialSubject = searchParams?.get("subjectId") || ""

  const [classroomId, setClassroomId] = useState(initialClassroom)
  const [subjectId, setSubjectId] = useState(initialSubject)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [homework, setHomework] = useState("")
  const [notes, setNotes] = useState("")
  const [duration, setDuration] = useState("45")
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [retryTrigger, setRetryTrigger] = useState(0)

  useEffect(() => {
    if (!classroomId || !subjectId) return
    setFetchError(false)
    api.get<Lesson[]>(`/api/lessons?classroomId=${classroomId}&subjectId=${subjectId}`)
      .then(({ data, error }) => {
        if (error) { toast.error(error); setFetchError(true); return }
        if (data) setLessons(data)
      })
      .catch(() => { toast.error(t("loadError")); setFetchError(true) })
  }, [classroomId, subjectId, retryTrigger, t])

  function startEdit(lesson: Lesson) {
    setEditId(lesson.id)
    setTitle(lesson.title)
    setDescription(lesson.description || "")
    setHomework(lesson.homework || "")
    setNotes(lesson.notes || "")
    setDuration(String(lesson.duration || 45))
    setShowForm(true)
  }

  function resetForm() {
    setTitle(""); setDescription(""); setHomework(""); setNotes(""); setDuration("45")
    setEditId(null); setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error(t("missingTitle")); return }
    setSaving(true)
    try {
      const payload = { title, description, homework, notes, duration: parseInt(duration) || 45, classroomId, subjectId }
      const result = editId
        ? await api.put("/api/lessons", { id: editId, ...payload })
        : await api.post("/api/lessons", payload)

      if (result.error) toast.error(result.error)
      else {
        toast.success(editId ? t("editSuccess") : t("createSuccess"))
        resetForm()
        api.get<Lesson[]>(`/api/lessons?classroomId=${classroomId}&subjectId=${subjectId}`).then(({ data }) => { if (data) setLessons(data) })
      }
    } catch { toast.error(t("saveError")) }
    setSaving(false)
  }

  async function handleConfirmDelete() {
    if (!lessonToDelete) return
    try {
      const { error } = await api.delete(`/api/lessons?id=${lessonToDelete}`)
      setLessonToDelete(null)
      if (error) toast.error(error)
      else {
        toast.success(t("deleteSuccess"))
        api.get<Lesson[]>(`/api/lessons?classroomId=${classroomId}&subjectId=${subjectId}`).then(({ data }) => { if (data) setLessons(data) })
      }
    } catch { toast.error(t("deleteError")); setLessonToDelete(null) }
  }

  if (loading) return <LoadingSpinner />

  const subjects = assignments
    .filter((assignment) => assignment.classroomId === classroomId)
    .map((assignment) => ({
      id: assignment.subjectId,
      name: getLocalizedSubjectName(assignment.subject, locale),
    }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {classroomId && subjectId && (
          <Button variant="primary" onClick={() => { resetForm(); setShowForm(!showForm) }}>
            <Plus className="h-5 w-5" /> {showForm ? tCommon("cancel") : t("newToggle")}
          </Button>
        )}
      </div>

      <TeacherSubNav current="lessons" classroomId={classroomId} subjectId={subjectId} />

      <div className="flex gap-4 mb-6">
        <select value={classroomId} onChange={(e) => { setClassroomId(e.target.value); setSubjectId(""); setShowForm(false) }}
          className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
          <option value="">{t("selectClassroom")}</option>
          {[...new Map(assignments.map((a) => [a.classroom.id, a.classroom])).entries()].map(([id, c]) => (
            <option key={id} value={id}>{c.name} - {(c as any).level?.name}</option>
          ))}
        </select>
        {classroomId && (
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
            className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
            <option value="">{t("selectSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6">
          <Card>
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">{editId ? t("editLesson") : t("newLesson")}</p>
              <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("lessonTitlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("descriptionPlaceholder")} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <textarea className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("homeworkPlaceholder")} rows={2} value={homework} onChange={(e) => setHomework(e.target.value)} />
              <textarea className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("notesPlaceholder")} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <input type="number" className={`w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("durationPlaceholder")} value={duration} onChange={(e) => setDuration(e.target.value)} min="1" max="180" />
                <span className="text-sm text-gray-500">{t("minutes")}</span>
              </div>
              <div className="flex gap-2">
                <Button fullWidth loading={saving}><Save className="h-5 w-5" /> {editId ? t("saveChanges") : t("saveLesson")}</Button>
                <Button variant="secondary" onClick={resetForm}>{tCommon("cancel")}</Button>
              </div>
            </div>
          </Card>
        </form>
      )}

      <div className="space-y-3">
        {!classroomId && !subjectId && (
          <Card><p className="py-6 text-center text-gray-400">{t("chooseContext")}</p></Card>
        )}
        {fetchError && (
          <Card>
            <ErrorDisplay message={t("recordLoadError")} onRetry={() => setRetryTrigger(n => n + 1)} />
          </Card>
        )}
        {lessons.length === 0 && classroomId && subjectId && !showForm && !fetchError && (
          <Card><p className="py-6 text-center text-gray-400">{t("emptyState")}</p></Card>
        )}
        {lessons.map((lesson) => (
          <Card key={lesson.id}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">{lesson.title}</h3>
                {lesson.duration && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {lesson.duration} {locale === "ar" ? "د" : "min"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{new Date(lesson.date).toLocaleDateString(getDateLocale(locale))}</span>
                <span className={`px-2 py-0.5 rounded-full ${lesson.status === "DRAFT" ? "bg-yellow-50 text-yellow-600" : "bg-green-50 text-green-600"}`}>
                  {lesson.status === "DRAFT" ? t("draft") : t("submitted")}
                </span>
              </div>
            </div>
            {lesson.description && <p className="text-sm text-gray-600 mb-2">{lesson.description}</p>}
            {lesson.homework && (
              <div className="bg-yellow-50 p-2 rounded text-sm mb-1">
                <span className="font-medium">{t("homeworkLabel")} </span>{lesson.homework}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-2 text-xs text-gray-400">
                <span>{lesson.classroom.name}</span><span>·</span><span>{getLocalizedSubjectName(lesson.subject, locale)}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(lesson)} className="p-1 hover:bg-gray-100 rounded text-blue-500" aria-label={t("editAria")}>
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => setLessonToDelete(lesson.id)} className="p-1 hover:bg-gray-100 rounded text-red-500" aria-label={t("deleteAria")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmModal
        open={!!lessonToDelete}
        onClose={() => setLessonToDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmText={t("deleteConfirm")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </div>
  )
}

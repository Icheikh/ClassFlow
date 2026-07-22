"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Button, Card, ConfirmModal, ErrorDisplay, LoadingSpinner, TeacherSubNav } from "@/components/ui"
import { BookOpen, Calendar, Clock, Edit3, Plus, Save, Trash2 } from "lucide-react"
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
  schedule?: { id: string; startTime: string; endTime: string } | null
}

type ScheduleEntry = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  classroomId: string
  subjectId: string
  teacherId: string | null
  classroom: { id: string; name: string; level: { name: string }; stream?: { name: string } | null }
  subject: { id: string; nameAr: string; nameFr?: string | null }
}

type TeacherInfo = { id: string }

function getDateDayOfWeek(date: string) {
  return new Date(`${date}T12:00:00`).getDay()
}

export function LessonBook() {
  const locale = useLocale()
  const t = useTranslations("lessonBook")
  const tCommon = useTranslations("common")
  const searchParams = useSearchParams()

  const initialClassroom = searchParams?.get("classroomId") || ""
  const initialSubject = searchParams?.get("subjectId") || ""

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState("")
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [loadingLessons, setLoadingLessons] = useState(false)
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

  const selectedSchedule = scheduleEntries.find((entry) => entry.id === selectedScheduleId) || null
  const daySchedule = useMemo(() => {
    const dayOfWeek = getDateDayOfWeek(selectedDate)
    return scheduleEntries
      .filter((entry) => entry.dayOfWeek === dayOfWeek)
      .sort((first, second) => first.startTime.localeCompare(second.startTime))
  }, [scheduleEntries, selectedDate])

  useEffect(() => {
    let cancelled = false

    async function loadSchedule() {
      setLoadingSchedule(true)
      const teacherRes = await api.get<TeacherInfo>("/api/teacher/me")
      if (!teacherRes.data) {
        if (!cancelled) {
          toast.error(teacherRes.error || t("loadTeacherError"))
          setLoadingSchedule(false)
        }
        return
      }

      const scheduleRes = await api.get<ScheduleEntry[]>(`/api/school/schedules?teacherId=${teacherRes.data.id}`)
      if (cancelled) return

      if (scheduleRes.error) {
        toast.error(scheduleRes.error || t("loadScheduleError"))
        setFetchError(true)
      } else {
        setScheduleEntries(scheduleRes.data || [])
      }
      setLoadingSchedule(false)
    }

    void loadSchedule()
    return () => { cancelled = true }
  }, [t])

  useEffect(() => {
    if (daySchedule.length === 0) {
      setSelectedScheduleId("")
      return
    }

    const currentSelectionStillVisible = daySchedule.some((entry) => entry.id === selectedScheduleId)
    if (currentSelectionStillVisible) return

    const initialMatch = daySchedule.find(
      (entry) => entry.classroomId === initialClassroom && entry.subjectId === initialSubject
    )
    setSelectedScheduleId((initialMatch || daySchedule[0]).id)
  }, [daySchedule, initialClassroom, initialSubject, selectedScheduleId])

  useEffect(() => {
    if (!selectedSchedule) {
      setLessons([])
      return
    }

    let cancelled = false
    setLoadingLessons(true)
    setFetchError(false)
    api.get<Lesson[]>(`/api/lessons?scheduleId=${selectedSchedule.id}&date=${selectedDate}`)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          toast.error(error)
          setFetchError(true)
          return
        }
        setLessons(data || [])
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("loadError"))
          setFetchError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLessons(false)
      })

    return () => { cancelled = true }
  }, [selectedSchedule, selectedDate, retryTrigger, t])

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

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
    setTitle("")
    setDescription("")
    setHomework("")
    setNotes("")
    setDuration("45")
    setEditId(null)
    setShowForm(false)
  }

  async function reloadLessons() {
    setRetryTrigger((current) => current + 1)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedSchedule) {
      toast.error(t("missingSession"))
      return
    }
    if (!title.trim()) {
      toast.error(t("missingTitle"))
      return
    }

    setSaving(true)
    try {
      const payload = {
        title,
        description,
        homework,
        notes,
        duration: parseInt(duration) || 45,
        date: selectedDate,
        scheduleId: selectedSchedule.id,
        classroomId: selectedSchedule.classroomId,
        subjectId: selectedSchedule.subjectId,
      }
      const result = editId
        ? await api.put("/api/lessons", { id: editId, ...payload })
        : await api.post("/api/lessons", payload)

      if (result.error) toast.error(result.error)
      else {
        toast.success(editId ? t("editSuccess") : t("createSuccess"))
        resetForm()
        await reloadLessons()
      }
    } catch {
      toast.error(t("saveError"))
    }
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
        await reloadLessons()
      }
    } catch {
      toast.error(t("deleteError"))
      setLessonToDelete(null)
    }
  }

  if (loadingSchedule) return <LoadingSpinner message={tCommon("loading")} />

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("scheduleBasedSubtitle")}</p>
          </div>
          {selectedSchedule && (
            <Button onClick={startCreate}>
              <Plus className="h-5 w-5" /> {showForm ? tCommon("cancel") : t("newToggle")}
            </Button>
          )}
        </div>

        <TeacherSubNav
          current="lessons"
          classroomId={selectedSchedule?.classroomId || initialClassroom}
          subjectId={selectedSchedule?.subjectId || initialSubject}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4 text-blue-600" />
            {t("lessonDate")}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <Card padding="md" className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{t("todaySessions")}</h2>
            <p className="mt-1 text-xs text-gray-500">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(getDateLocale(locale))}</p>
          </div>
          <Badge variant={daySchedule.length ? "info" : "default"}>{daySchedule.length}</Badge>
        </div>

        {daySchedule.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <Clock className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">{t("noSessionsForDate")}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {daySchedule.map((entry) => {
              const selected = entry.id === selectedScheduleId
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    resetForm()
                    setSelectedScheduleId(entry.id)
                  }}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    selected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-950">{getLocalizedSubjectName(entry.subject, locale)}</p>
                      <p className="mt-1 text-sm text-gray-600">{entry.classroom.name}</p>
                      <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        {entry.startTime} - {entry.endTime}
                      </p>
                    </div>
                    {selected && <Badge variant="info">{t("selectedSession")}</Badge>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {selectedSchedule && showForm && (
        <form onSubmit={handleSubmit} className="mb-5">
          <Card padding="md">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900">{editId ? t("editLesson") : t("newLesson")}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("sessionSummary", {
                    classroom: selectedSchedule.classroom.name,
                    subject: getLocalizedSubjectName(selectedSchedule.subject, locale),
                    start: selectedSchedule.startTime,
                    end: selectedSchedule.endTime,
                  })}
                </p>
              </div>

              <input className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("lessonTitlePlaceholder")} value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("descriptionPlaceholder")} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
              <textarea className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("homeworkPlaceholder")} rows={2} value={homework} onChange={(event) => setHomework(event.target.value)} />
              <textarea className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("notesPlaceholder")} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <input type="number" className={`w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("durationPlaceholder")} value={duration} onChange={(event) => setDuration(event.target.value)} min="1" max="180" />
                <span className="text-sm text-gray-500">{t("minutes")}</span>
              </div>
              <div className="flex gap-2">
                <Button fullWidth loading={saving}><Save className="h-5 w-5" /> {editId ? t("saveChanges") : t("saveLesson")}</Button>
                <Button variant="secondary" type="button" onClick={resetForm}>{tCommon("cancel")}</Button>
              </div>
            </div>
          </Card>
        </form>
      )}

      {selectedSchedule && (
        <Card padding="md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{t("sessionLessons")}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("sessionSummary", {
                  classroom: selectedSchedule.classroom.name,
                  subject: getLocalizedSubjectName(selectedSchedule.subject, locale),
                  start: selectedSchedule.startTime,
                  end: selectedSchedule.endTime,
                })}
              </p>
            </div>
            <Badge variant={lessons.length ? "info" : "default"}>{lessons.length}</Badge>
          </div>

          {loadingLessons ? (
            <LoadingSpinner />
          ) : fetchError ? (
            <ErrorDisplay message={t("recordLoadError")} onRetry={() => setRetryTrigger((current) => current + 1)} />
          ) : lessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">{t("emptyState")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <BookOpen className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-gray-950">{lesson.title}</h3>
                        {lesson.duration && (
                          <Badge variant="default">{lesson.duration} {locale === "ar" ? "د" : "min"}</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-400">{new Date(lesson.date).toLocaleDateString(getDateLocale(locale))}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(lesson)} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50" aria-label={t("editAria")}>
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setLessonToDelete(lesson.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={t("deleteAria")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {lesson.description && <p className="mt-3 text-sm leading-6 text-gray-600">{lesson.description}</p>}
                  {lesson.homework && (
                    <div className="mt-3 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
                      <span className="font-medium">{t("homeworkLabel")} </span>{lesson.homework}
                    </div>
                  )}
                  {lesson.notes && (
                    <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{lesson.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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

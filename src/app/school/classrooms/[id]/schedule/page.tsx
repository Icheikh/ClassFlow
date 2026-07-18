"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Button, Card, Badge, Modal, LoadingPage, Select, ConfirmModal } from "@/components/ui"
import { ArrowLeft, Plus, Trash2, Edit2, Clock, BookOpen, User } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type ScheduleEntry = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  classroomId: string
  subjectId: string
  teacherId: string | null
  classroom: { id: string; name: string; level: { name: string } }
  subject: { id: string; nameAr: string }
  teacher: { id: string; user: { name: string } } | null
}

type Subject = { id: string; nameAr: string }
type Teacher = { id: string; user: { name: string }; teacherAssignments: { subjectId: string; classroomId: string }[] }

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
]

export default function ClassroomSchedulePage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const router = useRouter()

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [classroom, setClassroom] = useState<{ name: string; level: { name: string } } | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ dayOfWeek: "0", startTime: "08:00", endTime: "09:00", subjectId: "", teacherId: "" })
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  async function loadData() {
    const [schedRes, subjectsRes, teachersRes, classroomRes] = await Promise.all([
      api.get<ScheduleEntry[]>(`/api/school/schedules?classroomId=${id}`),
      api.get<Subject[]>("/api/school/subjects"),
      api.get<Teacher[]>("/api/school/teachers"),
      api.get<any>(`/api/school/classrooms/${id}`),
    ])
    if (schedRes.data) setEntries(schedRes.data)
    if (subjectsRes.data) setSubjects(subjectsRes.data)
    if (teachersRes.data) setTeachers(teachersRes.data)
    if (classroomRes.data) setClassroom(classroomRes.data.classroom || classroomRes.data)
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [id])

  function openAdd() {
    setEditId(null)
    setForm({ dayOfWeek: "0", startTime: "08:00", endTime: "09:00", subjectId: "", teacherId: "" })
    setShowModal(true)
  }

  function openEdit(entry: ScheduleEntry) {
    setEditId(entry.id)
    setForm({ dayOfWeek: String(entry.dayOfWeek), startTime: entry.startTime, endTime: entry.endTime, subjectId: entry.subjectId, teacherId: entry.teacherId || "" })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.subjectId) { toast.error("اختر المادة"); return }
    setSaving(true)
    const payload = { ...form, dayOfWeek: parseInt(form.dayOfWeek), classroomId: id }
    const { error } = editId
      ? await api.put("/api/school/schedules", { id: editId, ...payload })
      : await api.post("/api/school/schedules", payload)
    if (error) toast.error(error)
    else {
      toast.success(editId ? "تم التعديل" : "تمت الإضافة")
      setShowModal(false)
      await loadData()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await api.delete(`/api/school/schedules?id=${deleteTarget}`)
    setDeleteTarget(null)
    if (error) toast.error(error)
    else { toast.success("تم الحذف"); await loadData() }
  }

  function getSubjectName(subjectId: string) {
    return subjects.find((s) => s.id === subjectId)?.nameAr || subjectId
  }

  function getTeacherName(teacherId: string | null) {
    if (!teacherId) return null
    return teachers.find((t) => t.id === teacherId)?.user.name || null
  }

  function getTeacherOptions(dayOfWeek: number, startTime: string, endTime: string) {
    return teachers.filter((t) => {
      const hasConflict = entries.some(
        (e) =>
          e.id !== editId &&
          e.teacherId === t.id &&
          e.dayOfWeek === dayOfWeek &&
          e.startTime < endTime &&
          e.endTime > startTime
      )
      return !hasConflict
    })
  }

  function getGridPosition(start: string, end: string) {
    const startIdx = TIME_SLOTS.indexOf(start)
    const endIdx = TIME_SLOTS.indexOf(end)
    return { start: startIdx >= 0 ? startIdx : 0, span: Math.max(1, endIdx - startIdx) }
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/school/classrooms/${id}`} aria-label="العودة لصفحة القسم">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">جدول القسم</h1>
            <p className="text-sm text-gray-500">{classroom?.name || "..."} - {classroom?.level?.name || "..."}</p>
          </div>
        </div>
        <Button onClick={openAdd}><Plus className="h-5 w-5" /> إضافة حصة</Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]" role="grid" aria-label="جدول الحصص الأسبوعي">
          {/* Header */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-px bg-gray-200 rounded-t-lg overflow-hidden">
            <div className="bg-gray-100 p-3 font-medium text-sm text-gray-500 text-center">الوقت</div>
            {DAYS.map((day, i) => (
              <div key={i} className="bg-gray-100 p-3 font-medium text-sm text-center">{day}</div>
            ))}
          </div>

          {/* Time rows */}
          {TIME_SLOTS.slice(0, -1).map((time, rowIdx) => (
            <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] gap-px bg-gray-200">
              <div className="bg-white p-2 text-xs text-gray-400 text-center flex items-center justify-center">
                {time}
              </div>
              {DAYS.map((_, dayIdx) => {
                const cellEntries = entries.filter(
                  (e) => e.dayOfWeek === dayIdx && e.startTime === time
                )
                return (
                  <div key={dayIdx} className="bg-white min-h-[60px] p-1 relative">
                    {cellEntries.map((entry) => {
                      const { span } = getGridPosition(entry.startTime, entry.endTime)
                      return (
                        <div
                          key={entry.id}
                          className="bg-blue-50 border border-blue-200 rounded p-1.5 text-xs cursor-pointer hover:bg-blue-100 transition-colors group"
                          style={span > 1 ? { gridRow: `span ${span}` } : undefined}
                          onClick={() => openEdit(entry)}
                        >
                          <div className="flex items-center gap-1 text-blue-700 font-medium">
                            <BookOpen className="h-3 w-3" />
                            {entry.subject.nameAr}
                          </div>
                          {entry.teacher && (
                            <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                              <User className="h-2.5 w-2.5" />
                              {entry.teacher.user.name}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {entry.startTime}-{entry.endTime}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry.id) }}
                            className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                            aria-label="حذف الحصة"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {entries.length === 0 && (
        <Card className="mt-6">
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500">لا توجد حصص مسجلة لهذا القسم</p>
            <Button variant="secondary" size="sm" onClick={openAdd} className="mt-4">
              <Plus className="h-4 w-4" /> إضافة أول حصة
            </Button>
          </div>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? "تعديل الحصة" : "إضافة حصة"}>
        <div className="space-y-4">
          <Select
            label="اليوم"
            value={form.dayOfWeek}
            onChange={(v) => setForm({ ...form, dayOfWeek: v })}
            options={DAYS.map((day, i) => ({ value: String(i), label: day }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="بداية"
              value={form.startTime}
              onChange={(v) => setForm({ ...form, startTime: v })}
              options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
            />
            <Select
              label="نهاية"
              value={form.endTime}
              onChange={(v) => setForm({ ...form, endTime: v })}
              options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <Select
            label="المادة"
            value={form.subjectId}
            onChange={(v) => setForm({ ...form, subjectId: v })}
            options={subjects.map((s) => ({ value: s.id, label: s.nameAr }))}
          />
          <Select
            label="الأستاذ (اختياري)"
            value={form.teacherId}
            onChange={(v) => setForm({ ...form, teacherId: v })}
            options={[
              { value: "", label: "—" },
              ...getTeacherOptions(parseInt(form.dayOfWeek), form.startTime, form.endTime)
                .map((t) => ({ value: t.id, label: t.user.name })),
            ]}
          />
          <div className="flex gap-2">
            <Button fullWidth onClick={handleSave} loading={saving}>
              {editId ? "حفظ التعديلات" : "إضافة الحصة"}
            </Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="حذف الحصة"
        message="سيتم حذف هذه الحصة من الجدول. هل أنت متأكد؟"
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />
    </div>
  )
}

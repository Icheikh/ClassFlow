"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Badge, LoadingPage } from "@/components/ui"
import { Plus, UserPlus, BookOpen, Trash2, X, ChevronDown, ChevronUp, Mail, Phone, Shield, Eye } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type TeacherData = {
  id: string; phone: string | null; status: string
  user: { id: string; email: string; name: string; phone: string | null; isActive: boolean }
  teacherAssignments: AssignmentData[]
}
type AssignmentData = {
  id: string; subject: { id: string; nameAr: string; nameFr: string | null }
  classroom: { id: string; name: string; level: { name: string } }
}
type Subject = { id: string; nameAr: string; code: string | null }
type Classroom = { id: string; name: string; level: { id: string; name: string } }

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherData[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [addModal, setAddModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [assignTeacherId, setAssignTeacherId] = useState<string>("")
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "password123" })
  const [editId, setEditId] = useState<string | null>(null)
  const [assignSubj, setAssignSubj] = useState("")
  const [assignClass, setAssignClass] = useState("")

  const fetchData = async () => {
    const [t, s, c] = await Promise.all([
      api.get<TeacherData[]>("/api/school/teachers"),
      api.get<Subject[]>("/api/school/subjects"),
      api.get<Classroom[]>("/api/school/classrooms"),
    ])
    if (t.data) setTeachers(t.data)
    if (s.data) setSubjects(s.data)
    if (c.data) setClassrooms(c.data)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  function resetForm() { setForm({ name: "", email: "", phone: "", password: "password123" }); setEditId(null) }

  async function saveTeacher() {
    if (!form.name || !form.email) { toast.error("الاسم والبريد الإلكتروني مطلوبان"); return }
    const payload = editId ? { id: editId, name: form.name, email: form.email, phone: form.phone } : form
    const { error } = editId
      ? await api.put("/api/school/teachers", payload)
      : await api.post("/api/school/teachers", payload)
    if (error) toast.error(error)
    else { toast.success(editId ? "تم التعديل" : "تمت الإضافة"); setAddModal(false); resetForm(); fetchData() }
  }

  async function deleteTeacher(id: string) {
    if (!confirm("سيتم تعطيل حساب هذا الأستاذ. هل أنت متأكد؟")) return
    const { error } = await api.delete(`/api/school/teachers?id=${id}`)
    if (error) toast.error(error); else { toast.success("تم التعطيل"); fetchData() }
  }

  async function saveAssignment() {
    if (!assignSubj || !assignClass) { toast.error("اختر المادة والقسم"); return }
    const { error } = await api.post("/api/school/teacher-assignments", {
      teacherId: assignTeacherId, subjectId: assignSubj, classroomId: assignClass,
    })
    if (error) toast.error(error)
    else { toast.success("تم التكليف"); setAssignModal(false); setAssignSubj(""); setAssignClass(""); fetchData() }
  }

  async function deleteAssignment(id: string) {
    await api.delete(`/api/school/teacher-assignments?id=${id}`)
    fetchData()
  }

  const filtered = teachers.filter((t) =>
    t.user.name.includes(search) || t.user.email.includes(search)
  )

  if (loading) return <LoadingPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الأساتذة</h1>
          <p className="text-sm text-gray-500">إدارة الأساتذة وتكليفهم بالمواد والأقسام</p>
        </div>
        <Button onClick={() => { resetForm(); setAddModal(true) }}>
          <Plus className="h-5 w-5" /> إضافة أستاذ
        </Button>
      </div>

      {/* Search */}
      <Card padding="md" className="mb-6">
        <Input
          placeholder="ابحث بالاسم أو البريد الإلكتروني..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {/* Modals */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={editId ? "تعديل أستاذ" : "إضافة أستاذ جديد"}>
        <div className="space-y-4">
          <Input label="الاسم الكامل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="خالد ولد أحمد" />
          <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teacher@school.edu" />
          <Input label="الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+222 12 34 56 78" />
          {!editId && <Input label="كلمة المرور" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          <Button fullWidth onClick={saveTeacher}>حفظ</Button>
        </div>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="تكليف أستاذ بمادة">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">المادة</label>
            <select value={assignSubj} onChange={(e) => setAssignSubj(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">اختر المادة</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">القسم</label>
            <select value={assignClass} onChange={(e) => setAssignClass(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">اختر القسم</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.level.name}</option>)}
            </select>
          </div>
          <Button fullWidth onClick={saveAssignment}>إضافة تكليف</Button>
        </div>
      </Modal>

      {/* Teachers List */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <UserPlus className="h-16 w-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 text-lg mb-1">لا يوجد أساتذة بعد</p>
            <p className="text-gray-400 text-sm mb-4">أضف أول أستاذ لتبدأ</p>
            <Button onClick={() => { resetForm(); setAddModal(true) }}><Plus className="h-5 w-5" /> إضافة أستاذ</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <Card key={t.id} padding="md" className="relative group">
              <div className="flex items-start gap-4">
                <Link href={`/school/teachers/${t.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0 text-lg">
                    {t.user.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg text-blue-700 group-hover:underline">{t.user.name}</h3>
                      <Badge variant={t.user.isActive ? "success" : "danger"}>
                        {t.user.isActive ? "نشط" : "موقوف"}
                      </Badge>
                      <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full flex items-center gap-1">
                        <Shield className="h-3 w-3" /> أستاذ
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {t.user.email}</span>
                      {t.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {t.phone}</span>}
                      <span className="text-xs text-gray-400">{t.teacherAssignments.length} تكليف</span>
                    </div>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <Button variant="secondary" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAssignTeacherId(t.id); setAssignSubj(""); setAssignClass(""); setAssignModal(true) }}>
                    <BookOpen className="h-4 w-4" /> تكليف
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); setEditId(t.id); setForm({ name: t.user.name, email: t.user.email, phone: t.user.phone || "", password: "" }); setAddModal(true) }}>
                    تعديل
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); deleteTeacher(t.id) }} className="text-red-500" aria-label="حذف الأستاذ">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <button onClick={(e) => { e.preventDefault(); setExpandedId(expandedId === t.id ? null : t.id) }}
                    className="p-1.5 hover:bg-gray-100 rounded"
                    aria-label={expandedId === t.id ? "إخفاء التكليفات" : "عرض التكليفات"}
                    aria-expanded={expandedId === t.id}
                    aria-controls={`teacher-assignments-${t.id}`}>
                    {expandedId === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Assignments */}
              {expandedId === t.id && (
                <div id={`teacher-assignments-${t.id}`} className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">التكليفات الحالية ({t.teacherAssignments.length})</h4>
                  </div>
                  {t.teacherAssignments.length === 0 ? (
                    <p className="text-sm text-gray-400">لا توجد تكليفات بعد</p>
                  ) : (
                    <div className="space-y-2">
                      {t.teacherAssignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">{a.subject.nameAr}</span>
                            <span className="text-xs text-gray-400">←</span>
                            <span className="text-sm text-gray-600">{a.classroom.name} - {a.classroom.level.name}</span>
                          </div>
                          <button onClick={() => deleteAssignment(a.id)} className="text-red-300 hover:text-red-500 p-1" aria-label="حذف التكليف">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
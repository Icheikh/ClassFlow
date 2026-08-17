"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Badge, LoadingPage, ConfirmModal, Pagination } from "@/components/ui"
import { Plus, UserPlus, BookOpen, Trash2, X, ChevronDown, ChevronUp, Mail, Phone, Shield } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"
import { getLocalizedSubjectName } from "@/lib/locale"

type TeacherData = {
  id: string; phone: string | null; status: string
  user: { id: string; email: string; name: string; phone: string | null; isActive: boolean }
  teacherAssignments: AssignmentData[]
}
type AssignmentData = {
  id: string; subject: { id: string; nameAr: string; nameFr: string | null }
  classroom: { id: string; name: string; level: { name: string } }
}
type Subject = { id: string; nameAr: string; nameFr: string | null; code: string | null }
type Classroom = { id: string; name: string; level: { id: string; name: string } }

export default function TeachersPage() {
  const locale = useLocale()
  const t = useTranslations("teachersPage")
  const tCommon = useTranslations("common")
  const tStatus = useTranslations("status")
  const [teachers, setTeachers] = useState<TeacherData[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const limit = 10
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [addModal, setAddModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [assignTeacherId, setAssignTeacherId] = useState<string>("")
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" })
  const [editId, setEditId] = useState<string | null>(null)
  const [assignSubj, setAssignSubj] = useState("")
  const [assignClass, setAssignClass] = useState("")
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null)

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
  useEffect(() => { setPage(1) }, [search])

  function resetForm() { setForm({ name: "", email: "", phone: "", password: "" }); setEditId(null) }

  async function saveTeacher() {
    if (!form.name || !form.email) { toast.error(t("missingNameEmail")); return }
    const payload = editId ? { id: editId, name: form.name, email: form.email, phone: form.phone } : form
    const { error } = editId
      ? await api.put("/api/school/teachers", payload)
      : await api.post("/api/school/teachers", payload)
    if (error) toast.error(error)
    else { toast.success(editId ? t("editSuccess") : t("createSuccess")); setAddModal(false); resetForm(); fetchData() }
  }

  async function deleteTeacher(id: string) {
    const { error } = await api.delete(`/api/school/teachers?id=${id}`)
    setTeacherToDelete(null)
    if (error) toast.error(error); else { toast.success(t("disableSuccess")); fetchData() }
  }

  async function saveAssignment() {
    if (!assignSubj || !assignClass) { toast.error(t("missingAssignment")); return }
    const { error } = await api.post("/api/school/teacher-assignments", {
      teacherId: assignTeacherId, subjectId: assignSubj, classroomId: assignClass,
    })
    if (error) toast.error(error)
    else { toast.success(t("assignmentSuccess")); setAssignModal(false); setAssignSubj(""); setAssignClass(""); fetchData() }
  }

  async function deleteAssignment(id: string) {
    const { error } = await api.delete(`/api/school/teacher-assignments?id=${id}`)
    if (error) toast.error(error)
    else { toast.success(t("assignmentDeleteSuccess")); fetchData() }
  }

  const filtered = teachers.filter((t) =>
    t.user.name.includes(search) || t.user.email.includes(search)
  )
  const paginatedTeachers = filtered.slice((page - 1) * limit, page * limit)
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / limit))
    if (page > maxPage) setPage(maxPage)
  }, [filtered.length, limit, page])

  if (loading) return <LoadingPage />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setAddModal(true) }}>
          <Plus className="h-5 w-5" /> {t("addTeacher")}
        </Button>
      </div>

      {/* Search */}
      <Card padding="md" className="mb-6">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {/* Modals */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={editId ? t("editTeacher") : t("addTeacherTitle")}>
        <div className="space-y-4">
          <Input label={t("fullName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("teacherNamePlaceholder")} />
          <Input label={tCommon("email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teacher@school.edu" />
          <Input label={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+222 12 34 56 78" />
          {!editId && <Input label={t("password")} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
          <Button fullWidth onClick={saveTeacher}>{t("save")}</Button>
        </div>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title={t("assignTeacherTitle")}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("subjectLabel")}</label>
            <select value={assignSubj} onChange={(e) => setAssignSubj(e.target.value)}
              className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
              <option value="">{t("selectSubject")}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{getLocalizedSubjectName(s, locale)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t("classroomLabel")}</label>
            <select value={assignClass} onChange={(e) => setAssignClass(e.target.value)}
              className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
              <option value="">{t("selectClassroom")}</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name} - {c.level.name}</option>)}
            </select>
          </div>
          <Button fullWidth onClick={saveAssignment}>{t("addAssignment")}</Button>
        </div>
      </Modal>

      {/* Teachers List */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <UserPlus className="h-16 w-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 text-lg mb-1">{t("emptyTitle")}</p>
            <p className="text-gray-400 text-sm mb-4">{t("emptyDesc")}</p>
            <Button onClick={() => { resetForm(); setAddModal(true) }}><Plus className="h-5 w-5" /> {t("addTeacher")}</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedTeachers.map((teacher) => (
            <Card key={teacher.id} padding="md" className="relative group">
              <div className="flex items-start gap-4">
                <Link href={`/school/teachers/${teacher.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0 text-lg">
                    {teacher.user.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg text-blue-700 group-hover:underline">{teacher.user.name}</h3>
                      <Badge variant={teacher.user.isActive ? "success" : "danger"}>
                        {teacher.user.isActive ? tStatus("active") : tStatus("inactive")}
                      </Badge>
                      <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {t("teacherRole")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {teacher.user.email}</span>
                      {teacher.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {teacher.phone}</span>}
                      <span className="text-xs text-gray-400">{t("assignmentCount", { count: teacher.teacherAssignments.length })}</span>
                    </div>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <Button variant="secondary" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAssignTeacherId(teacher.id); setAssignSubj(""); setAssignClass(""); setAssignModal(true) }}>
                    <BookOpen className="h-4 w-4" /> {t("assign")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); setEditId(teacher.id); setForm({ name: teacher.user.name, email: teacher.user.email, phone: teacher.user.phone || "", password: "" }); setAddModal(true) }}>
                    {t("edit")}
                  </Button>
                   <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); setTeacherToDelete(teacher.id) }} className="text-red-500" aria-label={t("deleteTeacherAria")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <button onClick={(e) => { e.preventDefault(); setExpandedId(expandedId === teacher.id ? null : teacher.id) }}
                    className="p-1.5 hover:bg-gray-100 rounded"
                    aria-label={expandedId === teacher.id ? t("hideAssignments") : t("showAssignments")}
                    aria-expanded={expandedId === teacher.id}
                    aria-controls={`teacher-assignments-${teacher.id}`}>
                    {expandedId === teacher.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Assignments */}
              {expandedId === teacher.id && (
                <div id={`teacher-assignments-${teacher.id}`} className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">{t("currentAssignments", { count: teacher.teacherAssignments.length })}</h4>
                  </div>
                  {teacher.teacherAssignments.length === 0 ? (
                    <p className="text-sm text-gray-400">{t("noAssignments")}</p>
                  ) : (
                    <div className="space-y-2">
                      {teacher.teacherAssignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">{getLocalizedSubjectName(a.subject, locale)}</span>
                            <span className="text-xs text-gray-400">{locale === "ar" ? "←" : "→"}</span>
                            <span className="text-sm text-gray-600">{a.classroom.name} - {a.classroom.level.name}</span>
                          </div>
                          <button onClick={() => deleteAssignment(a.id)} className="text-red-300 hover:text-red-500 p-1" aria-label={t("deleteAssignmentAria")}>
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
          <Pagination page={page} total={filtered.length} limit={limit} onChange={setPage} />
        </div>
      )}

      <ConfirmModal
        open={!!teacherToDelete}
        onClose={() => setTeacherToDelete(null)}
        onConfirm={() => void deleteTeacher(teacherToDelete!)}
        title={t("disableTitle")}
        message={t("disableMessage")}
        confirmText={t("disableConfirm")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </div>
  )
}

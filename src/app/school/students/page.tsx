"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Badge, LoadingPage } from "@/components/ui"
import { Plus, Users, Trash2, BookOpen, ChevronDown, ChevronUp, Phone, Calendar, Hash, X, Upload, Filter, UserPlus, Download, Eye } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import toast from "react-hot-toast"

type StudentData = {
  id: string
  firstName: string
  lastName: string
  gender: string | null
  birthDate: string | null
  studentNumber: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  enrollments?: {
    id: string
    status: string
    classroom: { id: string; name: string; level: { name: string } }
    academicYear: { id: string; name: string; isActive: boolean }
  }[]
  studentParents?: {
    id: string
    relationship: string | null
    isPrimary: boolean
    parent: { id: string; phone: string | null; user: { name: string; email: string; phone: string | null } }
  }[]
}

type Classroom = { id: string; name: string; level: { id: string; name: string; stage: { name: string } }; stream: { id: string; name: string } | null }
type AcademicYear = { id: string; name: string; isActive: boolean }

export default function StudentsPage() {
  const searchParams = useSearchParams()
  const classroomIdFromQuery = searchParams.get("classroomId") || ""
  const [students, setStudents] = useState<StudentData[]>([])
  const [total, setTotal] = useState(0)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [classroomFilter, setClassroomFilter] = useState(classroomIdFromQuery)
  const [statusFilter, setStatusFilter] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [addModal, setAddModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: "", lastName: "", gender: "", birthDate: "", studentNumber: "", address: "", phone: "", parentName: "", parentPhone: "", parentEmail: "" })

  const [enrollModal, setEnrollModal] = useState(false)
  const [enrollStudentId, setEnrollStudentId] = useState("")
  const [enrollClassroomId, setEnrollClassroomId] = useState("")
  const [enrollYearId, setEnrollYearId] = useState("")

  const [importModal, setImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (classroomFilter) params.set("classroomId", classroomFilter)
    if (statusFilter) params.set("status", statusFilter)
    const [sRes, cRes, yRes] = await Promise.all([
      api.get<any>(`/api/school/students?${params}`),
      api.get<Classroom[]>("/api/school/classrooms"),
      api.get<AcademicYear[]>("/api/school/academic-years"),
    ])
    if (sRes.data) { setStudents(sRes.data.students); setTotal(sRes.data.total) }
    if (cRes.data) setClassrooms(cRes.data)
    if (yRes.data) setAcademicYears(yRes.data)
    setLoading(false)
  }, [search, classroomFilter, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    setClassroomFilter(classroomIdFromQuery)
  }, [classroomIdFromQuery])

  function resetForm() { setForm({ firstName: "", lastName: "", gender: "", birthDate: "", studentNumber: "", address: "", phone: "", parentName: "", parentPhone: "", parentEmail: "" }); setEditId(null) }

  async function saveStudent() {
    if (!form.firstName || !form.lastName) { toast.error("الاسم الأول واسم العائلة مطلوبان"); return }
    if (editId) {
      const { error } = await api.put(`/api/school/students/${editId}`, form)
      if (error) toast.error(error)
      else { toast.success("تم التعديل"); setAddModal(false); resetForm(); fetchData() }
    } else {
      const { error } = await api.post("/api/school/students", form)
      if (error) toast.error(error)
      else { toast.success("تمت الإضافة"); setAddModal(false); resetForm(); fetchData() }
    }
  }

  async function toggleActive(s: StudentData) {
    const msg = s.isActive ? "سيتم تعطيل هذا الطالب. هل أنت متأكد؟" : "سيتم إعادة تفعيل هذا الطالب. هل أنت متأكد؟"
    if (!confirm(msg)) return
    const { error } = await api.put(`/api/school/students/${s.id}`, { isActive: !s.isActive })
    if (error) toast.error(error)
    else { toast.success(s.isActive ? "تم التعطيل" : "تم التفعيل"); fetchData() }
  }

  async function saveEnrollment() {
    if (!enrollClassroomId || !enrollYearId) { toast.error("اختر القسم والسنة الدراسية"); return }
    const { error } = await api.post("/api/school/enrollments", {
      studentId: enrollStudentId, classroomId: enrollClassroomId, academicYearId: enrollYearId,
    })
    if (error) toast.error(error)
    else { toast.success("تم التسجيل"); setEnrollModal(false); setEnrollClassroomId(""); setEnrollYearId(""); fetchData() }
  }

  async function deleteEnrollment(id: string) {
    if (!confirm("سيتم حذف هذا التسجيل. هل أنت متأكد؟")) return
    const { error } = await api.delete(`/api/school/enrollments?id=${id}`)
    if (error) toast.error(error)
    else { toast.success("تم الحذف"); fetchData() }
  }

  async function handleImport() {
    if (!importText.trim()) { toast.error("الصق بيانات التلاميذ أولاً"); return }
    setImporting(true)
    const lines = importText.trim().split("\n").filter(Boolean)
    let success = 0; let fail = 0
    for (const line of lines) {
      const parts = line.split("\t")
      const firstName = parts[0]?.trim()
      const lastName = parts[1]?.trim()
      const studentNumber = parts[2]?.trim()
      const parentName = parts[3]?.trim()
      const parentPhone = parts[4]?.trim()
      if (!firstName || !lastName) { fail++; continue }
      const { error } = await api.post("/api/school/students", { firstName, lastName, studentNumber: studentNumber || undefined, parentName: parentName || undefined, parentPhone: parentPhone || undefined })
      if (error) fail++; else success++
    }
    setImporting(false)
    toast.success(`تم استيراد ${success} طالب${fail ? `، فشل ${fail}` : ""}`)
    setImportModal(false)
    setImportText("")
    fetchData()
  }

  if (loading) return <LoadingPage />

  const activeYear = academicYears.find((y) => y.isActive)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الطلاب</h1>
          <p className="text-sm text-gray-500">إدارة الطلاب وتسجيلهم في الأقسام ({total} طالب)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportModal(true)}>
            <Upload className="h-5 w-5" /> استيراد
          </Button>
          <Button onClick={() => { resetForm(); setAddModal(true) }}>
            <Plus className="h-5 w-5" /> إضافة طالب
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              placeholder="ابحث بالاسم أو رقم التسجيل أو الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-56">
            <select value={classroomFilter} onChange={(e) => setClassroomFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">كل الأقسام</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.level.name}{c.stream ? ` (${c.stream.name})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">الكل</option>
              <option value="ACTIVE">نشط</option>
              <option value="INACTIVE">موقوف</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Modals */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={editId ? "تعديل طالب" : "إضافة طالب جديد"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-medium text-gray-700">بيانات الطالب</p>
          <div className="grid grid-cols-2 gap-3">
            <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="الاسم الأول *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="اسم العائلة *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">الجنس</option>
            <option value="MALE">ذكر</option>
            <option value="FEMALE">أنثى</option>
          </select>
          <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="رقم التسجيل" value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} />
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="العنوان" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="هاتف الطالب" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <hr />
          <p className="text-sm font-medium text-gray-700">ولي الأمر (لإشعارات واتساب)</p>
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="اسم ولي الأمر" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" dir="ltr" placeholder={"+222XXXXXXXXX  هاتف ولي الأمر"} value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" dir="ltr" placeholder="البريد الإلكتروني (اختياري)" type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
          <Button fullWidth onClick={saveStudent}>{editId ? "حفظ التعديلات" : "إضافة الطالب"}</Button>
        </div>
      </Modal>

      <Modal open={enrollModal} onClose={() => setEnrollModal(false)} title="تسجيل طالب في قسم">
        <div className="space-y-4">
          <select value={enrollClassroomId} onChange={(e) => setEnrollClassroomId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">اختر القسم</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - {c.level.name}{c.stream ? ` (${c.stream.name})` : ""}</option>
            ))}
          </select>
          <select value={enrollYearId} onChange={(e) => setEnrollYearId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">اختر السنة الدراسية</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.isActive ? " (الحالية)" : ""}</option>
            ))}
          </select>
          <Button fullWidth onClick={saveEnrollment}>تسجيل</Button>
        </div>
      </Modal>

      <Modal open={importModal} onClose={() => setImportModal(false)} title="استيراد طلاب من Excel">
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 space-y-1">
            <p className="font-medium">طريقة الاستيراد:</p>
            <p>انسخ البيانات من Excel والصقها في الحقل أدناه.</p>
            <p>الترتيب المطلوب لكل سطر (مفصول بعلامة tab):</p>
            <p className="font-mono text-xs bg-white p-2 rounded" dir="ltr">الاسم الأول	اسم العائلة	رقم التسجيل	اسم ولي الأمر	هاتف ولي الأمر</p>
            <p className="mt-1">مثال:</p>
            <p className="font-mono text-xs bg-white p-2 rounded" dir="ltr">أحمد	ولد محمد	STU-001	خالد ولد أحمد	+222 12 34 56 78</p>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="الصق البيانات هنا..."
            rows={10}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
          />
          <div className="flex gap-2">
            <Button fullWidth onClick={handleImport} disabled={importing}>
              {importing ? "جارٍ الاستيراد..." : "استيراد"}
            </Button>
            <Button variant="secondary" onClick={() => { setImportModal(false); setImportText("") }}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* Students List */}
      {students.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Users className="h-16 w-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 text-lg mb-1">لا يوجد طلاب بعد</p>
            <p className="text-gray-400 text-sm mb-4">أضف أول طالب أو استورد القائمة من Excel</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => { resetForm(); setAddModal(true) }}><Plus className="h-5 w-5" /> إضافة طالب</Button>
              <Button variant="secondary" onClick={() => setImportModal(true)}><Upload className="h-5 w-5" /> استيراد</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {students.map((s) => {
            const activeEnrollment = s.enrollments?.find((e) => e.status === "ACTIVE" && e.academicYear.isActive)
            return (
              <Card key={s.id} padding="md" className="relative group">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Link href={`/school/students/${s.id}`} className="shrink-0">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-lg hover:ring-2 hover:ring-purple-300 transition-all">
                      {s.firstName.charAt(0)}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/school/students/${s.id}`} className="hover:text-purple-700 transition-colors">
                        <h3 className="font-semibold text-lg text-gray-900 hover:underline">{s.firstName} {s.lastName}</h3>
                      </Link>
                      <Badge variant={s.isActive ? "success" : "danger"}>
                        {s.isActive ? "نشط" : "موقوف"}
                      </Badge>
                      {s.gender && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          {s.gender === "MALE" ? "ذكر" : "أنثى"}
                        </span>
                      )}
                      {activeEnrollment && (
                        <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {activeEnrollment.classroom.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                      {s.studentNumber && <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> {s.studentNumber}</span>}
                      {s.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {s.phone}</span>}
                      {s.birthDate && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(s.birthDate).toLocaleDateString("ar")}</span>}
                      <span className="text-xs text-gray-400">{s.enrollments?.length || 0} تسجيل</span>
                      {s.studentParents?.[0] && (
                        <span className="text-xs text-gray-400">ولي: {s.studentParents[0].parent.user.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Link href={`/school/students/${s.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => { setEnrollStudentId(s.id); setEnrollClassroomId(""); setEnrollYearId(""); setEnrollModal(true) }}>
                      <BookOpen className="h-4 w-4" /> تسجيل
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditId(s.id)
                      setForm({
                        firstName: s.firstName, lastName: s.lastName, gender: s.gender || "",
                        birthDate: s.birthDate ? s.birthDate.split("T")[0] : "", studentNumber: s.studentNumber || "",
                        address: s.address || "", phone: s.phone || "",
                        parentName: s.studentParents?.[0]?.parent.user.name || "",
                        parentPhone: s.studentParents?.[0]?.parent.user.phone || "",
                        parentEmail: s.studentParents?.[0]?.parent.user.email || "",
                      })
                      setAddModal(true)
                    }}>
                      تعديل
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(s)} className={s.isActive ? "text-red-500" : "text-green-500"}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="p-1.5 hover:bg-gray-100 rounded">
                      {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: Enrollments + Parents */}
                {expandedId === s.id && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Enrollments */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">التسجيلات ({s.enrollments?.length || 0})</h4>
                      {(!s.enrollments || s.enrollments.length === 0) ? (
                        <p className="text-sm text-gray-400">لا توجد تسجيلات بعد</p>
                      ) : (
                        <div className="space-y-2">
                          {s.enrollments.map((e) => (
                            <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-purple-500" />
                                <span className="text-sm font-medium">{e.classroom.name}</span>
                                <span className="text-xs text-gray-400">- {e.classroom.level.name}</span>
                                <Badge variant={e.status === "ACTIVE" ? "success" : "warning"}>{e.status === "ACTIVE" ? "نشط" : e.status}</Badge>
                                <span className="text-xs text-gray-400">{e.academicYear.name}</span>
                              </div>
                              <button onClick={() => deleteEnrollment(e.id)} className="text-red-300 hover:text-red-500 p-1">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Parents */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">أولياء الأمور ({s.studentParents?.length || 0})</h4>
                      {(!s.studentParents || s.studentParents.length === 0) ? (
                        <p className="text-sm text-gray-400">لا يوجد ولي أمر مسجل</p>
                      ) : (
                        <div className="space-y-2">
                          {s.studentParents.map((sp) => (
                            <div key={sp.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div>
                                <span className="text-sm font-medium">{sp.parent.user.name}</span>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                  {sp.parent.user.phone && <span dir="ltr">{sp.parent.user.phone}</span>}
                                  <Badge variant="info">{sp.relationship || "ولي أمر"}</Badge>
                                  {sp.isPrimary && <Badge variant="success">أساسي</Badge>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

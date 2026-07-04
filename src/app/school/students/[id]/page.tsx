"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Button, Card, Badge, Modal, LoadingPage } from "@/components/ui"
import { ArrowLeft, User, Hash, Calendar, Phone, MapPin, BookOpen, Users, GraduationCap, UserCheck, UserX, TrendingUp, ChevronRight, Edit3, Link2, Plus } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  gender: string | null
  birthDate: string | null
  studentNumber: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  enrollments: {
    id: string
    status: string
    classroom: { id: string; name: string; level: { name: string }; stream: { name: string } | null }
    academicYear: { id: string; name: string; isActive: boolean }
  }[]
  studentParents: {
    id: string
    relationship: string | null
    isPrimary: boolean
    parent: { id: string; phone: string | null; user: { name: string; email: string; phone: string | null } }
  }[]
}

type Classroom = { id: string; name: string; level: { id: string; name: string }; stream: { id: string; name: string } | null }
type AcademicYear = { id: string; name: string; isActive: boolean }

export default function StudentDetailPage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const router = useRouter()
  const [data, setData] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [editModal, setEditModal] = useState(false)
  const [enrollModal, setEnrollModal] = useState(false)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [enrollClassroomId, setEnrollClassroomId] = useState("")
  const [enrollYearId, setEnrollYearId] = useState("")

  const [form, setForm] = useState({ firstName: "", lastName: "", gender: "", birthDate: "", studentNumber: "", address: "", phone: "", parentName: "", parentPhone: "", parentEmail: "" })

  const fetchStudent = async () => {
    if (!id) {
      setLoading(false)
      return
    }

    const [sRes, cRes, yRes] = await Promise.all([
      api.get<StudentDetail>(`/api/school/students/${id}`),
      api.get<Classroom[]>("/api/school/classrooms"),
      api.get<AcademicYear[]>("/api/school/academic-years"),
    ])
    if (sRes.data) setData(sRes.data)
    if (cRes.data) setClassrooms(cRes.data)
    if (yRes.data) setAcademicYears(yRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchStudent() }, [id])

  async function saveStudent() {
    if (!form.firstName || !form.lastName) { toast.error("الاسم الأول واسم العائلة مطلوبان"); return }
    const { error } = await api.put(`/api/school/students/${id}`, form)
    if (error) toast.error(error)
    else { toast.success("تم التعديل"); setEditModal(false); fetchStudent() }
  }

  async function saveEnrollment() {
    if (!enrollClassroomId || !enrollYearId) { toast.error("اختر القسم والسنة الدراسية"); return }
    const { error } = await api.post("/api/school/enrollments", { studentId: id, classroomId: enrollClassroomId, academicYearId: enrollYearId })
    if (error) toast.error(error)
    else { toast.success("تم التسجيل"); setEnrollModal(false); setEnrollClassroomId(""); setEnrollYearId(""); fetchStudent() }
  }

  async function deleteEnrollment(enrollmentId: string) {
    if (!confirm("سيتم حذف هذا التسجيل. هل أنت متأكد؟")) return
    const { error } = await api.delete(`/api/school/enrollments?id=${enrollmentId}`)
    if (error) toast.error(error)
    else { toast.success("تم الحذف"); fetchStudent() }
  }

  if (loading) return <LoadingPage />
  if (!data) return <Card><p className="text-center py-8 text-gray-500">الطالب غير موجود</p></Card>

  const s = data
  const activeEnrollment = s.enrollments.find((e) => e.status === "ACTIVE" && e.academicYear.isActive)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link href="/school/students" className="hover:text-blue-600">الطلاب</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{s.firstName} {s.lastName}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-2xl">
            {s.firstName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {s.firstName} {s.lastName}
              <Badge variant={s.isActive ? "success" : "danger"}>{s.isActive ? "نشط" : "موقوف"}</Badge>
            </h1>
            <p className="text-sm text-gray-500">
              {s.gender === "MALE" ? "ذكر" : s.gender === "FEMALE" ? "أنثى" : ""}
              {s.studentNumber && ` • رقم: ${s.studentNumber}`}
              {activeEnrollment && ` • ${activeEnrollment.classroom.name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEnrollClassroomId(""); setEnrollYearId(""); setEnrollModal(true) }}>
            <Plus className="h-4 w-4" /> تسجيل في قسم
          </Button>
          <Button onClick={() => {
            setForm({
              firstName: s.firstName, lastName: s.lastName,
              gender: s.gender || "", birthDate: s.birthDate ? s.birthDate.split("T")[0] : "",
              studentNumber: s.studentNumber || "", address: s.address || "", phone: s.phone || "",
              parentName: s.studentParents[0]?.parent.user.name || "",
              parentPhone: s.studentParents[0]?.parent.user.phone || "",
              parentEmail: s.studentParents[0]?.parent.user.email || "",
            })
            setEditModal(true)
          }}>
            <Edit3 className="h-4 w-4" /> تعديل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Info */}
        <Card padding="lg">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><User className="h-5 w-5" /> المعلومات الشخصية</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Hash className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">رقم التسجيل:</span>
              <span className="font-medium">{s.studentNumber || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">الجنس:</span>
              <span className="font-medium">{s.gender === "MALE" ? "ذكر" : s.gender === "FEMALE" ? "أنثى" : "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">تاريخ الميلاد:</span>
              <span className="font-medium">{s.birthDate ? new Date(s.birthDate).toLocaleDateString("ar") : "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">الهاتف:</span>
              <span className="font-medium" dir="ltr">{s.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">العنوان:</span>
              <span className="font-medium">{s.address || "—"}</span>
            </div>
          </div>
        </Card>

        {/* Current Enrollment & Parent */}
        <Card padding="lg">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><BookOpen className="h-5 w-5" /> التسجيل الحالي</h3>
          {activeEnrollment ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium">{activeEnrollment.classroom.name}</p>
                  <p className="text-xs text-gray-500">{activeEnrollment.classroom.level.name}</p>
                </div>
                <Badge variant="success">نشط</Badge>
              </div>
              <Link href={`/school/classrooms/${activeEnrollment.classroom.id}`}>
                <Button variant="secondary" fullWidth size="sm">
                  <ArrowLeft className="h-4 w-4" /> عرض القسم
                </Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <BookOpen className="h-10 w-10 mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">غير مسجل في أي قسم</p>
            </div>
          )}

          <hr className="my-4" />

          <h3 className="font-semibold flex items-center gap-2 mb-3"><Users className="h-5 w-5" /> ولي الأمر</h3>
          {s.studentParents.length > 0 ? (
            <div className="space-y-2">
              {s.studentParents.map((sp) => (
                <div key={sp.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{sp.parent.user.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{sp.parent.user.email}</span>
                    {sp.parent.user.phone && <span dir="ltr">{sp.parent.user.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="info">{sp.relationship || "ولي أمر"}</Badge>
                    {sp.isPrimary && <Badge variant="success">أساسي</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">لا يوجد ولي أمر مسجل</p>
          )}
        </Card>

        {/* Stats */}
        <Card padding="lg">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><TrendingUp className="h-5 w-5" /> إحصائيات سريعة</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-gray-600">إجمالي التسجيلات</span>
              <span className="text-lg font-bold text-blue-700">{s.enrollments.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-gray-600">التسجيلات النشطة</span>
              <span className="text-lg font-bold text-green-700">{s.enrollments.filter((e) => e.status === "ACTIVE").length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-sm text-gray-600">أولياء الأمور</span>
              <span className="text-lg font-bold text-purple-700">{s.studentParents.length}</span>
            </div>
          </div>
        </Card>

        {/* Enrollment History */}
        <Card padding="lg" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" /> سجل التسجيلات ({s.enrollments.length})</h3>
          </div>
          {s.enrollments.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا توجد تسجيلات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-right py-2 px-3">القسم</th>
                    <th className="text-right py-2 px-3">المستوى</th>
                    <th className="text-right py-2 px-3">السنة الدراسية</th>
                    <th className="text-center py-2 px-3">الحالة</th>
                    <th className="text-left py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {s.enrollments.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{e.classroom.name}</td>
                      <td className="py-2 px-3 text-gray-600">{e.classroom.level.name}{e.classroom.stream ? ` / ${e.classroom.stream.name}` : ""}</td>
                      <td className="py-2 px-3 text-gray-500">{e.academicYear.name}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={e.status === "ACTIVE" ? "success" : "warning"}>
                          {e.status === "ACTIVE" ? "نشط" : e.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-left">
                        <button onClick={() => deleteEnrollment(e.id)} className="text-red-400 hover:text-red-600 text-xs">
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="تعديل بيانات الطالب">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="الاسم الأول" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="اسم العائلة" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
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
          <p className="text-sm font-medium text-gray-700">ولي الأمر</p>
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="اسم ولي الأمر" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
           <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="هاتف ولي الأمر" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
          <input className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" dir="ltr" placeholder="البريد الإلكتروني" type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
          <Button fullWidth onClick={saveStudent}>حفظ التعديلات</Button>
        </div>
      </Modal>

      {/* Enroll Modal */}
      <Modal open={enrollModal} onClose={() => setEnrollModal(false)} title="تسجيل في قسم">
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
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Badge, LoadingPage, Pagination, ConfirmModal } from "@/components/ui"
import { Plus, Users, Trash2, BookOpen, ChevronDown, ChevronUp, Phone, Calendar, Hash, X, Upload, Eye, BellRing, ReceiptText, GraduationCap } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import { getDateLocale } from "@/lib/locale"

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
  const locale = useLocale()
  const t = useTranslations("studentsPage")
  const tCommon = useTranslations("common")
  const searchParams = useSearchParams()
  const classroomIdFromQuery = searchParams?.get("classroomId") || ""
  const [students, setStudents] = useState<StudentData[]>([])
  const [total, setTotal] = useState(0)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [classroomFilter, setClassroomFilter] = useState(classroomIdFromQuery)
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const limit = 50
  const [toggleStudent, setToggleStudent] = useState<StudentData | null>(null)
  const [deleteEnrollId, setDeleteEnrollId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])
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
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (classroomFilter) params.set("classroomId", classroomFilter)
    if (statusFilter) params.set("status", statusFilter)
    params.set("page", String(page))
    params.set("limit", String(limit))
    const [sRes, cRes, yRes] = await Promise.all([
      api.get<any>(`/api/school/students?${params}`),
      api.get<Classroom[]>("/api/school/classrooms"),
      api.get<AcademicYear[]>("/api/school/academic-years"),
    ])
    if (sRes.data) { setStudents(sRes.data.students); setTotal(sRes.data.total) }
    if (cRes.data) setClassrooms(cRes.data)
    if (yRes.data) setAcademicYears(yRes.data)
    setLoading(false)
  }, [debouncedSearch, classroomFilter, statusFilter, page])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => { setPage(1) }, [debouncedSearch, classroomFilter, statusFilter])

  useEffect(() => {
    setClassroomFilter(classroomIdFromQuery)
  }, [classroomIdFromQuery])

  function resetForm() { setForm({ firstName: "", lastName: "", gender: "", birthDate: "", studentNumber: "", address: "", phone: "", parentName: "", parentPhone: "", parentEmail: "" }); setEditId(null) }

  async function saveStudent() {
    if (!form.firstName || !form.lastName) { toast.error(t("missingName")); return }
    if (editId) {
      const { error } = await api.put(`/api/school/students/${editId}`, form)
      if (error) toast.error(error)
      else { toast.success(t("editSuccess")); setAddModal(false); resetForm(); fetchData() }
    } else {
      const { error } = await api.post("/api/school/students", form)
      if (error) toast.error(error)
      else { toast.success(t("createSuccess")); setAddModal(false); resetForm(); fetchData() }
    }
  }

  async function toggleActive(s: StudentData) {
    const { error } = await api.put(`/api/school/students/${s.id}`, { isActive: !s.isActive })
    setToggleStudent(null)
    if (error) toast.error(error)
    else { toast.success(s.isActive ? t("disableSuccess") : t("enableSuccess")); fetchData() }
  }

  async function handleConfirmToggle() {
    if (!toggleStudent) return
    await toggleActive(toggleStudent)
  }

  async function deleteEnrollment(id: string) {
    const { error } = await api.delete(`/api/school/enrollments?id=${id}`)
    setDeleteEnrollId(null)
    if (error) toast.error(error)
    else { toast.success(t("deleteSuccess")); fetchData() }
  }

  async function saveEnrollment() {
    if (!enrollClassroomId || !enrollYearId) { toast.error(t("missingEnrollment")); return }
    const { error } = await api.post("/api/school/enrollments", {
      studentId: enrollStudentId, classroomId: enrollClassroomId, academicYearId: enrollYearId,
    })
    if (error) toast.error(error)
    else { toast.success(t("enrollSuccess")); setEnrollModal(false); setEnrollClassroomId(""); setEnrollYearId(""); fetchData() }
  }

  async function handleImport() {
    if (!importText.trim()) { toast.error(t("missingImport")); return }
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
    toast.success(t("importSuccess", { success, failText: fail ? t("importFailSuffix", { fail }) : "" }))
    setImportModal(false)
    setImportText("")
    fetchData()
  }

  if (loading) return <LoadingPage />

  const activeYear = academicYears.find((y) => y.isActive)
  const activeStudents = students.filter((student) => student.isActive).length
  const studentsWithActiveEnrollment = students.filter((student) =>
    student.enrollments?.some((enrollment) => enrollment.status === "ACTIVE" && enrollment.academicYear.isActive)
  ).length
  const studentsWithPrimaryParentPhone = students.filter((student) =>
    student.studentParents?.some((parentLink) => parentLink.isPrimary && !!(parentLink.parent.user.phone || parentLink.parent.phone))
  ).length
  const suspendedStudents = students.filter((student) => !student.isActive).length

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle", { total })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportModal(true)}>
            <Upload className="h-5 w-5" /> {t("import")}
          </Button>
          <Button onClick={() => { resetForm(); setAddModal(true) }}>
            <Plus className="h-5 w-5" /> {t("addStudent")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("shownStudents")}</p>
          <p className="text-2xl font-bold">{students.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("activeFiles")}</p>
          <p className="text-2xl font-bold text-green-600">{activeStudents}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("linkedToActiveClassroom")}</p>
          <p className="text-2xl font-bold text-blue-700">{studentsWithActiveEnrollment}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("parentsReady")}</p>
          <p className="text-2xl font-bold text-amber-600">{studentsWithPrimaryParentPhone}</p>
        </Card>
      </div>

      <Card padding="lg" className="border-blue-100 bg-blue-50">
        <h2 className="text-lg font-semibold text-gray-900">{t("dailyUsageTitle")}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="font-medium text-gray-900">{t("dailyUsage1Title")}</p>
            <p className="mt-2 text-gray-600">{t("dailyUsage1Desc")}</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="font-medium text-gray-900">{t("dailyUsage2Title")}</p>
            <p className="mt-2 text-gray-600">{t("dailyUsage2Desc")}</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="font-medium text-gray-900">{t("dailyUsage3Title")}</p>
            <p className="mt-2 text-gray-600">{t("dailyUsage3Desc")}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {activeYear ? (
            <span className="rounded-full bg-white px-3 py-1 text-blue-700">{t("activeYear", { name: activeYear.name })}</span>
          ) : (
            <span className="rounded-full bg-white px-3 py-1 text-amber-700">{t("noActiveYear")}</span>
          )}
          {suspendedStudents > 0 && (
            <span className="rounded-full bg-white px-3 py-1 text-red-700">{t("suspendedFiles", { count: suspendedStudents })}</span>
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card padding="md" className="mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-56">
            <select value={classroomFilter} onChange={(e) => setClassroomFilter(e.target.value)}
              className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
              <option value="">{t("allClassrooms")}</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.level.name}{c.stream ? ` (${c.stream.name})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
              <option value="">{t("allStatuses")}</option>
              <option value="ACTIVE">{t("active")}</option>
              <option value="INACTIVE">{t("inactive")}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Modals */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={editId ? t("editStudent") : t("addStudentTitle")}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-medium text-gray-700">{t("studentData")}</p>
          <div className="grid grid-cols-2 gap-3">
            <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("firstNamePlaceholder")} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("lastNamePlaceholder")} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
            <option value="">{t("genderPlaceholder")}</option>
            <option value="MALE">{t("male")}</option>
            <option value="FEMALE">{t("female")}</option>
          </select>
          <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} />
          <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("studentNumberPlaceholder")} value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} />
          <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("addressPlaceholder")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("studentPhonePlaceholder")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <hr />
          <p className="text-sm font-medium text-gray-700">{t("parentSection")}</p>
          <input className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`} placeholder={t("parentNamePlaceholder")} value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" dir="ltr" placeholder={t("parentPhonePlaceholder")} value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
          <input className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" dir="ltr" placeholder={t("parentEmailPlaceholder")} type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
          <Button fullWidth onClick={saveStudent}>{editId ? t("saveChanges") : t("addStudentCta")}</Button>
        </div>
      </Modal>

      <Modal open={enrollModal} onClose={() => setEnrollModal(false)} title={t("enrollStudentTitle")}>
        <div className="space-y-4">
          <select value={enrollClassroomId} onChange={(e) => setEnrollClassroomId(e.target.value)}
            className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
            <option value="">{t("selectClassroom")}</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - {c.level.name}{c.stream ? ` (${c.stream.name})` : ""}</option>
            ))}
          </select>
          <select value={enrollYearId} onChange={(e) => setEnrollYearId(e.target.value)}
            className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}>
            <option value="">{t("selectAcademicYear")}</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.isActive ? ` (${t("currentYear")})` : ""}</option>
            ))}
          </select>
          <Button fullWidth onClick={saveEnrollment}>{t("enroll")}</Button>
        </div>
      </Modal>

      <Modal open={importModal} onClose={() => setImportModal(false)} title={t("importTitle")}>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 space-y-1">
            <p className="font-medium">{t("importHow")}</p>
            <p>{t("importDesc1")}</p>
            <p>{t("importDesc2")}</p>
            <p className="font-mono text-xs bg-white p-2 rounded" dir="ltr">الاسم الأول	اسم العائلة	رقم التسجيل	اسم ولي الأمر	هاتف ولي الأمر</p>
            <p className="mt-1">{t("example")}</p>
            <p className="font-mono text-xs bg-white p-2 rounded" dir="ltr">أحمد	ولد محمد	STU-001	خالد ولد أحمد	+222 12 34 56 78</p>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={t("pasteHere")}
            rows={10}
            className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${locale === "ar" ? "text-right" : "text-left"}`}
          />
          <div className="flex gap-2">
            <Button fullWidth onClick={handleImport} disabled={importing}>
              {importing ? t("importing") : t("import")}
            </Button>
            <Button variant="secondary" onClick={() => { setImportModal(false); setImportText("") }}>{tCommon("cancel")}</Button>
          </div>
        </div>
      </Modal>

      {/* Students List */}
      {students.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Users className="h-16 w-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 text-lg mb-1">{t("emptyTitle")}</p>
            <p className="text-gray-400 text-sm mb-4">{t("emptyDesc")}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => { resetForm(); setAddModal(true) }}><Plus className="h-5 w-5" /> {t("addStudent")}</Button>
              <Button variant="secondary" onClick={() => setImportModal(true)}><Upload className="h-5 w-5" /> {t("import")}</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
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
                        {s.isActive ? t("active") : t("inactive")}
                      </Badge>
                      {s.gender && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          {s.gender === "MALE" ? t("male") : t("female")}
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
                      {s.birthDate && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(s.birthDate).toLocaleDateString(getDateLocale(locale))}</span>}
                      <span className="text-xs text-gray-400">{t("activeEnrollmentCount", { count: s.enrollments?.length || 0 })}</span>
                      {s.studentParents?.[0] && (
                        <span className="text-xs text-gray-400">{t("guardianLabel", { name: s.studentParents[0].parent.user.name })}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Link href={`/school/students/${s.id}`} aria-label={t("viewStudent")}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => { setEnrollStudentId(s.id); setEnrollClassroomId(""); setEnrollYearId(""); setEnrollModal(true) }}>
                      <BookOpen className="h-4 w-4" /> {t("enroll")}
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
                      {t("edit")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToggleStudent(s)} className={s.isActive ? "text-red-500" : "text-green-500"} aria-label={s.isActive ? t("disableStudent") : t("enableStudent")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="p-1.5 hover:bg-gray-100 rounded"
                      aria-label={expandedId === s.id ? t("hideDetails") : t("showDetails")}
                      aria-expanded={expandedId === s.id}
                      aria-controls={`student-details-${s.id}`}>
                      {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: Enrollments + Parents */}
                {expandedId === s.id && (
                  <div id={`student-details-${s.id}`} className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Enrollments */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">{t("enrollments", { count: s.enrollments?.length || 0 })}</h4>
                      {(!s.enrollments || s.enrollments.length === 0) ? (
                        <p className="text-sm text-gray-400">{t("noEnrollments")}</p>
                      ) : (
                        <div className="space-y-2">
                          {s.enrollments.map((e) => (
                            <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-purple-500" />
                                <span className="text-sm font-medium">{e.classroom.name}</span>
                                <span className="text-xs text-gray-400">- {e.classroom.level.name}</span>
                                <Badge variant={e.status === "ACTIVE" ? "success" : "warning"}>{e.status === "ACTIVE" ? t("active") : e.status}</Badge>
                                <span className="text-xs text-gray-400">{e.academicYear.name}</span>
                              </div>
                              <button onClick={() => setDeleteEnrollId(e.id)} className="text-red-300 hover:text-red-500 p-1" aria-label={t("deleteEnrollmentTitle")}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Parents */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">{t("parents", { count: s.studentParents?.length || 0 })}</h4>
                      {(!s.studentParents || s.studentParents.length === 0) ? (
                        <p className="text-sm text-gray-400">{t("noParents")}</p>
                      ) : (
                        <div className="space-y-2">
                          {s.studentParents.map((sp) => (
                            <div key={sp.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div>
                                <span className="text-sm font-medium">{sp.parent.user.name}</span>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                  {sp.parent.user.phone && <span dir="ltr">{sp.parent.user.phone}</span>}
                                  <Badge variant="info">{sp.relationship || t("guardianDefault")}</Badge>
                                  {sp.isPrimary && <Badge variant="success">{t("primary")}</Badge>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                      <h4 className="text-sm font-medium text-gray-800">{t("quickAccessTitle")}</h4>
                      <p className="mt-1 text-xs text-gray-500">
                        {t("quickAccessDesc")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/school/students/${s.id}`}>
                          <Button variant="secondary" size="sm">
                            <Eye className="h-4 w-4" /> {t("studentFile")}
                          </Button>
                        </Link>
                        {activeEnrollment && (
                          <Link href={`/school/results?classroomId=${activeEnrollment.classroom.id}`}>
                            <Button variant="ghost" size="sm">
                              <GraduationCap className="h-4 w-4" /> {t("classResults")}
                            </Button>
                          </Link>
                        )}
                        {activeEnrollment && (
                          <Link href={`/school/invoices?classroomId=${activeEnrollment.classroom.id}`}>
                            <Button variant="ghost" size="sm">
                              <ReceiptText className="h-4 w-4" /> {t("classFees")}
                            </Button>
                          </Link>
                        )}
                        {activeEnrollment && (
                          <Link href={`/school/notifications?audienceType=CLASSROOM&classroomId=${activeEnrollment.classroom.id}`}>
                            <Button variant="ghost" size="sm">
                              <BellRing className="h-4 w-4" /> {t("classParentsNotify")}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
          </div>
          <Pagination page={page} total={total} limit={limit} onChange={setPage} />
        </>
      )}
    </div>

    <ConfirmModal
      open={!!toggleStudent}
      onClose={() => setToggleStudent(null)}
      onConfirm={() => void handleConfirmToggle()}
      title={toggleStudent?.isActive ? t("toggleDisableTitle") : t("toggleEnableTitle")}
      message={toggleStudent?.isActive ? t("toggleDisableMessage") : t("toggleEnableMessage")}
      confirmText={toggleStudent?.isActive ? t("disableStudent") : t("enableStudent")}
      cancelText={tCommon("cancel")}
      variant={toggleStudent?.isActive ? "danger" : "primary"}
    />

    <ConfirmModal
      open={!!deleteEnrollId}
      onClose={() => setDeleteEnrollId(null)}
      onConfirm={() => void deleteEnrollment(deleteEnrollId!)}
      title={t("deleteEnrollmentTitle")}
      message={t("deleteEnrollmentMessage")}
      confirmText={tCommon("delete")}
      cancelText={tCommon("cancel")}
      variant="danger"
    />
  </>
  )
}

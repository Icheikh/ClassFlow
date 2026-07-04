"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { api } from "@/lib/api"
import { Button, Card, Badge, Modal, Input, LoadingPage } from "@/components/ui"
import { ArrowLeft, BookOpen, School, Calendar, Phone, Mail, ChevronRight, Wallet, Clock, Link as LinkIcon } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type DetailData = {
  teacher: { id: string; phone: string | null; user: { id: string; email: string; name: string; phone: string | null; isActive: boolean } }
  assignments: { id: string; subject: { nameAr: string; code: string | null }; classroom: { id: string; name: string; level: { name: string } }; hourlyRate: number | null; weeklyHours: number | null }[]
  recentLessons: { id: string; title: string; date: string; status: string; subject: { nameAr: string }; classroom: { name: string } }[]
  stats: { assignments: number; lessonsThisMonth: number; totalStudents: number }
}

export default function TeacherDetailPage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editAssign, setEditAssign] = useState<{ id: string; hourlyRate: string; weeklyHours: string } | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    const { data } = await api.get<DetailData>(`/api/school/teachers/${id}`)
    if (data) setData(data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveAssignmentRate() {
    if (!editAssign) return
    const { error } = await api.put("/api/school/teacher-assignments", {
      id: editAssign.id,
      hourlyRate: editAssign.hourlyRate,
      weeklyHours: editAssign.weeklyHours,
    })
    if (error) toast.error(error)
    else { toast.success("تم الحفظ"); setEditAssign(null); fetchData() }
  }

  if (loading) return <LoadingPage />
  if (!data) return <Card><p className="text-center py-8 text-gray-500">الأستاذ غير موجود</p></Card>

  const t = data.teacher

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link href="/school/teachers" className="hover:text-blue-600">الأساتذة</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{t.user.name}</span>
      </div>

      <Modal open={!!editAssign} onClose={() => setEditAssign(null)} title="تحديد أجر وساعات التكليف">
        <div className="space-y-4">
          <Input label="الأجر للساعة (أوقية)" type="number" value={editAssign?.hourlyRate || ""}
            onChange={(e) => setEditAssign((prev) => prev ? { ...prev, hourlyRate: e.target.value } : null)} placeholder="250" />
          <Input label="عدد الساعات أسبوعياً" type="number" value={editAssign?.weeklyHours || ""}
            onChange={(e) => setEditAssign((prev) => prev ? { ...prev, weeklyHours: e.target.value } : null)} placeholder="4" />
          <Button fullWidth onClick={saveAssignmentRate}>حفظ</Button>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
            {t.user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {t.user.name}
              <Badge variant={t.user.isActive ? "success" : "danger"}>
                {t.user.isActive ? "نشط" : "موقوف"}
              </Badge>
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {t.user.email}</span>
              {t.user.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {t.user.phone}</span>}
            </div>
          </div>
        </div>
        <Link href="/school/teachers">
          <Button variant="secondary">                <ArrowLeft className="h-4 w-4" /> رجوع</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.assignments}</p><p className="text-xs text-gray-500">مواد</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><Calendar className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.lessonsThisMonth}</p><p className="text-xs text-gray-500">درس هذا الشهر</p></div>
          </div>
        </Card>
      </div>

      {/* Classrooms */}
      <Card padding="md" className="mb-6">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2"><School className="h-4 w-4" /> الأقسام التي يدرس فيها</h3>
        <div className="flex flex-wrap gap-2">
          {data.assignments.map((a) => (
            <Link key={a.id} href={`/school/classrooms/${a.classroom.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors">
              <LinkIcon className="h-3.5 w-3.5" />
              {a.classroom.name} - {a.classroom.level.name}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignments */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" /> المواد ({data.assignments.length})</h3>
          </div>
          {data.assignments.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا توجد تكليفات</p>
          ) : (
            <div className="space-y-2">
              {data.assignments.map((a) => (
                <div key={a.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">{a.subject.nameAr}</span>
                      <Link href={`/school/classrooms/${a.classroom.id}`} className="text-xs text-blue-600 hover:underline">
                        {a.classroom.name} - {a.classroom.level.name}
                      </Link>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() =>
                      setEditAssign({ id: a.id, hourlyRate: String(a.hourlyRate || ""), weeklyHours: String(a.weeklyHours || "") })
                    }>
                      <Wallet className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {a.hourlyRate ? (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        {a.hourlyRate} MRU /س
                      </span>
                    ) : (
                      <span className="text-gray-300 cursor-pointer" onClick={() =>
                        setEditAssign({ id: a.id, hourlyRate: "", weeklyHours: "" })
                      }>تحديد الأجر</span>
                    )}
                    {a.weeklyHours && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {a.weeklyHours} س/أسبوع
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Lessons */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> آخر الدروس ({data.recentLessons.length})</h3>
          </div>
          {data.recentLessons.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا توجد دروس بعد</p>
          ) : (
            <div className="space-y-2">
              {data.recentLessons.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>{l.subject.nameAr}</span><span>·</span>
                      <span>{l.classroom.name}</span><span>·</span>
                      <span>{new Date(l.date).toLocaleDateString("ar")}</span>
                    </div>
                  </div>
                  <Badge variant={l.status === "SUBMITTED" ? "success" : l.status === "DRAFT" ? "warning" : "default"} className="shrink-0">
                    {l.status === "SUBMITTED" ? "مقدم" : l.status === "DRAFT" ? "مسودة" : l.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

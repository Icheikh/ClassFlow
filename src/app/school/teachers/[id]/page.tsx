"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { api } from "@/lib/api"
import { Button, Card, Badge, Modal, Input, LoadingPage } from "@/components/ui"
import { ArrowRight, BookOpen, School, Calendar, Clock, Phone, Mail, DollarSign, ChevronRight, Wallet } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type DetailData = {
  teacher: { id: string; phone: string | null; hourlyRate: number | null; user: { id: string; email: string; name: string; phone: string | null; isActive: boolean } }
  assignments: { id: string; subject: { nameAr: string; code: string | null }; classroom: { id: string; name: string; level: { name: string } } }[]
  recentLessons: { id: string; title: string; date: string; status: string; subject: { nameAr: string }; classroom: { name: string } }[]
  stats: { assignments: number; lessonsThisMonth: number; totalStudents: number }
  payroll: { hourlyRate: number | null; totalHours: number | null; estimatedEarnings: number | null }
}

export default function TeacherDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRateModal, setShowRateModal] = useState(false)
  const [rateInput, setRateInput] = useState("")

  const fetchData = useCallback(async () => {
    const { data } = await api.get<DetailData>(`/api/school/teachers/${id}`)
    if (data) { setData(data); setRateInput(String(data.teacher.hourlyRate || "")) }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveRate() {
    const { error } = await api.put("/api/school/teachers", { id, hourlyRate: rateInput })
    if (error) toast.error(error)
    else { toast.success("تم حفظ الأجر"); setShowRateModal(false); fetchData() }
  }

  if (loading) return <LoadingPage />
  if (!data) return <Card><p className="text-center py-8 text-gray-500">الأستاذ غير موجود</p></Card>

  const t = data.teacher

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link href="/school/teachers" className="hover:text-blue-600">الأساتذة</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{data.teacher.user.name}</span>
      </div>

      <Modal open={showRateModal} onClose={() => setShowRateModal(false)} title="تحديد الأجر للساعة">
        <div className="space-y-4">
          <Input label="الأجر للساعة (أوقية)" type="number" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="250" />
          <Button fullWidth onClick={saveRate}>حفظ</Button>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
            {data.teacher.user.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {data.teacher.user.name}
              <Badge variant={data.teacher.user.isActive ? "success" : "danger"}>
                {data.teacher.user.isActive ? "نشط" : "موقوف"}
              </Badge>
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {data.teacher.user.email}</span>
              {data.teacher.user.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {data.teacher.user.phone}</span>}
            </div>
          </div>
        </div>
        <Link href="/school/teachers">
          <Button variant="secondary"><ArrowRight className="h-4 w-4" /> رجوع</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.assignments}</p><p className="text-xs text-gray-500">تكليفات</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><Calendar className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.lessonsThisMonth}</p><p className="text-xs text-gray-500">درس هذا الشهر</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><School className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.totalStudents}</p><p className="text-xs text-gray-500">إجمالي الطلاب</p></div>
          </div>
        </Card>
        <Card padding="md" className="cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3" onClick={() => setShowRateModal(true)}>
            <div className="p-2 bg-amber-50 rounded-lg">
              {data.payroll.hourlyRate ? <Wallet className="h-5 w-5 text-amber-600" /> : <DollarSign className="h-5 w-5 text-gray-400" />}
            </div>
            <div>
              {data.payroll.hourlyRate ? (
                <>
                  <p className="text-2xl font-bold text-amber-700">{data.payroll.hourlyRate} <span className="text-xs font-normal">/س</span></p>
                  <p className="text-xs text-gray-500">{data.payroll.totalHours} ساعة هذا الشهر ≈ {data.payroll.estimatedEarnings}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">لم يحدد</p>
                  <p className="text-xs text-blue-500">اضغط لتحديد الأجر</p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Rest of the page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" /> التكليفات ({data.assignments.length})</h3>
          </div>
          {data.assignments.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا توجد تكليفات</p>
          ) : (
            <div className="space-y-2">
              {data.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <div>
                    <span className="font-medium text-sm">{a.subject.nameAr}</span>
                    {a.subject.code && <span className="text-xs text-gray-400 mr-2">({a.subject.code})</span>}
                  </div>
                  <Link href={`/school/classrooms/${a.classroom.id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <School className="h-3.5 w-3.5" />
                    {a.classroom.name} - {a.classroom.level.name}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

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
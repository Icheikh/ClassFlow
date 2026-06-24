"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingPage } from "@/components/ui"
import { ArrowLeft, Users, BookOpen, GraduationCap, Clock, UserCheck, UserX, Calendar, Phone, Mail, ChevronRight } from "lucide-react"
import Link from "next/link"

type DetailData = {
  classroom: {
    id: string; name: string; capacity: number
    level: { name: string; stage: { name: string } }
    stream: { name: string } | null
  }
  enrollments: { id: string; student: { id: string; firstName: string; lastName: string; studentNumber: string | null; gender: string | null } }[]
  teacherAssignments: { id: string; subject: { nameAr: string }; teacher: { user: { name: string } } }[]
  recentLessons: { id: string; title: string; date: string; status: string; subject: { nameAr: string }; teacher: { user: { name: string } } }[]
  stats: { totalStudents: number; totalTeachers: number; presentToday: number; absentToday: number }
}

export default function ClassroomDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<DetailData>(`/api/school/classrooms/${id}`).then(({ data }) => {
      if (data) setData(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <LoadingPage />
  if (!data) return <Card><p className="text-center py-8 text-gray-500">القسم غير موجود</p></Card>

  const c = data.classroom

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link href="/school/classrooms" className="hover:text-blue-600">الأقسام</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{c.name}</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {c.name}
            <Badge variant="info">{c.level.stage.name} - {c.level.name}</Badge>
            {c.stream && <Badge>{c.stream.name}</Badge>}
          </h1>
          <p className="text-sm text-gray-500 mt-1">السعة: {c.capacity} طالب | المسجلون: {data.stats.totalStudents}</p>
        </div>
        <Link href="/school/classrooms">
          <Button variant="secondary">                <ArrowLeft className="h-4 w-4" /> رجوع</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.totalStudents}</p><p className="text-xs text-gray-500">الطلاب</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><BookOpen className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.totalTeachers}</p><p className="text-xs text-gray-500">أساتذة</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.presentToday}</p><p className="text-xs text-gray-500">حاضر اليوم</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><UserX className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold">{data.stats.absentToday}</p><p className="text-xs text-gray-500">غائب اليوم</p></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> الطلاب ({data.enrollments.length})</h3>
          </div>
          {data.enrollments.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا يوجد طلاب مسجلين</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {data.enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
                      {e.student.firstName.charAt(0)}
                    </div>
                    <span className="text-sm">{e.student.firstName} {e.student.lastName}</span>
                  </div>
                  <span className="text-xs text-gray-400">{e.student.studentNumber || ""}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Teachers */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><GraduationCap className="h-5 w-5" /> الأساتذة ({data.teacherAssignments.length})</h3>
          </div>
          {data.teacherAssignments.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا يوجد أساتذة مكلفين</p>
          ) : (
            <div className="space-y-2">
              {data.teacherAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">{a.teacher.user.name}</span>
                  </div>
                  <Badge variant="info">{a.subject.nameAr}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Lessons */}
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" /> آخر الدروس ({data.recentLessons.length})</h3>
          </div>
          {data.recentLessons.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">لا توجد دروس مسجلة بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-right py-2 px-3">العنوان</th>
                    <th className="text-right py-2 px-3">المادة</th>
                    <th className="text-right py-2 px-3">الأستاذ</th>
                    <th className="text-right py-2 px-3">التاريخ</th>
                    <th className="text-center py-2 px-3">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLessons.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{l.title}</td>
                      <td className="py-2 px-3">{l.subject.nameAr}</td>
                      <td className="py-2 px-3 text-gray-600">{l.teacher.user.name}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs">{new Date(l.date).toLocaleDateString("ar")}</td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={l.status === "SUBMITTED" ? "success" : l.status === "DRAFT" ? "warning" : "default"}>
                          {l.status === "SUBMITTED" ? "مقدم" : l.status === "DRAFT" ? "مسودة" : l.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
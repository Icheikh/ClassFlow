"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import { Card, Badge, Button, LoadingPage } from "@/components/ui"
import { ClipboardCheck, BookOpen, GraduationCap, Clock, Calendar, UserCheck, ShieldCheck, AlertTriangle } from "lucide-react"
import Link from "next/link"

type Assignment = {
  id: string
  classroom: { id: string; name: string; level: { name: string }; stream: { name: string } | null }
  subject: { id: string; nameAr: string }
  hourlyRate: number | null
}

type AttendanceStatus = {
  checkedIn: boolean
  checkIn: string | null
  checkOut: string | null
  status: string | null
  lessonCount: number
}

export default function TeacherPage() {
  const { data: session } = useSession()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const [aRes, attRes] = await Promise.all([
      api.get<Assignment[]>("/api/teacher/classes"),
      api.get<AttendanceStatus>("/api/teacher-attendance"),
    ])
    if (aRes.data) setAssignments(aRes.data)
    if (attRes.data) setAttendance(attRes.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <LoadingPage />

  const uniqueClassrooms = [...new Map(assignments.map((a) => [a.classroom.id, a.classroom])).values()]
  const attendanceBadge = attendance?.status === "PRESENT"
    ? { label: "حضور مؤكد", variant: "success" as const, icon: ShieldCheck }
    : attendance?.status === "ABSENT"
      ? { label: "مسجل غياب", variant: "danger" as const, icon: AlertTriangle }
      : attendance?.status === "LATE"
        ? { label: "مسجل تأخر", variant: "warning" as const, icon: AlertTriangle }
        : attendance?.status === "EXCUSED"
          ? { label: "بعذر", variant: "info" as const, icon: ShieldCheck }
          : { label: "بانتظار تأكيد الإدارة", variant: "default" as const, icon: Clock }
  const AttendanceIcon = attendanceBadge.icon

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">مرحباً، {session?.user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            <Calendar className="h-4 w-4 inline" /> {new Date().toLocaleDateString("ar-MR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={attendanceBadge.variant}>
            <AttendanceIcon className="h-3 w-3" /> {attendanceBadge.label}
          </Badge>
        </div>
      </div>

      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <p className="text-sm text-blue-700">
          يتم تأكيد حضور الأساتذة يومياً من قبل مدير الدروس أو مدير المدرسة، وهذه الصفحة تعرض حالة اليوم فقط.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BookOpen className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{assignments.length}</p><p className="text-xs text-gray-500">التكليفات</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><UserCheck className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{uniqueClassrooms.length}</p><p className="text-xs text-gray-500">الأقسام</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><GraduationCap className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-2xl font-bold">{attendance?.lessonCount || 0}</p><p className="text-xs text-gray-500">دروس اليوم</p></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-sm font-bold">{attendanceBadge.label}</p>
              <p className="text-xs text-gray-500">حالة الحضور اليوم</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding="lg" className="mb-6">
        <h2 className="font-semibold mb-4">تكليفاتي</h2>
        {assignments.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">لا توجد تكليفات للسنة الدراسية الحالية</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
                    {a.subject.nameAr.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{a.subject.nameAr}</p>
                    <p className="text-xs text-gray-500">{a.classroom.name} - {a.classroom.level.name}{a.classroom.stream ? ` (${a.classroom.stream.name})` : ""}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/teacher/attendance?classroomId=${a.classroom.id}&subjectId=${a.subject.id}`}>
                    <Button variant="ghost" size="sm"><ClipboardCheck className="h-4 w-4" /></Button>
                  </Link>
                  <Link href={`/teacher/lessons?classroomId=${a.classroom.id}&subjectId=${a.subject.id}`}>
                    <Button variant="ghost" size="sm"><BookOpen className="h-4 w-4" /></Button>
                  </Link>
                  <Link href={`/teacher/grades?classroomId=${a.classroom.id}&subjectId=${a.subject.id}`}>
                    <Button variant="ghost" size="sm"><GraduationCap className="h-4 w-4" /></Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/teacher/attendance" className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">دفتر الغياب</h2>
          <p className="text-sm text-gray-500">سجل غياب التلاميذ وأرسل الإشعارات</p>
        </Link>

        <Link href="/teacher/lessons" className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">دفتر الدروس</h2>
          <p className="text-sm text-gray-500">سجل عناوين الدروس والواجبات والمدة</p>
        </Link>

        <Link href="/teacher/grades" className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <GraduationCap className="h-6 w-6 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">دفتر النقاط</h2>
          <p className="text-sm text-gray-500">أدخل النتائج واحسب المعدلات</p>
        </Link>
      </div>
    </div>
  )
}

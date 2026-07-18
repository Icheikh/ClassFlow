"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import { LoadingPage, Card } from "@/components/ui"
import { Clock, BookOpen, User, School } from "lucide-react"
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

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
]

export default function TeacherSchedulePage() {
  const { data: session } = useSession()
  const user = session?.user as any

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const res = await api.get<ScheduleEntry[]>(`/api/school/schedules?teacherId=${user.id}`)
      if (res.data) setEntries(res.data)
      else toast.error(res.error || "فشل تحميل الجدول")
      setLoading(false)
    }
    void load()
  }, [user])

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">جدول الحصص</h1>
        <p className="text-sm text-gray-500">برنامج الحصص الأسبوعي الخاص بك</p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500">لا توجد حصص مسجلة لك</p>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]" role="grid" aria-label="جدول الحصص الأسبوعي">
            <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-px bg-gray-200 rounded-t-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-medium text-sm text-gray-500 text-center">الوقت</div>
              {DAYS.map((day, i) => (
                <div key={i} className="bg-gray-100 p-3 font-medium text-sm text-center">{day}</div>
              ))}
            </div>

            {TIME_SLOTS.slice(0, -1).map((time) => (
              <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] gap-px bg-gray-200">
                <div className="bg-white p-2 text-xs text-gray-400 text-center flex items-center justify-center">
                  {time}
                </div>
                {DAYS.map((_, dayIdx) => {
                  const cellEntries = entries.filter(
                    (e) => e.dayOfWeek === dayIdx && e.startTime === time
                  )
                  return (
                    <div key={dayIdx} className="bg-white min-h-[60px] p-1">
                      {cellEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-green-50 border border-green-200 rounded p-1.5 text-xs"
                        >
                          <div className="flex items-center gap-1 text-green-700 font-medium">
                            <BookOpen className="h-3 w-3" />
                            {entry.subject.nameAr}
                          </div>
                          <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                            <School className="h-2.5 w-2.5" />
                            {entry.classroom.name}
                          </div>
                          <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {entry.startTime}-{entry.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

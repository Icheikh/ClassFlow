"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingPage } from "@/components/ui"
import { Wallet, Clock, Calendar, TrendingUp, Filter } from "lucide-react"
import Link from "next/link"

type PayrollAssignRow = {
  id: string; teacherId: string; teacherName: string
  subject: string; classroom: string
  hourlyRate: number | null; weeklyHours: number | null
  totalHours: number; lessonCount: number; allLessonsCount: number; earnings: number | null
}

type PayrollData = {
  teachers: { name: string; assignments: PayrollAssignRow[]; totalHours: number; totalEarnings: number }[]
  rows: PayrollAssignRow[]
  totalEarnings: number; grandTotalHours: number
  month: string; totalTeachers: number
}

export default function PayrollPage() {
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)

  useEffect(() => {
    setLoading(true)
    api.get<PayrollData>(`/api/school/payroll?month=${month}`).then(({ data }) => {
      if (data) setData(data)
      setLoading(false)
    })
  }, [month])

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الرواتب</h1>
          <p className="text-sm text-gray-500">مستحقات الأساتذة - يحتسب فقط من الدروس في أيام الحضور المؤكدة من مدير الدروس</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>

      {(!data || data.teachers.length === 0) ? (
        <Card>
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد بيانات لهذا الشهر</p>
            <p className="text-xs text-gray-400 mt-1">تأكد من تسجيل حضور الأساتذة وتسجيل الدروس</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-2xl font-bold">{data.grandTotalHours}</p><p className="text-xs text-gray-500">إجمالي الساعات</p></div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-2xl font-bold text-green-700">{data.totalEarnings.toLocaleString()} MRU</p><p className="text-xs text-gray-500">إجمالي المستحقات</p></div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div>
                <div><p className="text-2xl font-bold">{data.totalTeachers}</p><p className="text-xs text-gray-500">أساتذة</p></div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg"><Filter className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-2xl font-bold">
                    {data.rows.reduce((s, r) => s + (r.allLessonsCount - r.lessonCount), 0)}
                  </p>
                  <p className="text-xs text-gray-500">دروس بدون حضور</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {data.teachers.map((t) => (
              <Card key={t.name} padding="lg">
                <div className="flex items-center justify-between mb-3">
                  <Link href={`/school/teachers/${t.assignments[0]?.teacherId}`} className="font-semibold text-blue-700 hover:underline">
                    {t.name}
                  </Link>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{t.totalHours} ساعة</span>
                    <span className="font-bold text-green-700">{t.totalEarnings.toLocaleString()} أوقية</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-400 text-xs">
                        <th className="text-right py-2 px-2">المادة</th>
                        <th className="text-right py-2 px-2">القسم</th>
                        <th className="text-center py-2 px-2">الأجر/س</th>
                        <th className="text-center py-2 px-2">دروس</th>
                        <th className="text-center py-2 px-2">ساعات</th>
                        <th className="text-center py-2 px-2 text-green-700">المستحق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.assignments.map((r) => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium">{r.subject}</td>
                          <td className="py-2 px-2 text-gray-600">{r.classroom}</td>
                          <td className="py-2 px-2 text-center text-amber-700">{r.hourlyRate || <span className="text-gray-300">—</span>}</td>
                          <td className="py-2 px-2 text-center">
                            {r.lessonCount}
                            {r.allLessonsCount !== r.lessonCount && (
                              <span className="text-xs text-gray-400 mr-1">({r.allLessonsCount})</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-medium">{r.totalHours}</td>
                          <td className="py-2 px-2 text-center font-bold text-green-700">
                            {r.earnings !== null ? r.earnings.toLocaleString() : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>

          <Card padding="md" className="mt-4 bg-blue-50 border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>ملاحظة:</strong> يتم احتساب المستحقات من الدروس المسجلة فقط في الأيام التي تم فيها تسجيل حضور الأستاذ من قبل مدير الدروس.
              الرقم بين قوسين يشير إلى إجمالي الدروس المسجلة (غير المحتسبة بسبب عدم تسجيل الحضور).
            </p>
          </Card>
        </>
      )}
    </div>
  )
}

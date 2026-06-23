"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingPage } from "@/components/ui"
import { Wallet, Clock, Calendar, TrendingUp } from "lucide-react"
import Link from "next/link"

type PayrollAssignRow = {
  id: string; teacherId: string; teacherName: string
  subject: string; classroom: string
  hourlyRate: number | null; weeklyHours: number | null
  totalHours: number; lessonCount: number; earnings: number | null
}

type PayrollData = {
  teachers: { name: string; assignments: PayrollAssignRow[]; totalHours: number; totalEarnings: number }[]
  rows: PayrollAssignRow[]
  totalEarnings: number; grandTotalHours: number
}

export default function PayrollPage() {
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PayrollData>("/api/school/payroll").then(({ data }) => {
      if (data) setData(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الرواتب</h1>
          <p className="text-sm text-gray-500">مستحقات الأساتذة حسب كل تكليف لهذا الشهر</p>
        </div>
      </div>

      {(!data || data.teachers.length === 0) ? (
        <Card>
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد بيانات لهذا الشهر</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
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
                <div><p className="text-2xl font-bold">{data.teachers.length}</p><p className="text-xs text-gray-500">أساتذة</p></div>
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
                        <th className="text-center py-2 px-2">س/أسبوع</th>
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
                          <td className="py-2 px-2 text-center">{r.weeklyHours || <span className="text-gray-300">—</span>}</td>
                          <td className="py-2 px-2 text-center">{r.lessonCount}</td>
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
        </>
      )}
    </div>
  )
}
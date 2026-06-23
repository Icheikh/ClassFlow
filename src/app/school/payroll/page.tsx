"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Badge, LoadingPage } from "@/components/ui"
import { Wallet, DollarSign, Clock, Calendar, Download } from "lucide-react"
import Link from "next/link"

type PayrollRow = {
  id: string; name: string; hourlyRate: number | null
  totalHours: number; lessonCount: number; earnings: number | null
}

export default function PayrollPage() {
  const [data, setData] = useState<{ rows: PayrollRow[]; totalEarnings: number; grandTotalHours: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/api/school/payroll").then(({ data }) => {
      if (data) setData(data as any)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الرواتب</h1>
          <p className="text-sm text-gray-500">مستحقات الأساتذة لهذا الشهر</p>
        </div>
      </div>

      {(!data || data.rows.length === 0) ? (
        <Card>
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد بيانات</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-2xl font-bold">{data.grandTotalHours}</p><p className="text-xs text-gray-500">إجمالي الساعات</p></div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-2xl font-bold text-green-700">{data.totalEarnings.toLocaleString()}</p><p className="text-xs text-gray-500">إجمالي المستحقات</p></div>
              </div>
            </Card>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div>
                <div><p className="text-2xl font-bold">{data.rows.filter((r) => r.lessonCount > 0).length}</p><p className="text-xs text-gray-500">أساتذة بدروس</p></div>
              </div>
            </Card>
          </div>

          {/* Table */}
          <Card padding="lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-right py-3 px-3">الأستاذ</th>
                    <th className="text-center py-3 px-3">الأجر/ساعة</th>
                    <th className="text-center py-3 px-3">دروس</th>
                    <th className="text-center py-3 px-3">ساعات</th>
                    <th className="text-center py-3 px-3 text-green-700 font-medium">المستحق</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">
                        <Link href={`/school/teachers/${r.id}`} className="text-blue-600 hover:underline">{r.name}</Link>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {r.hourlyRate ? (
                          <span className="text-amber-700 font-medium">{r.hourlyRate}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">{r.lessonCount}</td>
                      <td className="py-3 px-3 text-center font-medium">{r.totalHours}</td>
                      <td className="py-3 px-3 text-center font-bold text-green-700">
                        {r.earnings !== null ? r.earnings.toLocaleString() : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {!r.hourlyRate && <Badge variant="warning">بدون أجر</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
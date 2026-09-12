"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { LoadingPage } from "@/components/ui"
import { getLocaleDirection } from "@/i18n/config"
import { getMonthLabel } from "@/lib/finance"

type SlipRow = {
  subject: string
  classroom: string
  hourlyRate: number | null
  confirmedHours: number
  compensationHours: number
  totalHours: number
  earnings: number | null
  unassigned?: boolean
}

type SlipTeacher = {
  teacherId: string
  name: string
  assignments: SlipRow[]
  totalHours: number
  totalEarnings: number
}

type SlipRecord = { teacherId: string; status: string; paidAt: string | null }

export default function PayrollSlipPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <SlipContent />
    </Suspense>
  )
}

function SlipContent() {
  const t = useTranslations("payrollSlip")
  const locale = useLocale()
  const direction = getLocaleDirection(locale)
  const searchParams = useSearchParams()
  const teacherId = searchParams?.get("teacherId") || ""
  const month = searchParams?.get("month") || ""

  const [teacher, setTeacher] = useState<SlipTeacher | null>(null)
  const [record, setRecord] = useState<SlipRecord | null>(null)
  const [schoolName, setSchoolName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!teacherId || !month) {
      setError("Missing teacherId/month")
      setLoading(false)
      return
    }
    async function load() {
      const { data, error: apiError } = await api.get<{
        teachers: SlipTeacher[]
        records: SlipRecord[]
      }>(`/api/school/payroll?month=${month}`)
      if (apiError || !data) {
        setError(apiError || "Load failed")
        setLoading(false)
        return
      }
      const found = data.teachers.find((item) => item.teacherId === teacherId)
      if (!found) {
        setError("Teacher not found")
        setLoading(false)
        return
      }
      setTeacher(found)
      setRecord(data.records.find((r) => r.teacherId === teacherId) || null)
      try {
        const session = await (await import("next-auth/react")).getSession()
        setSchoolName((session?.user as { school?: { name?: string } } | undefined)?.school?.name || "")
      } catch {
        setSchoolName("")
      }
      setLoading(false)
    }
    void load()
  }, [teacherId, month])

  useEffect(() => {
    if (teacher) {
      const timer = setTimeout(() => window.print(), 500)
      return () => clearTimeout(timer)
    }
  }, [teacher])

  if (loading) return <LoadingPage />
  if (error || !teacher) return <div className="text-center py-12 text-red-500">{error || "Not found"}</div>

  const isPaid = record?.status === "PAID"

  return (
    <div className="min-h-screen bg-white" dir={direction}>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
        >
          {t("print")}
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-8">
        <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
          {schoolName && <h1 className="text-xl font-bold">{schoolName}</h1>}
          <h2 className="text-lg font-bold mt-1">{t("title")} — {getMonthLabel(month, locale)}</h2>
        </div>

        <div className="border border-gray-300 rounded p-4 mb-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-500">{t("teacher")}:</span>
            <span className="font-medium">{teacher.name}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-500">{t("period")}:</span>
            <span>{getMonthLabel(month, locale)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-500">{t("status")}:</span>
            <span className={isPaid ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
              {isPaid ? t("paid") : t("pending")}
            </span>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="text-right py-2 font-medium">المادة</th>
              <th className="text-right py-2 font-medium">القسم</th>
              <th className="text-center py-2 font-medium">سعر الساعة</th>
              <th className="text-center py-2 font-medium">الساعات</th>
              <th className="text-center py-2 font-medium">المستحق</th>
            </tr>
          </thead>
          <tbody>
            {teacher.assignments.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">{row.subject}</td>
                <td className="py-2 text-gray-600">{row.classroom}</td>
                <td className="py-2 text-center">{row.hourlyRate != null ? row.hourlyRate.toLocaleString() : "—"}</td>
                <td className="py-2 text-center font-medium">{row.totalHours}</td>
                <td className="py-2 text-center font-medium">
                  {row.earnings != null ? row.earnings.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-2 border-gray-900 rounded p-4 mb-6">
          <div className="flex justify-between text-sm text-gray-500">
            <span>{t("totalHours")}:</span>
            <span className="font-bold text-gray-900">{teacher.totalHours}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-medium">{t("totalEarnings")}:</span>
            <span className="text-2xl font-bold text-green-700">
              {teacher.totalEarnings.toLocaleString()} MRU
            </span>
          </div>
        </div>

        <div className="flex justify-between text-sm text-gray-500 mt-12">
          <div className="text-center">
            <div className="border-t border-gray-400 w-36 mt-12 pt-1">{t("signatureDirector")}</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-36 mt-12 pt-1">{t("signatureTeacher")}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

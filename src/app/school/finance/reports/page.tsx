"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Card, LoadingPage, Badge, Select, Button } from "@/components/ui"
import { api } from "@/lib/api"
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Download,
  DollarSign, FileText, Calendar,
} from "lucide-react"
import toast from "react-hot-toast"
import { getMonthLabel } from "@/lib/finance"

type ReportData = {
  period: { from: string; to: string; label: string }
  summary: { totalCollected: number; totalPayments: number; averagePayment: number }
  byDay: { day: string; collected: number; count: number }[]
  byFee: { feeId: string | null; feeName: string; amount: number; count: number }[]
  byClassroom: { classroomName: string; levelName: string; collected: number; count: number }[]
  byMethod: { method: string; label: string; amount: number; count: number }[]
  byStudent: { studentId: string; firstName: string; lastName: string; paid: number; paymentCount: number }[]
  outstanding: {
    byStudent: { studentId: string; firstName: string; lastName: string; totalInvoiced: number; totalPaid: number; balance: number }[]
    byFee: { feeName: string; totalInvoiced: number; totalPaid: number; balance: number }[]
    aging: { bucket: string; count: number; balance: number }[]
    totalOutstanding: number
  }
}

export default function FinanceReportsPage() {
  const t = useTranslations("financeReports")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("monthly")
  const [activeTab, setActiveTab] = useState<"revenue" | "outstanding">("revenue")

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: result, error } = await api.get<ReportData>(`/api/finance/reports?period=${period}`)
    if (error) { toast.error(error); setLoading(false); return }
    if (result) setData(result)
    setLoading(false)
  }, [period])

  useEffect(() => { void loadData() }, [loadData])

  if (loading) return <LoadingPage />
  if (!data) return <div className="text-center py-12 text-red-500">{t("loadError")}</div>

  const { summary, byDay, byFee, byClassroom, byMethod, byStudent, outstanding } = data
  const agingLabels: Record<string, string> = {
    current: t("agingCurrent"),
    overdue_30: t("aging30"),
    overdue_60: t("aging60"),
    overdue_90: t("aging90"),
    no_due_date: t("agingNoDue"),
  }
  const agingColors: Record<string, string> = {
    current: "text-green-600",
    overdue_30: "text-amber-600",
    overdue_60: "text-orange-600",
    overdue_90: "text-red-600",
    no_due_date: "text-gray-400",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={period}
            onChange={setPeriod}
            options={[
              { value: "daily", label: t("daily") },
              { value: "weekly", label: t("weekly") },
              { value: "monthly", label: t("monthly") },
            ]}
          />
          <Button
            variant="secondary"
            onClick={() => window.open(`/api/finance/export?format=pdf&period=${period}`, "_blank")}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(`/api/finance/export?format=excel&period=${period}`, "_blank")}
          >
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-3">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("totalCollected")}</p>
              <p className="text-2xl font-bold text-green-700">{summary.totalCollected.toLocaleString()} MRU</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("totalPaymentsLabel")}</p>
              <p className="text-2xl font-bold text-blue-700">{summary.totalPayments}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-3">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("averagePayment")}</p>
              <p className="text-2xl font-bold text-purple-700">{summary.averagePayment.toLocaleString()} MRU</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "revenue" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          {t("revenueTab")}
        </button>
        <button
          onClick={() => setActiveTab("outstanding")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "outstanding" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          {t("outstandingTab")}
          {outstanding.totalOutstanding > 0 && (
            <Badge variant="danger" className="ms-2">{outstanding.totalOutstanding.toLocaleString()}</Badge>
          )}
        </button>
      </div>

      {activeTab === "revenue" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue by Day */}
          <Card padding="lg">
            <h2 className="font-semibold mb-4">{t("revenueByDay")}</h2>
            {byDay.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
            ) : (
              <div className="space-y-3">
                {byDay.map((d) => {
                  const maxVal = Math.max(...byDay.map((x) => x.collected), 1)
                  const pct = Math.round((d.collected / maxVal) * 100)
                  return (
                    <div key={d.day}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{d.day}</span>
                        <span className="font-medium">{d.collected.toLocaleString()} MRU ({d.count})</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-green-500 rounded-full h-2" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Revenue by Fee */}
          <Card padding="lg">
            <h2 className="font-semibold mb-4">{t("revenueByFee")}</h2>
            {byFee.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
            ) : (
              <div className="space-y-3">
                {byFee.sort((a, b) => b.amount - a.amount).map((f) => (
                  <div key={f.feeId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{f.feeName}</p>
                      <p className="text-xs text-gray-400">{f.count} {t("payments")}</p>
                    </div>
                    <span className="font-semibold text-green-700">{f.amount.toLocaleString()} MRU</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Revenue by Classroom */}
          <Card padding="lg">
            <h2 className="font-semibold mb-4">{t("revenueByClassroom")}</h2>
            {byClassroom.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
            ) : (
              <div className="space-y-3">
                {byClassroom.sort((a, b) => b.collected - a.collected).map((c) => (
                  <div key={c.classroomName} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{c.classroomName}</p>
                      <p className="text-xs text-gray-400">{c.levelName} — {c.count} {t("payments")}</p>
                    </div>
                    <span className="font-semibold text-green-700">{c.collected.toLocaleString()} MRU</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Revenue by Method */}
          <Card padding="lg">
            <h2 className="font-semibold mb-4">{t("revenueByMethod")}</h2>
            {byMethod.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
            ) : (
              <div className="space-y-4">
                {byMethod.map((m) => {
                  const total = byMethod.reduce((s, x) => s + x.amount, 0)
                  const pct = total > 0 ? Math.round((m.amount / total) * 100) : 0
                  const methodColors: Record<string, string> = { CASH: "bg-green-500", BANKILY: "bg-orange-500", MASRVI: "bg-teal-500", BANK_TRANSFER: "bg-blue-500", CHEQUE: "bg-purple-500" }
                  return (
                    <div key={m.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{m.label}</span>
                        <span>{m.amount.toLocaleString()} MRU ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`rounded-full h-2 ${methodColors[m.method] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Top Paying Students */}
          <Card padding="lg" className="lg:col-span-2">
            <h2 className="font-semibold mb-4">{t("topPayingStudents")}</h2>
            {byStudent.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{t("noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left pb-2 font-medium">{t("student")}</th>
                      <th className="text-right pb-2 font-medium">{t("payments")}</th>
                      <th className="text-right pb-2 font-medium">{t("totalPaid")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStudent.map((s) => (
                      <tr key={s.studentId} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{s.firstName} {s.lastName}</td>
                        <td className="py-2.5 text-right text-gray-500">{s.paymentCount}</td>
                        <td className="py-2.5 text-right font-semibold text-green-700">{s.paid.toLocaleString()} MRU</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "outstanding" && (
        <div className="space-y-6">
          {/* Aging Summary */}
          <div className="grid gap-4 md:grid-cols-5">
            {outstanding.aging.map((a) => (
              <Card key={a.bucket} padding="md">
                <p className="text-sm text-gray-500">{agingLabels[a.bucket] || a.bucket}</p>
                <p className={`text-xl font-bold ${agingColors[a.bucket] || "text-gray-700"}`}>{a.balance.toLocaleString()} MRU</p>
                <p className="text-xs text-gray-400">{a.count} {t("invoices")}</p>
              </Card>
            ))}
          </div>

          {/* Outstanding by Student */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t("outstandingByStudent")}</h2>
              <Badge variant="danger">{outstanding.totalOutstanding.toLocaleString()} MRU</Badge>
            </div>
            {outstanding.byStudent.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-green-600 font-medium">{t("noOutstanding")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left pb-2 font-medium">{t("student")}</th>
                      <th className="text-right pb-2 font-medium">{t("invoiced")}</th>
                      <th className="text-right pb-2 font-medium">{t("paid")}</th>
                      <th className="text-right pb-2 font-medium">{t("balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.byStudent.map((s) => (
                      <tr key={s.studentId} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{s.firstName} {s.lastName}</td>
                        <td className="py-2.5 text-right text-gray-500">{s.totalInvoiced.toLocaleString()}</td>
                        <td className="py-2.5 text-right text-green-600">{s.totalPaid.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-bold text-red-600">{s.balance.toLocaleString()} MRU</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Outstanding by Fee */}
          <Card padding="lg">
            <h2 className="font-semibold mb-4">{t("outstandingByFee")}</h2>
            {outstanding.byFee.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">{t("noOutstandingFees")}</p>
            ) : (
              <div className="space-y-3">
                {outstanding.byFee.sort((a, b) => b.balance - a.balance).map((f) => (
                  <div key={f.feeName} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{f.feeName}</p>
                      <p className="text-xs text-gray-400">{t("invoiced")}: {f.totalInvoiced.toLocaleString()} | {t("paid")}: {f.totalPaid.toLocaleString()}</p>
                    </div>
                    <span className="font-bold text-red-600">{f.balance.toLocaleString()} MRU</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

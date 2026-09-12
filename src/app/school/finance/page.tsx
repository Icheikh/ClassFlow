"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, LoadingPage, Badge } from "@/components/ui"
import { api } from "@/lib/api"
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Receipt,
  CreditCard, Clock, ArrowUpRight, ArrowDownRight, Users, Wallet,
  FileText, CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"
import { getMonthLabel } from "@/lib/finance"
import { useLocale } from "next-intl"

type FinanceDashboard = {
  summary: {
    totalFees: number
    activeStudentFees: number
    totalStudents: number
    enrolledStudents: number
    collectedThisMonth: number
    collectedLastMonth: number
    paymentsThisMonth: number
    paymentsLastMonth: number
    totalCollectedAllTime: number
    totalPaymentsAllTime: number
    totalInvoicedThisMonth: number
    pendingAmount: number
    collectedOnMonthInvoices: number
  }
  invoices: {
    total: number
    paid: number
    pending: number
    overdue: number
    byStatus: { status: string; count: number; amount: number }[]
  }
  payments: {
    thisMonth: number
    lastMonth: number
    byMethod: { method: string; label: string; amount: number; count: number }[]
    recent: { id: string; amount: number; method: string; receiptNumber: string | null; date: string; studentName: string; feeName: string | null }[]
  }
  feesBreakdown: { feeId: string | null; feeName: string; amount: number; count: number }[]
  monthlyTrend: { month: string; collected: number; count: number }[]
  topDebtors: { studentId: string; firstName: string; lastName: string; totalInvoiced: number; totalPaid: number; balance: number }[]
}

export default function FinanceDashboardPage() {
  const t = useTranslations("financeDashboard")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [data, setData] = useState<FinanceDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await api.get<FinanceDashboard>("/api/finance/dashboard")
      if (error) { toast.error(error); setLoading(false); return }
      if (data) setData(data)
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) return <LoadingPage />
  if (!data) return <div className="text-center py-12 text-red-500">{t("loadError")}</div>

  const { summary, invoices, payments, feesBreakdown, monthlyTrend, topDebtors } = data
  const monthChange = summary.collectedLastMonth > 0
    ? Math.round(((summary.collectedThisMonth - summary.collectedLastMonth) / summary.collectedLastMonth) * 100)
    : 0
  const collectionRate = summary.totalInvoicedThisMonth > 0
    ? Math.round(((summary.collectedOnMonthInvoices || 0) / summary.totalInvoicedThisMonth) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-3">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("collectedThisMonth")}</p>
              <p className="text-2xl font-bold text-green-700">{summary.collectedThisMonth.toLocaleString()} MRU</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            {monthChange >= 0 ? (
              <span className="text-green-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" />+{monthChange}%
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-0.5">
                <ArrowDownRight className="h-3 w-3" />{monthChange}%
              </span>
            )}
            <span className="text-gray-400">{t("vsLastMonth")}</span>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("invoicedThisMonth")}</p>
              <p className="text-2xl font-bold text-blue-700">{summary.totalInvoicedThisMonth.toLocaleString()} MRU</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-blue-600">{collectionRate}%</span>
            <span className="text-gray-400">{t("collectionRate")}</span>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-3">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("pendingAmount")}</p>
              <p className="text-2xl font-bold text-amber-700">{summary.pendingAmount.toLocaleString()} MRU</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-amber-600">{invoices.pending + invoices.overdue}</span>
            <span className="text-gray-400">{t("invoicesPending")}</span>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-50 p-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("overdueInvoices")}</p>
              <p className="text-2xl font-bold text-red-700">{invoices.overdue}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-gray-400">{t("requiresAction")}</span>
          </div>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("totalCollectedAllTime")}</p>
              <p className="text-xl font-bold text-purple-700">{summary.totalCollectedAllTime.toLocaleString()} MRU</p>
              <p className="text-xs text-gray-400">{summary.totalPaymentsAllTime} {t("totalPayments")}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-3">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("activeFees")}</p>
              <p className="text-xl font-bold text-indigo-700">{summary.totalFees}</p>
              <p className="text-xs text-gray-400">{summary.activeStudentFees} {t("studentFeeAssignments")}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-50 p-3">
              <Users className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("enrolledStudents")}</p>
              <p className="text-xl font-bold text-teal-700">{summary.enrolledStudents}</p>
              <p className="text-xs text-gray-400">{summary.totalStudents} {t("totalStudentsLabel")}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Trend */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t("monthlyTrend")}</h2>
            <Link href="/school/finance/reports" className="text-sm text-blue-600 hover:underline">{tCommon("viewAll")}</Link>
          </div>
          <div className="space-y-3">
            {monthlyTrend.map((m) => {
              const maxAmount = Math.max(...monthlyTrend.map((x) => x.collected), 1)
              const pct = Math.round((m.collected / maxAmount) * 100)
              return (
                <div key={m.month}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{getMonthLabel(m.month, locale)}</span>
                    <span className="font-medium">{m.collected.toLocaleString()} MRU</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{m.count} {t("payments")}</p>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Payment Methods */}
        <Card padding="lg">
          <h2 className="font-semibold mb-4">{t("paymentMethods")}</h2>
          {payments.byMethod.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t("noPaymentsThisMonth")}</p>
          ) : (
            <div className="space-y-4">
              {payments.byMethod.map((m) => {
                const total = payments.byMethod.reduce((s, x) => s + x.amount, 0)
                const pct = total > 0 ? Math.round((m.amount / total) * 100) : 0
                const methodColors: Record<string, string> = {
                  CASH: "bg-green-500",
                  BANKILY: "bg-orange-500",
                  MASRVI: "bg-teal-500",
                  BANK_TRANSFER: "bg-blue-500",
                  CHEQUE: "bg-purple-500",
                }
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${methodColors[m.method] || "bg-gray-400"}`} />
                        <span className="font-medium">{m.label}</span>
                      </div>
                      <span>{m.amount.toLocaleString()} MRU ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`rounded-full h-2 ${methodColors[m.method] || "bg-gray-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{m.count} {t("transactions")}</p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Fees Breakdown */}
        <Card padding="lg">
          <h2 className="font-semibold mb-4">{t("feesBreakdown")}</h2>
          {feesBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t("noFeesCollected")}</p>
          ) : (
            <div className="space-y-3">
              {feesBreakdown.sort((a, b) => b.amount - a.amount).map((f) => (
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

        {/* Top Debtors */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t("topDebtors")}</h2>
            <Badge variant="danger">{topDebtors.length}</Badge>
          </div>
          {topDebtors.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-300 mb-2" />
              <p className="text-sm text-gray-500">{t("noDebtors")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topDebtors.map((d) => (
                <Link
                  key={d.studentId}
                  href={`/school/students/${d.studentId}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{d.firstName} {d.lastName}</p>
                    <p className="text-xs text-gray-400">{t("invoiced")}: {d.totalInvoiced.toLocaleString()} | {t("paid")}: {d.totalPaid.toLocaleString()}</p>
                  </div>
                  <span className="font-bold text-red-600">{d.balance.toLocaleString()} MRU</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Payments */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t("recentPayments")}</h2>
          <Link href="/school/invoices" className="text-sm text-blue-600 hover:underline">{tCommon("viewAll")}</Link>
        </div>
        {payments.recent.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">{t("noPaymentsRecorded")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left pb-2 font-medium">{t("date")}</th>
                  <th className="text-left pb-2 font-medium">{t("student")}</th>
                  <th className="text-left pb-2 font-medium">{t("fee")}</th>
                  <th className="text-left pb-2 font-medium">{t("method")}</th>
                  <th className="text-left pb-2 font-medium">{t("receipt")}</th>
                  <th className="text-right pb-2 font-medium">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.recent.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2.5 text-gray-500">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="py-2.5 font-medium">{p.studentName}</td>
                    <td className="py-2.5 text-gray-500">{p.feeName || "—"}</td>
                    <td className="py-2.5">
                      <Badge variant="default">{p.method}</Badge>
                    </td>
                    <td className="py-2.5 text-gray-400 font-mono text-xs">{p.receiptNumber || "—"}</td>
                    <td className="py-2.5 text-right font-semibold text-green-700">{p.amount.toLocaleString()} MRU</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card padding="lg">
        <h2 className="font-semibold mb-4">{t("quickActions")}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Link href="/school/invoices" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <Receipt className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-sm">{t("manageInvoices")}</p>
              <p className="text-xs text-gray-400">{invoices.total} {t("thisMonth")}</p>
            </div>
          </Link>
          <Link href="/school/fees" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <CreditCard className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-sm">{t("manageFees")}</p>
              <p className="text-xs text-gray-400">{summary.totalFees} {t("active")}</p>
            </div>
          </Link>
          <Link href="/school/payroll" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <Wallet className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-medium text-sm">{t("payroll")}</p>
              <p className="text-xs text-gray-400">{t("viewReport")}</p>
            </div>
          </Link>
          <Link href="/school/finance/reports" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-sm">{t("financialReports")}</p>
              <p className="text-xs text-gray-400">{t("detailedAnalysis")}</p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  )
}

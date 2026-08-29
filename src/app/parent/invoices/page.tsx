"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Card, LoadingPage, Select } from "@/components/ui"
import { Receipt, DollarSign, CheckCircle2, AlertTriangle } from "lucide-react"

type InvoiceItem = {
  id: string
  student: { id: string; firstName: string; lastName: string }
  feeName: string
  classroom: string
  month: string
  amount: number
  paidAmount: number
  remaining: number
  status: string
  dueDate: string | null
  payments: { amount: number; date: string; method: string }[]
}

type InvoiceSummary = { total: number; paid: number; remaining: number }

function formatMonth(month: string) {
  if (!month) return "—"
  const [year, m] = month.split("-")
  const months = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
  return `${months[parseInt(m, 10) - 1]} ${year}`
}

export default function ParentInvoicesPage() {
  const t = useTranslations("parentPage")
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [summary, setSummary] = useState<InvoiceSummary | null>(null)
  const [children, setChildren] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [selectedChild, setSelectedChild] = useState("")

  useEffect(() => {
    async function load() {
      const { data } = await api.get<{ children: { id: string; firstName: string; lastName: string }[] }>("/api/parent/children")
      if (data?.children) {
        setChildren(data.children)
        if (data.children[0]) setSelectedChild(data.children[0].id)
      }
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await api.get<{ invoices: InvoiceItem[]; summary: InvoiceSummary }>("/api/parent/invoices")
      if (data) {
        const filtered = selectedChild
          ? data.invoices.filter((inv) => inv.student.id === selectedChild)
          : data.invoices
        setInvoices(filtered)
        if (selectedChild) {
          const total = filtered.reduce((s, i) => s + i.amount, 0)
          const paid = filtered.reduce((s, i) => s + i.paidAmount, 0)
          setSummary({ total, paid, remaining: Math.max(0, total - paid) })
        } else {
          setSummary(data.summary)
        }
      }
    }
    void load()
  }, [selectedChild])

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الفواتير والمدفوعات</h1>
        <p className="text-sm text-gray-500">متابعة رسوم الدراسة والمدفوعات</p>
      </div>

      {children.length > 1 && (
        <Card padding="md">
          <Select
            label="اختر الابن"
            value={selectedChild}
            onChange={setSelectedChild}
            options={[{ value: "", label: "جميع الأبناء" }, ...children.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))]}
          />
        </Card>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card padding="md">
            <div className="flex items-center gap-2 text-blue-600">
              <Receipt className="h-5 w-5" />
              <span className="text-sm font-medium">إجمالي الفواتير</span>
            </div>
            <p className="mt-2 text-3xl font-bold">{summary.total.toLocaleString()} MRU</p>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">المدفوع</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-green-600">{summary.paid.toLocaleString()} MRU</p>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">المتبقي</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-red-600">{summary.remaining.toLocaleString()} MRU</p>
          </Card>
        </div>
      )}

      <Card padding="lg">
        <h2 className="mb-4 text-lg font-semibold">قائمة الفواتير</h2>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-gray-500">
                  <th className="pb-3 font-medium">الابن</th>
                  <th className="pb-3 font-medium">الرسوم</th>
                  <th className="pb-3 font-medium">الشهر</th>
                  <th className="pb-3 font-medium">المبلغ</th>
                  <th className="pb-3 font-medium">المدفوع</th>
                  <th className="pb-3 font-medium">المتبقي</th>
                  <th className="pb-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-3">{inv.student.firstName} {inv.student.lastName}</td>
                    <td className="py-3">{inv.feeName}</td>
                    <td className="py-3">{formatMonth(inv.month)}</td>
                    <td className="py-3 font-medium">{inv.amount.toLocaleString()} MRU</td>
                    <td className="py-3 text-green-600">{inv.paidAmount.toLocaleString()} MRU</td>
                    <td className="py-3 text-red-600">{inv.remaining.toLocaleString()} MRU</td>
                    <td className="py-3">
                      <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "danger"}>
                        {inv.status === "PAID" ? "مدفوع" : inv.status === "PARTIAL" ? "جزئي" : "معلق"}
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
  )
}

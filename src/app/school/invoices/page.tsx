"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Input, Select, Badge, LoadingPage } from "@/components/ui"
import { DollarSign, Search } from "lucide-react"
import toast from "react-hot-toast"

type Invoice = {
  id: string
  month: string
  amount: number
  status: string
  dueDate: string | null
  student: { id: string; firstName: string; lastName: string; studentNumber: string | null }
  fee: { id: string; name: string; frequency: string }
  classroom: { id: string; name: string }
  payments: { id: string; amount: number; date: string; method: string }[]
}

type Classroom = { id: string; name: string }

const monthOptions = [
  { value: "", label: "كل الأشهر" },
  { value: "2026-09", label: "سبتمبر 2026" },
  { value: "2026-10", label: "أكتوبر 2026" },
  { value: "2026-11", label: "نوفمبر 2026" },
  { value: "2026-12", label: "ديسمبر 2026" },
  { value: "2027-01", label: "يناير 2027" },
  { value: "2027-02", label: "فبراير 2027" },
  { value: "2027-03", label: "مارس 2027" },
  { value: "2027-04", label: "أبريل 2027" },
  { value: "2027-05", label: "مايو 2027" },
  { value: "2027-06", label: "يونيو 2027" },
]

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" }> = {
  PAID: { label: "مدفوع", variant: "success" },
  PARTIAL: { label: "مدفوع جزئياً", variant: "warning" },
  PENDING: { label: "غير مدفوع", variant: "danger" },
  CANCELLED: { label: "ملغي", variant: "default" },
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [classroomId, setClassroomId] = useState("")
  const [month, setMonth] = useState("")

  // Payment modal
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("CASH")
  const [paying, setPaying] = useState(false)

  async function loadClassrooms() {
    const { data } = await api.get<Classroom[]>("/api/school/classrooms")
    setClassrooms(data || [])
  }

  async function loadInvoices() {
    setLoading(true)
    const q = new URLSearchParams()
    if (classroomId) q.set("classroomId", classroomId)
    if (month) q.set("month", month)
    const { data } = await api.get<Invoice[]>(`/api/school/invoices?${q}`)
    setInvoices(data || [])
    setLoading(false)
  }

  useEffect(() => { loadClassrooms() }, [])
  useEffect(() => { loadInvoices() }, [classroomId, month])

  async function recordPayment() {
    if (!payInvoiceId || !payAmount) { toast.error("المبلغ مطلوب"); return }
    const invoice = invoices.find((i) => i.id === payInvoiceId)
    if (!invoice) return
    setPaying(true)
    const { error } = await api.post("/api/school/payments", {
      amount: parseFloat(payAmount),
      method: payMethod,
      studentId: invoice.student.id,
      feeId: invoice.fee.id,
      invoiceId: payInvoiceId,
    })
    if (error) toast.error(error)
    else {
      toast.success("تم تسجيل الدفعة")
      setPayInvoiceId(null)
      loadInvoices()
    }
    setPaying(false)
  }

  const totalDue = invoices.reduce((s, i) => s + (i.status === "PAID" ? 0 : i.amount), 0)
  const totalPaid = invoices.reduce((s, i) => s + i.payments.reduce((ps, p) => ps + p.amount, 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الفواتير</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card padding="md">
          <p className="text-sm text-gray-400">إجمالي الفواتير</p>
          <p className="text-2xl font-bold">{invoices.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">المدفوع</p>
          <p className="text-2xl font-bold text-green-600">{totalPaid} MRU</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">المتبقي</p>
          <p className="text-2xl font-bold text-red-600">{totalDue} MRU</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Select
              label="القسم"
              value={classroomId}
              onChange={setClassroomId}
              options={[{ value: "", label: "جميع الأقسام" }, ...classrooms.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="flex-1">
            <Select label="الشهر" value={month} onChange={setMonth} options={monthOptions} />
          </div>
          <Button variant="secondary" onClick={loadInvoices}><Search className="h-4 w-4" /> بحث</Button>
        </div>
      </Card>

      {/* Invoices Table */}
      {loading ? <LoadingPage /> : invoices.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <DollarSign className="h-16 w-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500">لا توجد فواتير</p>
            <p className="text-gray-400 text-sm">اختر قسماً وشهراً لعرض الفواتير</p>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right">
                <th className="pb-3 font-medium text-gray-500">الطالب</th>
                <th className="pb-3 font-medium text-gray-500">الرسم</th>
                <th className="pb-3 font-medium text-gray-500">الشهر</th>
                <th className="pb-3 font-medium text-gray-500">المبلغ</th>
                <th className="pb-3 font-medium text-gray-500">الحالة</th>
                <th className="pb-3 font-medium text-gray-500">المدفوع</th>
                <th className="pb-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = statusLabels[inv.status] || { label: inv.status, variant: "default" as const }
                const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
                return (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3">
                      <span className="font-medium">{inv.student.firstName} {inv.student.lastName}</span>
                      {inv.student.studentNumber && (
                        <span className="text-xs text-gray-400 mr-2">({inv.student.studentNumber})</span>
                      )}
                    </td>
                    <td className="py-3">{inv.fee.name}</td>
                    <td className="py-3">{inv.month}</td>
                    <td className="py-3 font-medium">{inv.amount} MRU</td>
                    <td className="py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                    <td className="py-3">{paid} MRU</td>
                    <td className="py-3">
                      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <Button size="sm" onClick={() => {
                          setPayInvoiceId(inv.id)
                          setPayAmount(String(inv.amount - paid))
                          setPayMethod("CASH")
                        }}>
                          <DollarSign className="h-4 w-4" /> تسديد
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {payInvoiceId && (() => {
        const inv = invoices.find((i) => i.id === payInvoiceId)
        if (!inv) return null
        return (
          <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={() => setPayInvoiceId(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-[90vw] max-w-md" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">تسديد فاتورة</h2>
              <div className="space-y-3 mb-4 text-sm">
                <p><span className="text-gray-400">الطالب:</span> {inv.student.firstName} {inv.student.lastName}</p>
                <p><span className="text-gray-400">الرسم:</span> {inv.fee.name}</p>
                <p><span className="text-gray-400">الشهر:</span> {inv.month}</p>
                <p><span className="text-gray-400">المبلغ المتبقي:</span> {inv.amount - inv.payments.reduce((s, p) => s + p.amount, 0)} MRU</p>
              </div>
              <div className="space-y-4">
                <Input label="المبلغ" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <Select
                  label="طريقة الدفع"
                  value={payMethod}
                  onChange={setPayMethod}
                  options={[
                    { value: "CASH", label: "نقداً" },
                    { value: "BANK_TRANSFER", label: "تحويل بنكي" },
                    { value: "CHEQUE", label: "شيك" },
                  ]}
                />
                <div className="flex gap-2">
                  <Button fullWidth loading={paying} onClick={recordPayment}>تأكيد الدفع</Button>
                  <Button variant="secondary" fullWidth onClick={() => setPayInvoiceId(null)}>إلغاء</Button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

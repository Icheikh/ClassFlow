"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Input, Select, Badge, LoadingPage } from "@/components/ui"
import { DollarSign, Search, BellRing, FilePlus2, ReceiptText } from "lucide-react"
import toast from "react-hot-toast"
import { generateRecentMonthOptions, getMonthLabel } from "@/lib/finance"

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
  ...generateRecentMonthOptions(18),
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
  const [generating, setGenerating] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(monthOptions[1]?.value || "")
  const [generateClassroomId, setGenerateClassroomId] = useState("")
  const [generateDueDate, setGenerateDueDate] = useState("")

  // Filters
  const [classroomId, setClassroomId] = useState("")
  const [month, setMonth] = useState("")

  // Payment modal
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("CASH")
  const [paying, setPaying] = useState(false)

  const loadClassrooms = useCallback(async () => {
    const { data } = await api.get<Classroom[]>("/api/school/classrooms")
    setClassrooms(data || [])
  }, [])

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (classroomId) q.set("classroomId", classroomId)
    if (month) q.set("month", month)
    const { data } = await api.get<Invoice[]>(`/api/school/invoices?${q}`)
    setInvoices(data || [])
    setLoading(false)
  }, [classroomId, month])

  useEffect(() => { void loadClassrooms() }, [loadClassrooms])
  useEffect(() => { void loadInvoices() }, [loadInvoices])

  async function recordPayment() {
    if (!payInvoiceId || !payAmount) { toast.error("المبلغ مطلوب"); return }
    const invoice = invoices.find((i) => i.id === payInvoiceId)
    if (!invoice) return
    setPaying(true)
    const { data, error } = await api.post<{ receiptNumber?: string }>("/api/school/payments", {
      amount: parseFloat(payAmount),
      method: payMethod,
      studentId: invoice.student.id,
      feeId: invoice.fee.id,
      invoiceId: payInvoiceId,
    })
    if (error) toast.error(error)
    else {
      toast.success(data?.receiptNumber ? `تم تسجيل الدفعة - ${data.receiptNumber}` : "تم تسجيل الدفعة")
      setPayInvoiceId(null)
      loadInvoices()
    }
    setPaying(false)
  }

  async function generateInvoices() {
    if (!generateMonth) {
      toast.error("اختر الشهر")
      return
    }
    setGenerating(true)
    const { data, error } = await api.post<{
      created: number
      skippedExisting: number
      skippedByFrequency: number
      total: number
    }>("/api/school/invoices/generate", {
      month: generateMonth,
      classroomId: generateClassroomId || null,
      dueDate: generateDueDate || null,
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success(`تم توليد ${data?.created || 0} فاتورة لشهر ${getMonthLabel(generateMonth)}`)
      if (month === generateMonth || !month) {
        void loadInvoices()
      }
    }
    setGenerating(false)
  }

  async function sendReminders() {
    if (!month) {
      toast.error("اختر الشهر أولاً لإرسال التنبيهات")
      return
    }

    setSendingReminders(true)
    const { data, error } = await api.post<{ queued: number; invoices: number }>("/api/school/invoices/reminders", {
      month,
      classroomId: classroomId || null,
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success(`تم تجهيز ${data?.queued || 0} تنبيهًا للواتساب`)
    }
    setSendingReminders(false)
  }

  const totalDue = invoices.reduce((s, i) => s + (i.status === "PAID" ? 0 : i.amount), 0)
  const totalPaid = invoices.reduce((s, i) => s + i.payments.reduce((ps, p) => ps + p.amount, 0), 0)
  const unpaidCount = invoices.filter((i) => i.status === "PENDING").length
  const partialCount = invoices.filter((i) => i.status === "PARTIAL").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الفواتير</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" loading={sendingReminders} onClick={sendReminders}>
            <BellRing className="h-4 w-4" /> تنبيهات المتأخرات
          </Button>
          <Button loading={generating} onClick={generateInvoices}>
            <FilePlus2 className="h-4 w-4" /> توليد شهري
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
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
        <Card padding="md">
          <p className="text-sm text-gray-400">غير مدفوع</p>
          <p className="text-2xl font-bold text-red-600">{unpaidCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">مدفوع جزئياً</p>
          <p className="text-2xl font-bold text-amber-600">{partialCount}</p>
        </Card>
      </div>

      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <div className="grid gap-4 md:grid-cols-4">
          <Select
            label="شهر التوليد"
            value={generateMonth}
            onChange={setGenerateMonth}
            options={monthOptions.filter((option) => option.value)}
          />
          <Select
            label="القسم (اختياري)"
            value={generateClassroomId}
            onChange={setGenerateClassroomId}
            options={[{ value: "", label: "كل الأقسام" }, ...classrooms.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Input
            label="تاريخ الاستحقاق (اختياري)"
            type="date"
            value={generateDueDate}
            onChange={(e) => setGenerateDueDate(e.target.value)}
          />
          <div className="flex items-end">
            <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-blue-700 w-full">
              الرسوم الشهرية تولد كل شهر. الرسوم السنوية تولد مرة واحدة في السنة، ورسوم المرة الواحدة لا تتكرر.
            </div>
          </div>
        </div>
      </Card>

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
                          <ReceiptText className="h-4 w-4" /> تسديد
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

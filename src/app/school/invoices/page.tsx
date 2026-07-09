"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
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

type GenerateInvoicesResponse = {
  created: number
  skippedExisting: number
  skippedByFrequency: number
  total: number
}

type ReminderResponse = {
  createdCampaign: boolean
  campaignId?: string
  recipients: number
  invoices: number
}

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
  const searchParams = useSearchParams()
  const initialClassroomId = searchParams?.get("classroomId") || ""
  const initialMonth = searchParams?.get("month") || ""
  const initialStatus = searchParams?.get("status") || ""
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(monthOptions[1]?.value || "")
  const [generateClassroomId, setGenerateClassroomId] = useState("")
  const [generateDueDate, setGenerateDueDate] = useState("")
  const [lastGeneration, setLastGeneration] = useState<GenerateInvoicesResponse | null>(null)
  const [lastReminder, setLastReminder] = useState<ReminderResponse | null>(null)

  const [classroomId, setClassroomId] = useState(initialClassroomId)
  const [month, setMonth] = useState(initialMonth)
  const [status, setStatus] = useState(initialStatus)

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
    if (status) q.set("status", status)
    const { data } = await api.get<Invoice[]>(`/api/school/invoices?${q}`)
    setInvoices(data || [])
    setLoading(false)
  }, [classroomId, month, status])

  useEffect(() => {
    void loadClassrooms()
  }, [loadClassrooms])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  useEffect(() => {
    setClassroomId(initialClassroomId)
    setMonth(initialMonth)
    setStatus(initialStatus)
  }, [initialClassroomId, initialMonth, initialStatus])

  async function recordPayment() {
    if (!payInvoiceId || !payAmount) {
      toast.error("المبلغ مطلوب")
      return
    }

    const invoice = invoices.find((item) => item.id === payInvoiceId)
    if (!invoice) return

    setPaying(true)
    const { data, error } = await api.post<{ receiptNumber?: string }>("/api/school/payments", {
      amount: parseFloat(payAmount),
      method: payMethod,
      studentId: invoice.student.id,
      feeId: invoice.fee.id,
      invoiceId: payInvoiceId,
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success(data?.receiptNumber ? `تم تسجيل الدفعة - ${data.receiptNumber}` : "تم تسجيل الدفعة")
      setPayInvoiceId(null)
      void loadInvoices()
    }

    setPaying(false)
  }

  async function generateInvoices() {
    if (!generateMonth) {
      toast.error("اختر الشهر")
      return
    }

    setGenerating(true)
    const { data, error } = await api.post<GenerateInvoicesResponse>("/api/school/invoices/generate", {
      month: generateMonth,
      classroomId: generateClassroomId || null,
      dueDate: generateDueDate || null,
    })

    if (error) {
      toast.error(error)
    } else {
      setLastGeneration(data || null)
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
    const { data, error } = await api.post<ReminderResponse>("/api/school/invoices/reminders", {
      month,
      classroomId: classroomId || null,
    })

    if (error) {
      toast.error(error)
    } else {
      setLastReminder(data || null)
      toast.success(
        data?.createdCampaign
          ? `تم إنشاء حملة اعتماد لعدد ${data?.recipients || 0} مستلمين`
          : "لا توجد فواتير متأخرة لهذا الاختيار"
      )
    }

    setSendingReminders(false)
  }

  const totalDue = invoices.reduce((sum, invoice) => sum + (invoice.status === "PAID" ? 0 : invoice.amount), 0)
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0), 0)
  const unpaidCount = invoices.filter((invoice) => invoice.status === "PENDING").length
  const partialCount = invoices.filter((invoice) => invoice.status === "PARTIAL").length
  const selectedMonthLabel = month ? getMonthLabel(month) : "كل الأشهر"
  const selectedClassroomLabel = classrooms.find((item) => item.id === classroomId)?.name || "جميع الأقسام"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الفواتير والتحصيل</h1>
        <p className="mt-2 text-sm text-gray-500">
          توليد الفواتير يكون أولاً، ثم تظهر هنا للفحص والتحصيل، وبعدها يمكن إنشاء حملة تذكير للمتأخرات حسب نفس الفلاتر.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card padding="md">
          <p className="text-sm text-gray-400">الفواتير المعروضة</p>
          <p className="text-2xl font-bold">{invoices.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">المحصّل</p>
          <p className="text-2xl font-bold text-green-600">{totalPaid} MRU</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">المتبقي على الطلاب</p>
          <p className="text-2xl font-bold text-red-600">{totalDue} MRU</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">غير مدفوع بالكامل</p>
          <p className="text-2xl font-bold text-red-600">{unpaidCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">مدفوع جزئياً</p>
          <p className="text-2xl font-bold text-amber-600">{partialCount}</p>
        </Card>
      </div>

      {(initialClassroomId || initialMonth || initialStatus) && (
        <Card padding="md" className="border-blue-100 bg-blue-50">
          <p className="text-sm font-medium text-blue-900">تم فتح الفواتير بفلاتر جاهزة</p>
          <p className="mt-1 text-sm text-blue-700">
            الصفحة دخلت مباشرة على القسم أو الشهر المحدد من السياق السابق. يمكنك متابعة نفس الاختيار أو تغييره من الفلاتر أدناه.
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card padding="lg" className="border-blue-100 bg-blue-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">1. توليد فواتير شهر جديد</h2>
              <p className="mt-2 text-sm text-blue-700">
                هذا الإجراء ينشئ الفواتير الفعلية التي سيتابعها النظام لاحقاً. استخدمه مرة واحدة لكل شهر بعد التأكد من الرسوم المعينة على الطلاب.
              </p>
            </div>
            <Button loading={generating} onClick={generateInvoices}>
              <FilePlus2 className="h-4 w-4" /> توليد الفواتير
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
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
              options={[{ value: "", label: "جميع الأقسام" }, ...classrooms.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <Input
              label="تاريخ الاستحقاق (اختياري)"
              type="date"
              value={generateDueDate}
              onChange={(e) => setGenerateDueDate(e.target.value)}
            />
          </div>

          <div className="mt-4 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-blue-700">
            الرسوم الشهرية تتكرر كل شهر، والرسوم السنوية تتكرر مرة واحدة في السنة، ورسوم المرة الواحدة لا تتكرر بعد أول فاتورة.
          </div>

          {lastGeneration && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">إجمالي الرسوم المؤهلة</p>
                <p className="mt-2 text-xl font-bold">{lastGeneration.total}</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">فواتير أنشئت</p>
                <p className="mt-2 text-xl font-bold text-blue-700">{lastGeneration.created}</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">موجودة مسبقاً</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{lastGeneration.skippedExisting}</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">تم تجاوزها حسب الدورية</p>
                <p className="mt-2 text-xl font-bold text-amber-600">{lastGeneration.skippedByFrequency}</p>
              </div>
            </div>
          )}
        </Card>

        <Card padding="lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">2. تنبيهات المتأخرات</h2>
              <p className="mt-2 text-sm text-gray-500">
                التنبيه يعتمد على الشهر والقسم المحددين أسفل هذه الصفحة. بعد الضغط، ينشئ النظام حملة مراجعة واعتماد قبل الإرسال إلى أولياء الأمور.
              </p>
            </div>
            <Button variant="secondary" loading={sendingReminders} onClick={sendReminders}>
              <BellRing className="h-4 w-4" /> إنشاء تنبيه
            </Button>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            إذا كان الشهر غير محدد فلن ينشئ النظام تنبيهاً، لأن تذكير المتأخرات يجب أن يكون مرتبطاً بشهر واضح.
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <p className="text-gray-500">الشهر الحالي في الفلاتر</p>
              <p className="mt-2 font-semibold">{selectedMonthLabel}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <p className="text-gray-500">القسم الحالي في الفلاتر</p>
              <p className="mt-2 font-semibold">{selectedClassroomLabel}</p>
            </div>
          </div>

          {lastReminder && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {lastReminder.createdCampaign
                ? `تم إنشاء حملة اعتماد لعدد ${lastReminder.recipients} مستلمين تغطي ${lastReminder.invoices} فاتورة متأخرة.`
                : "لا توجد فواتير متأخرة ضمن الاختيار الحالي، لذلك لم تُنشأ حملة جديدة."}
            </div>
          )}
        </Card>
      </div>

      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">3. متابعة الفواتير الحالية</h2>
            <p className="mt-2 text-sm text-gray-500">
              الفلاتر هنا للعرض والمتابعة فقط. استخدمها للبحث في الفواتير المسجلة وتسجيل الدفعات الكاملة أو الجزئية.
            </p>
          </div>
          <Button variant="secondary" onClick={loadInvoices}>
            <Search className="h-4 w-4" /> تحديث النتائج
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Select
            label="القسم"
            value={classroomId}
            onChange={setClassroomId}
            options={[{ value: "", label: "جميع الأقسام" }, ...classrooms.map((item) => ({ value: item.id, label: item.name }))]}
          />
          <Select
            label="الشهر"
            value={month}
            onChange={setMonth}
            options={monthOptions}
          />
          <Select
            label="الحالة"
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "كل الحالات" },
              { value: "PENDING", label: "غير مدفوع" },
              { value: "PARTIAL", label: "مدفوع جزئياً" },
              { value: "PAID", label: "مدفوع" },
              { value: "CANCELLED", label: "ملغي" },
            ]}
          />
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              لا يؤدي تغيير هذه الفلاتر إلى توليد فواتير جديدة، بل يغير فقط الفواتير المعروضة أدناه.
            </div>
          </div>
        </div>
      </Card>

      {loading ? <LoadingPage /> : invoices.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <DollarSign className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <p className="text-gray-500">لا توجد فواتير مطابقة لهذا العرض</p>
            <p className="mt-1 text-sm text-gray-400">
              إذا كنت تبدأ شهراً جديداً فابدأ أولاً من قسم &quot;توليد فواتير شهر جديد&quot;، ثم عد إلى هذا الجدول للمتابعة والتحصيل.
            </p>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right">
                <th className="pb-3 font-medium text-gray-500">الطالب</th>
                <th className="pb-3 font-medium text-gray-500">القسم</th>
                <th className="pb-3 font-medium text-gray-500">الرسم</th>
                <th className="pb-3 font-medium text-gray-500">الشهر</th>
                <th className="pb-3 font-medium text-gray-500">الاستحقاق</th>
                <th className="pb-3 font-medium text-gray-500">المبلغ</th>
                <th className="pb-3 font-medium text-gray-500">الحالة</th>
                <th className="pb-3 font-medium text-gray-500">المدفوع</th>
                <th className="pb-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const currentStatus = statusLabels[invoice.status] || { label: invoice.status, variant: "default" as const }
                const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)

                return (
                  <tr key={invoice.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3">
                      <span className="font-medium">{invoice.student.firstName} {invoice.student.lastName}</span>
                      {invoice.student.studentNumber && (
                        <span className="mr-2 text-xs text-gray-400">({invoice.student.studentNumber})</span>
                      )}
                    </td>
                    <td className="py-3">{invoice.classroom.name}</td>
                    <td className="py-3">{invoice.fee.name}</td>
                    <td className="py-3">{getMonthLabel(invoice.month)}</td>
                    <td className="py-3">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("ar-MR") : "غير محدد"}</td>
                    <td className="py-3 font-medium">{invoice.amount} MRU</td>
                    <td className="py-3"><Badge variant={currentStatus.variant}>{currentStatus.label}</Badge></td>
                    <td className="py-3">{paid} MRU</td>
                    <td className="py-3">
                      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPayInvoiceId(invoice.id)
                            setPayAmount(String(invoice.amount - paid))
                            setPayMethod("CASH")
                          }}
                        >
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

      {payInvoiceId && (() => {
        const invoice = invoices.find((item) => item.id === payInvoiceId)
        if (!invoice) return null

        const remainingAmount = invoice.amount - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setPayInvoiceId(null)}>
            <div className="w-[90vw] max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-4 text-lg font-semibold">تسديد فاتورة</h2>
              <div className="mb-4 space-y-3 text-sm">
                <p><span className="text-gray-400">الطالب:</span> {invoice.student.firstName} {invoice.student.lastName}</p>
                <p><span className="text-gray-400">القسم:</span> {invoice.classroom.name}</p>
                <p><span className="text-gray-400">الرسم:</span> {invoice.fee.name}</p>
                <p><span className="text-gray-400">الشهر:</span> {getMonthLabel(invoice.month)}</p>
                <p><span className="text-gray-400">المبلغ المتبقي:</span> {remainingAmount} MRU</p>
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

"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Input, Select, Badge, LoadingPage, Pagination } from "@/components/ui"
import { DollarSign, Search, BellRing, FilePlus2, ReceiptText } from "lucide-react"
import toast from "react-hot-toast"
import { generateRecentMonthOptions, getMonthLabel } from "@/lib/finance"
import { getDateLocale } from "@/lib/locale"

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



export default function InvoicesPage() {
  const locale = useLocale()
  const t = useTranslations("invoicesPage")
  const tCommon = useTranslations("common")
  const searchParams = useSearchParams()
  const initialClassroomId = searchParams?.get("classroomId") || ""
  const initialMonth = searchParams?.get("month") || ""
  const initialStatus = searchParams?.get("status") || ""
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 25
  const [generating, setGenerating] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [generateMonth, setGenerateMonth] = useState(recentMonthOptions[0]?.value || "")
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
  const recentMonthOptions = generateRecentMonthOptions(18, locale)
  const [paying, setPaying] = useState(false)
  const monthOptions = [
    { value: "", label: t("allMonths") },
    ...recentMonthOptions,
  ]
  const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "default" | "danger" }> = {
    PAID: { label: t("statusPaid"), variant: "success" },
    PARTIAL: { label: t("statusPartial"), variant: "warning" },
    PENDING: { label: t("statusPending"), variant: "danger" },
    CANCELLED: { label: t("statusCancelled"), variant: "default" },
  }

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
    setPage(1)
  }, [classroomId, month, status])

  useEffect(() => {
    setClassroomId(initialClassroomId)
    setMonth(initialMonth)
    setStatus(initialStatus)
  }, [initialClassroomId, initialMonth, initialStatus])

  async function recordPayment() {
    if (!payInvoiceId || !payAmount) {
      toast.error(t("amountRequired"))
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
      toast.success(data?.receiptNumber ? t("paymentRecordedWithReceipt", { receipt: data.receiptNumber }) : t("paymentRecorded"))
      setPayInvoiceId(null)
      void loadInvoices()
    }

    setPaying(false)
  }

  async function generateInvoices() {
    if (!generateMonth) {
      toast.error(t("selectMonth"))
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
      toast.success(t("generatedInvoicesSuccess", { count: data?.created || 0, month: getMonthLabel(generateMonth, locale) }))
      if (month === generateMonth || !month) {
        void loadInvoices()
      }
    }

    setGenerating(false)
  }

  async function sendReminders() {
    if (!month) {
      toast.error(t("selectMonthForReminders"))
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
          ? t("createdReminderCampaign", { count: data?.recipients || 0 })
          : t("noOverdueInvoices")
      )
    }

    setSendingReminders(false)
  }

  const totalDue = invoices.reduce((sum, invoice) => sum + (invoice.status === "PAID" ? 0 : invoice.amount), 0)
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0), 0)
  const unpaidCount = invoices.filter((invoice) => invoice.status === "PENDING").length
  const partialCount = invoices.filter((invoice) => invoice.status === "PARTIAL").length
  const selectedMonthLabel = month ? getMonthLabel(month, locale) : t("allMonths")
  const selectedClassroomLabel = classrooms.find((item) => item.id === classroomId)?.name || t("classroomOptional")
  const paginatedInvoices = invoices.slice((page - 1) * limit, page * limit)
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(invoices.length / limit))
    if (page > maxPage) setPage(maxPage)
  }, [invoices.length, limit, page])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("shownInvoices")}</p>
          <p className="text-2xl font-bold">{invoices.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("collected")}</p>
          <p className="text-2xl font-bold text-green-600">{totalPaid} MRU</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("remaining")}</p>
          <p className="text-2xl font-bold text-red-600">{totalDue} MRU</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("fullyUnpaid")}</p>
          <p className="text-2xl font-bold text-red-600">{unpaidCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("partiallyPaid")}</p>
          <p className="text-2xl font-bold text-amber-600">{partialCount}</p>
        </Card>
      </div>

      {(initialClassroomId || initialMonth || initialStatus) && (
        <Card padding="md" className="border-blue-100 bg-blue-50">
          <p className="text-sm font-medium text-blue-900">{t("openedWithFilters")}</p>
          <p className="mt-1 text-sm text-blue-700">
            {t("openedWithFiltersText")}
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card padding="lg" className="border-blue-100 bg-blue-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t("generateTitle")}</h2>
              <p className="mt-2 text-sm text-blue-700">
                {t("generateText")}
              </p>
            </div>
            <Button loading={generating} onClick={generateInvoices}>
              <FilePlus2 className="h-4 w-4" /> {t("generateButton")}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Select
              label={t("generateMonth")}
              value={generateMonth}
              onChange={setGenerateMonth}
              options={monthOptions.filter((option) => option.value)}
            />
            <Select
              label={t("classroomOptional")}
              value={generateClassroomId}
              onChange={setGenerateClassroomId}
              options={[{ value: "", label: t("classroomOptional") }, ...classrooms.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <Input
              label={t("dueDateOptional")}
              type="date"
              value={generateDueDate}
              onChange={(e) => setGenerateDueDate(e.target.value)}
            />
          </div>

          <div className="mt-4 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-blue-700">
            {t("generationHint")}
          </div>

          {lastGeneration && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">{t("eligibleFees")}</p>
                <p className="mt-2 text-xl font-bold">{lastGeneration.total}</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">{t("createdInvoices")}</p>
                <p className="mt-2 text-xl font-bold text-blue-700">{lastGeneration.created}</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">{t("alreadyExisting")}</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{lastGeneration.skippedExisting}</p>
              </div>
              <div className="rounded-xl bg-white p-4 text-sm">
                <p className="text-gray-500">{t("skippedByFrequency")}</p>
                <p className="mt-2 text-xl font-bold text-amber-600">{lastGeneration.skippedByFrequency}</p>
              </div>
            </div>
          )}
        </Card>

        <Card padding="lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t("remindersTitle")}</h2>
              <p className="mt-2 text-sm text-gray-500">
                {t("remindersText")}
              </p>
            </div>
            <Button variant="secondary" loading={sendingReminders} onClick={sendReminders}>
              <BellRing className="h-4 w-4" /> {t("remindersButton")}
            </Button>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("remindersHint")}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <p className="text-gray-500">{t("currentMonthFilter")}</p>
              <p className="mt-2 font-semibold">{selectedMonthLabel}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <p className="text-gray-500">{t("currentClassroomFilter")}</p>
              <p className="mt-2 font-semibold">{selectedClassroomLabel}</p>
            </div>
          </div>

          {lastReminder && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {lastReminder.createdCampaign
                ? t("reminderCreatedText", { recipients: lastReminder.recipients, invoices: lastReminder.invoices })
                : t("reminderSkippedText")}
            </div>
          )}
        </Card>
      </div>

      <Card padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("trackingTitle")}</h2>
            <p className="mt-2 text-sm text-gray-500">
              {t("trackingText")}
            </p>
          </div>
          <Button variant="secondary" onClick={loadInvoices}>
            <Search className="h-4 w-4" /> {t("refreshResults")}
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Select
            label={t("classroom")}
            value={classroomId}
            onChange={setClassroomId}
            options={[{ value: "", label: t("classroomOptional") }, ...classrooms.map((item) => ({ value: item.id, label: item.name }))]}
          />
          <Select
            label={t("month")}
            value={month}
            onChange={setMonth}
            options={monthOptions}
          />
          <Select
            label={t("status")}
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: t("allStatuses") },
              { value: "PENDING", label: t("statusPending") },
              { value: "PARTIAL", label: t("statusPartial") },
              { value: "PAID", label: t("statusPaid") },
              { value: "CANCELLED", label: t("statusCancelled") },
            ]}
          />
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {t("filtersHint")}
            </div>
          </div>
        </div>
      </Card>

      {loading ? <LoadingPage /> : invoices.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <DollarSign className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <p className="text-gray-500">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t("emptyText")}
            </p>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right">
                <th className="pb-3 font-medium text-gray-500">{t("student")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("classroom")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("fee")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("month")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("dueDate")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("amount")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("status")}</th>
                <th className="pb-3 font-medium text-gray-500">{t("paidAmount")}</th>
                <th className="pb-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.map((invoice) => {
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
                    <td className="py-3">{getMonthLabel(invoice.month, locale)}</td>
                    <td className="py-3">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString(getDateLocale(locale)) : t("unspecified")}</td>
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
                          <ReceiptText className="h-4 w-4" /> {t("settle")}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={page} total={invoices.length} limit={limit} onChange={setPage} />
        </div>
      )}

      {payInvoiceId && (() => {
        const invoice = invoices.find((item) => item.id === payInvoiceId)
        if (!invoice) return null

        const remainingAmount = invoice.amount - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={() => setPayInvoiceId(null)}>
            <div className="w-[90vw] max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-4 text-lg font-semibold">{t("settleInvoice")}</h2>
              <div className="mb-4 space-y-3 text-sm">
                <p><span className="text-gray-400">{t("student")}:</span> {invoice.student.firstName} {invoice.student.lastName}</p>
                <p><span className="text-gray-400">{t("classroom")}:</span> {invoice.classroom.name}</p>
                <p><span className="text-gray-400">{t("fee")}:</span> {invoice.fee.name}</p>
                <p><span className="text-gray-400">{t("month")}:</span> {getMonthLabel(invoice.month, locale)}</p>
                <p><span className="text-gray-400">{t("remainingAmount")}:</span> {remainingAmount} MRU</p>
              </div>
              <div className="space-y-4">
                <Input label={t("amount")} type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <Select
                  label={t("paymentMethod")}
                  value={payMethod}
                  onChange={setPayMethod}
                  options={[
                    { value: "CASH", label: t("cash") },
                    { value: "BANK_TRANSFER", label: t("bankTransfer") },
                    { value: "CHEQUE", label: t("cheque") },
                  ]}
                />
                <div className="flex gap-2">
                  <Button fullWidth loading={paying} onClick={recordPayment}>{t("confirmPayment")}</Button>
                  <Button variant="secondary" fullWidth onClick={() => setPayInvoiceId(null)}>{tCommon("cancel")}</Button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

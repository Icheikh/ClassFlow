"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { LoadingPage } from "@/components/ui"

type ReceiptData = {
  receiptNumber: string
  date: string
  amount: number
  amountWordsAr: string
  amountWordsFr: string
  method: string
  notes: string | null
  receivedBy: string | null
  student: { name: string; number: string | null }
  fee: string | null
  invoice: { month: string; amount: number; paid: number; remaining: number; classroom: string } | null
  school: { name: string; phone: string | null; address: string | null; logo: string | null }
}

const methodLabels: Record<string, string> = {
  CASH: "نقدي / Espèces",
  BANK_TRANSFER: "تحويل بنكي / Virement",
  CHEQUE: "شيك / Chèque",
  BANKILY: "بنكيلي / Bankily",
  MASRVI: "مصرفي / Masrvi",
}

export default function ReceiptPage() {
  const searchParams = useSearchParams()
  const paymentId = searchParams?.get("paymentId")
  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!paymentId) { setError("Missing paymentId"); setLoading(false); return }
    async function load() {
      const { data: result, error: apiError } = await api.get<ReceiptData>(`/api/finance/receipt?paymentId=${paymentId}`)
      if (apiError) { setError(apiError); setLoading(false); return }
      if (result) setData(result)
      setLoading(false)
    }
    void load()
  }, [paymentId])

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => window.print(), 500)
      return () => clearTimeout(timer)
    }
  }, [data])

  if (loading) return <LoadingPage />
  if (error || !data) return <div className="text-center py-12 text-red-500">{error || "Receipt not found"}</div>

  return (
    <div className="min-h-screen bg-white">
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
          طباعة / Print
        </button>
      </div>

      <div className="max-w-md mx-auto p-8">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
          {data.school.logo && (
            <img src={data.school.logo} alt={data.school.name} className="mx-auto mb-2 h-16 w-16 object-contain" />
          )}
          <h1 className="text-xl font-bold">{data.school.name}</h1>
          {data.school.address && <p className="text-sm text-gray-600">{data.school.address}</p>}
          {data.school.phone && <p className="text-sm text-gray-600" dir="ltr">{data.school.phone}</p>}
        </div>

        {/* Receipt Title */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-2">إيصال استلام / Reçu de paiement</h2>
        </div>

        {/* Receipt Number & Date */}
        <div className="flex justify-between text-sm mb-4">
          <div>
            <span className="text-gray-500">رقم الإيصال / N°:</span>
            <span className="font-bold ms-2">{data.receiptNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">التاريخ / Date:</span>
            <span className="ms-2">{new Date(data.date).toLocaleDateString("ar-MR")}</span>
          </div>
        </div>

        {/* Student Info */}
        <div className="border border-gray-300 rounded p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">معلومات الطالب / Élève</h3>
          <p className="font-medium">{data.student.name}</p>
          {data.student.number && <p className="text-sm text-gray-500">رقم الطالب: {data.student.number}</p>}
          {data.invoice && <p className="text-sm text-gray-500">القسم: {data.invoice.classroom}</p>}
        </div>

        {/* Payment Details */}
        <div className="border border-gray-300 rounded p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">تفاصيل الدفعة / Détails du paiement</h3>
          <div className="space-y-2 text-sm">
            {data.fee && (
              <div className="flex justify-between">
                <span className="text-gray-500">الرسوم / Frais:</span>
                <span>{data.fee}</span>
              </div>
            )}
            {data.invoice && (
              <div className="flex justify-between">
                <span className="text-gray-500">الشهر / Mois:</span>
                <span>{data.invoice.month}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">طريقة الدفع / Mode:</span>
              <span>{methodLabels[data.method] || data.method}</span>
            </div>
            {data.receivedBy && (
              <div className="flex justify-between">
                <span className="text-gray-500">استلمها / Reçu par:</span>
                <span>{data.receivedBy}</span>
              </div>
            )}
            {data.invoice && (
              <div className="flex justify-between">
                <span className="text-gray-500">المتبقي / Reste:</span>
                <span className="font-medium">{data.invoice.remaining.toLocaleString()} MRU</span>
              </div>
            )}
            {data.notes && (
              <div className="flex justify-between">
                <span className="text-gray-500">ملاحظات / Notes:</span>
                <span>{data.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="border-2 border-gray-900 rounded p-4 mb-6 text-center">
          <p className="text-sm text-gray-500">المبلغ المدفوع / Montant payé</p>
          <p className="text-3xl font-bold mt-1">{data.amount.toLocaleString()} MRU</p>
          <p className="text-xs text-gray-500 mt-2">{data.amountWordsAr}</p>
          <p className="text-xs text-gray-400">{data.amountWordsFr}</p>
        </div>

        {/* Signatures */}
        <div className="flex justify-between text-sm text-gray-500 mt-12">
          <div className="text-center">
            <div className="border-t border-gray-400 w-32 mt-12 pt-1">توقيع ولي الأمر</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-32 mt-12 pt-1">توقيع المحاسب</div>
          </div>
        </div>
      </div>
    </div>
  )
}

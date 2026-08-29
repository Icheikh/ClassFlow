"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { CheckCircle2, LogOut, Phone, QrCode, RefreshCw, Wifi, WifiOff } from "lucide-react"

type WhatsAppStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "QR_REQUIRED"

export default function WhatsAppSettingsPage() {
  const t = useTranslations("settingsPage")
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState<WhatsAppStatus>("DISCONNECTED")
  const [qr, setQr] = useState<string | null>(null)

  const pollStatus = useCallback(async () => {
    const { data } = await api.get<{ status: WhatsAppStatus; qr: string | null }>("/api/whatsapp/status")
    if (data) {
      setStatus(data.status)
      setQr(data.qr)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void pollStatus()
  }, [pollStatus])

  useEffect(() => {
    if (status === "CONNECTING" || status === "QR_REQUIRED") {
      const interval = setInterval(pollStatus, 2000)
      return () => clearInterval(interval)
    }
  }, [status, pollStatus])

  async function connect() {
    setConnecting(true)
    await api.get("/api/whatsapp/auth")
    void pollStatus()
    setConnecting(false)
  }

  async function disconnect() {
    await api.post("/api/whatsapp/logout", {})
    await pollStatus()
  }

  const statusConfig: Record<WhatsAppStatus, { label: string; variant: "success" | "warning" | "danger" | "default"; icon: React.ComponentType<{ className?: string }> }> = {
    CONNECTED: { label: "متصل", variant: "success", icon: CheckCircle2 },
    CONNECTING: { label: "جاري الاتصال...", variant: "warning", icon: RefreshCw },
    QR_REQUIRED: { label: "مسح QR", variant: "warning", icon: QrCode },
    DISCONNECTED: { label: "غير متصل", variant: "danger", icon: WifiOff },
  }

  if (loading) return <LoadingPage />

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات WhatsApp</h1>
        <p className="text-sm text-gray-500">اتصل بواتساب لإرسال الإشعارات للأولياء مجاناً</p>
      </div>

      <Card padding="lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-green-50 p-3">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">حالة الاتصال</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={cfg.variant}>
                  <StatusIcon className={`inline h-3 w-3 ${status === "CONNECTING" ? "animate-spin" : ""}`} />
                  {" "}{cfg.label}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {status === "DISCONNECTED" ? (
              <Button onClick={() => void connect()} loading={connecting}>
                <Wifi className="h-4 w-4" /> اتصال
              </Button>
            ) : (
              <Button variant="danger" onClick={() => void disconnect()}>
                <LogOut className="h-4 w-4" /> قطع الاتصال
              </Button>
            )}
          </div>
        </div>
      </Card>

      {status === "QR_REQUIRED" && qr && (
        <Card padding="lg">
          <div className="text-center">
            <h2 className="mb-4 text-lg font-semibold">امسح رمز QR بهاتفك</h2>
            <p className="mb-4 text-sm text-gray-500">
              افتح واتساب على هاتفك → الإعدادات → الأجهزة المتصلة → ربط جهاز
            </p>
            <div className="mx-auto inline-block rounded-xl border-2 border-gray-200 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`}
                alt="WhatsApp QR Code"
                className="h-64 w-64"
              />
            </div>
            <p className="mt-4 text-sm text-gray-400">
              الرمز يتحدث تلقائياً — امسحه قبل انتهاء الصلاحية
            </p>
          </div>
        </Card>
      )}

      {status === "CONNECTED" && (
        <Card padding="lg">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-green-50 p-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-green-700">WhatsApp متصل!</h2>
              <p className="text-sm text-gray-500">
                يمكنك الآن إرسال الإشعارات للأولياء عبر واتساب. سيتم الإرسال تلقائياً عند اعتماد الحملات.
              </p>
            </div>
          </div>
        </Card>
      )}

      {status === "DISCONNECTED" && (
        <Card padding="lg">
          <h2 className="mb-3 text-lg font-semibold">كيف يعمل؟</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">1. اضغط اتصال</p>
              <p className="mt-1 text-xs text-gray-500">سيظهر رمز QR</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">2. امسح الرمز</p>
              <p className="mt-1 text-xs text-gray-500">باستخدام واتساب على هاتفك</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">3. جاهز!</p>
              <p className="mt-1 text-xs text-gray-500">سيعمل الاتصال تلقائياً</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>ملاحظة:</strong> هذا الحل المجاني (Baileys). للإنتاج مع حركة مرور عالية، يُنصح باستخدام WhatsApp Business API (UltraMsg أو WATI).
          </div>
        </Card>
      )}
    </div>
  )
}

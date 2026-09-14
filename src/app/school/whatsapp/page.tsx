"use client"

import { Badge, Card } from "@/components/ui"
import { Bell, MessageSquare, Phone, Smartphone } from "lucide-react"

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الإشعارات</h1>
        <p className="text-sm text-gray-500">نظام الإشعارات — واتساب عبر Wasender + إشعارات داخلية</p>
      </div>

      <Card padding="lg">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">إشعارات الغياب — واتساب عبر Wasender</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="success">نشط</Badge>
              <span className="text-sm text-gray-500">يُرسل تلقائياً عند تسجيل الغياب</span>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <p>عندما يسجل الأستاذ غياب تلميذ، يتم:</p>
          <ol className="mt-2 list-decimal space-y-1 ps-5">
            <li>إنشاء إشعار داخلي للولي (يظهر في بوابة الولي 🔔)</li>
            <li>إرسال رسالة واتساب فورية عبر Wasender إلى هاتف الولي</li>
          </ol>
          <p className="mt-3 text-xs text-gray-400">
            يتطلب إعداد <code className="rounded bg-white px-1">WASENDER_API_KEY</code> في ملف .env مع <code className="rounded bg-white px-1">WHATSAPP_PROVIDER=wasender</code>
          </p>
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-purple-50 p-3">
            <Bell className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">الإشعارات الداخلية</h2>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="success">نشط</Badge>
              <span className="text-sm text-gray-500">النتائج، الرسوم، التتبع — داخل النظام</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <Smartphone className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm font-medium">بوابة الولي</p>
            <p className="text-xs text-gray-500">جرس + عداد غير مقروء</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <Phone className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm font-medium">واتساب للغياب</p>
            <p className="text-xs text-gray-500">عبر Wasender — فوري</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm font-medium">باقي الإشعارات</p>
            <p className="text-xs text-gray-500">داخل النظام فقط</p>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-800">
          <strong>SMS معطل (Vonage و MoorSyl).</strong> المزود المعتمد الوحيد هو Wasender عبر{" "}
          <code className="rounded bg-white px-1">WHATSAPP_PROVIDER=wasender</code>.
        </p>
      </Card>
    </div>
  )
}

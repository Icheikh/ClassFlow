"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import { Bell, CheckCheck, Clock } from "lucide-react"

type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

export default function ParentNotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function load() {
    const { data } = await api.get<{ notifications: Notification[]; unreadCount: number }>(
      "/api/parent/notifications"
    )
    if (data) {
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function markOne(id: string) {
    await api.patch("/api/parent/notifications", { id })
    void load()
  }

  async function markAll() {
    await api.patch("/api/parent/notifications", { markAll: true })
    void load()
  }

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-600" />
            الإشعارات
          </h1>
          <p className="text-sm text-gray-500">
            {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات جديدة"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void markAll()}>
            <CheckCheck className="h-4 w-4" /> تحديد الكل كمقروء
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card padding="lg">
          <div className="py-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-gray-200" />
            <p className="mt-3 text-gray-500">لا توجد إشعارات بعد</p>
            <p className="text-sm text-gray-400">ستظهر هنا إشعارات الغياب والتنبيهات من المدرسة</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              padding="md"
              className={n.read ? "opacity-70" : "border-blue-200 bg-blue-50/30"}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{n.title}</h3>
                    {!n.read && <Badge variant="info">جديد</Badge>}
                    <Badge variant="default">{n.type === "ATTENDANCE_ABSENCE" ? "غياب" : n.type}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {new Date(n.createdAt).toLocaleString("ar-MR")}
                  </p>
                </div>
                {!n.read && (
                  <Button variant="ghost" size="sm" onClick={() => void markOne(n.id)}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

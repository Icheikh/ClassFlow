"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Button, Card, LoadingPage, Select } from "@/components/ui"
import { History, Filter, ChevronLeft, ChevronRight } from "lucide-react"

type AuditLogEntry = {
  id: string
  schoolId: string
  school: { name: string } | null
  entityType: string
  entityId: string | null
  action: string
  description: string | null
  beforeJson: string | null
  afterJson: string | null
  ipAddress: string | null
  createdAt: string
}

const actionTone: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  LOGIN: "default",
  APPROVE: "success",
  LOCK: "warning",
}

const entityLabels: Record<string, string> = {
  PAYMENT: "دفعة",
  SCHOOL_SETTINGS: "إعدادات المدرسة",
  STAFF_PERMISSIONS: "صلاحيات الموظفين",
  ASSESSMENT: "تقييم",
  ASSESSMENT_OVERRIDE: "تقييم (تجاوز قفل)",
}

const actionLabels: Record<string, string> = {
  CREATE: "إنشاء",
  UPDATE: "تحديث",
  DELETE: "حذف",
  LOGIN: "دخول",
  APPROVE: "اعتماد",
  LOCK: "قفل",
}

export default function AdminAuditPage() {
  const t = useTranslations("adminPage")
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [entityFilter, setEntityFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const limit = 30

  useEffect(() => {
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (entityFilter) params.set("entityType", entityFilter)
      if (actionFilter) params.set("action", actionFilter)

      const res = await api.get<{ logs: AuditLogEntry[]; total: number }>(`/api/admin/audit?${params}`)
      setLogs(res.data?.logs || [])
      setTotal(res.data?.total || 0)
      setLoading(false)
    }
    void load()
  }, [page, entityFilter, actionFilter])

  const totalPages = Math.ceil(total / limit)

  if (loading && logs.length === 0) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">سجل التدقيق</h1>
          <p className="mt-1 text-sm text-gray-500">{total} سجل</p>
        </div>
        <History className="h-6 w-6 text-gray-400" />
      </div>

      <Card padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select
            value={entityFilter}
            onChange={(v) => { setEntityFilter(v); setPage(1) }}
            options={[
              { value: "", label: "كل الأنواع" },
              { value: "PAYMENT", label: "دفعة" },
              { value: "SCHOOL_SETTINGS", label: "إعدادات" },
              { value: "STAFF_PERMISSIONS", label: "صلاحيات" },
              { value: "ASSESSMENT", label: "تقييم" },
            ]}
          />
          <Select
            value={actionFilter}
            onChange={(v) => { setActionFilter(v); setPage(1) }}
            options={[
              { value: "", label: "كل الإجراءات" },
              { value: "CREATE", label: "إنشاء" },
              { value: "UPDATE", label: "تحديث" },
              { value: "DELETE", label: "حذف" },
            ]}
          />
        </div>
      </Card>

      <Card padding="md">
        {logs.length === 0 ? (
          <div className="py-14 text-center">
            <History className="mx-auto mb-4 h-12 w-12 text-gray-200" />
            <p className="text-gray-500">لا توجد سجلات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-3 pr-4 font-medium text-gray-500">التاريخ</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">المدرسة</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">النوع</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">الإجراء</th>
                  <th className="pb-3 font-medium text-gray-500">الوصف</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50/60">
                    <td className="py-3 pr-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("ar-MR")}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{log.school?.name || "—"}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-gray-700">{entityLabels[log.entityType] || log.entityType}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={actionTone[log.action] || "default"}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <p className="text-gray-600 max-w-md truncate">{log.description || "—"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-xs text-gray-500">
              صفحة {page} من {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

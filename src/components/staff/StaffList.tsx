"use client"

import { Badge, Button, Card } from "@/components/ui"
import { Mail, Phone, Shield, ChevronDown, ChevronUp, Trash2, Settings } from "lucide-react"
import { useState } from "react"

interface StaffMember {
  id: string
  email: string
  name: string
  phone: string | null
  isActive: boolean
  permissions: string[]
  createdAt: string
}

const permissionLabels: Record<string, string> = {
  MANAGE_USERS: "المستخدمين",
  MANAGE_STUDENTS: "الطلاب",
  MANAGE_TEACHERS: "الأساتذة",
  MANAGE_SUBJECTS: "المواد",
  MANAGE_COEFFICIENTS: "الضوارب",
  MANAGE_ACADEMIC_YEARS: "السنوات",
  MANAGE_CLASSROOMS: "الأقسام",
  REVIEW_LESSONS: "مراجعة الدروس",
  APPROVE_GRADES: "اعتماد النقاط",
  LOCK_GRADES: "قفل النقاط",
  MANAGE_FEES: "الرسوم",
  RECORD_PAYMENTS: "الدفعات",
  VIEW_FINANCE_REPORTS: "التقارير المالية",
  VIEW_REPORTS: "التقارير",
  SEND_NOTIFICATIONS: "الإشعارات",
}

interface StaffListProps {
  items: StaffMember[]
  onEdit: (member: StaffMember) => void
  onManagePermissions: (member: StaffMember) => void
  onToggleActive: (id: string, current: boolean) => void
}

export function StaffList({ items, onEdit, onManagePermissions, onToggleActive }: StaffListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <Card>
        <div className="text-center py-16">
          <Shield className="h-16 w-16 mx-auto text-gray-200 mb-4" />
          <p className="text-gray-500 text-lg mb-1">لا يوجد موظفون بعد</p>
          <p className="text-gray-400 text-sm">أضف أول موظف لبدء إدارة الصلاحيات</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((member) => (
        <Card key={member.id} padding="md">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold shrink-0 text-lg">
              {member.name.charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg text-gray-900">{member.name}</h3>
                <Badge variant={member.isActive ? "success" : "danger"}>
                  {member.isActive ? "نشط" : "موقوف"}
                </Badge>
                <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full flex items-center gap-1">
                  <Shield className="h-3 w-3" /> موظف
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {member.email}</span>
                {member.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {member.phone}</span>}
                <span className="text-xs text-gray-400">{member.permissions.length} صلاحية</span>
              </div>
            </div>

            <div className="flex gap-1 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => onManagePermissions(member)}>
                <Settings className="h-4 w-4" /> صلاحيات
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>
                تعديل
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleActive(member.id, member.isActive)}
                className={member.isActive ? "text-red-500" : "text-green-500"}
                aria-label={member.isActive ? "إيقاف الموظف" : "تفعيل الموظف"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                className="p-1.5 hover:bg-gray-100 rounded"
                aria-label={expandedId === member.id ? "إخفاء الصلاحيات" : "عرض الصلاحيات"}
                aria-expanded={expandedId === member.id}
                aria-controls={`staff-permissions-${member.id}`}
              >
                {expandedId === member.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {expandedId === member.id && (
            <div id={`staff-permissions-${member.id}`} className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                الصلاحيات ({member.permissions.length})
              </h4>
              {member.permissions.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد صلاحيات</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {member.permissions.map((p) => (
                    <span key={p} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {permissionLabels[p] || p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

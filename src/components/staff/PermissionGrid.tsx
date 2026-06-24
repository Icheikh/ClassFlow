"use client"

import { PERMISSION_CATEGORIES } from "@/lib/permissions"

const categoryLabels: Record<string, string> = {
  USERS: "إدارة المستخدمين",
  STUDENTS: "الطلاب",
  TEACHERS: "الأساتذة والمواد",
  ACADEMIC: "السنوات والأقسام",
  GRADES: "الدرجات والدروس",
  FINANCE: "المالية",
  REPORTS: "التقارير",
  NOTIFICATIONS: "الإشعارات",
}

const permissionLabels: Record<string, string> = {
  MANAGE_USERS: "إدارة المستخدمين",
  MANAGE_STUDENTS: "إدارة الطلاب",
  MANAGE_TEACHERS: "إدارة الأساتذة",
  MANAGE_SUBJECTS: "إدارة المواد",
  MANAGE_COEFFICIENTS: "إدارة الضوارب",
  MANAGE_ACADEMIC_YEARS: "إدارة السنوات والفصول",
  MANAGE_CLASSROOMS: "إدارة الأقسام",
  REVIEW_LESSONS: "مراجعة الدروس",
  APPROVE_GRADES: "اعتماد النقاط",
  LOCK_GRADES: "قفل النقاط",
  MANAGE_FEES: "إدارة الرسوم",
  RECORD_PAYMENTS: "تسجيل الدفعات",
  VIEW_FINANCE_REPORTS: "عرض التقارير المالية",
  VIEW_REPORTS: "عرض التقارير",
  SEND_NOTIFICATIONS: "إرسال الإشعارات",
}

interface PermissionGridProps {
  selected: string[]
  onChange: (permissions: string[]) => void
}

export function PermissionGrid({ selected, onChange }: PermissionGridProps) {
  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((p) => p !== code))
    } else {
      onChange([...selected, code])
    }
  }

  return (
    <div className="space-y-4">
      {Object.entries(PERMISSION_CATEGORIES).map(([category, codes]) => (
        <div key={category}>
          <h4 className="text-sm font-semibold text-gray-800 mb-2">
            {categoryLabels[category] || category}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {codes.map((code) => (
              <label
                key={code}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1.5 rounded hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(code)}
                  onChange={() => toggle(code)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {permissionLabels[code] || code}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

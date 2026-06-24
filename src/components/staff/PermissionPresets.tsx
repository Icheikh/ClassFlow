"use client"

import { Button } from "@/components/ui"

const PRESETS: { label: string; permissions: string[] }[] = [
  {
    label: "مدير الدراسات",
    permissions: ["MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS", "REVIEW_LESSONS", "APPROVE_GRADES"],
  },
  {
    label: "محاسب",
    permissions: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"],
  },
  {
    label: "مساعد مدير",
    permissions: ["MANAGE_STUDENTS", "MANAGE_TEACHERS", "VIEW_REPORTS"],
  },
  {
    label: "مراقب",
    permissions: ["VIEW_REPORTS"],
  },
]

interface PermissionPresetsProps {
  onSelect: (permissions: string[]) => void
}

export function PermissionPresets({ onSelect }: PermissionPresetsProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">قوالب سريعة</h4>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="secondary"
            size="sm"
            onClick={() => onSelect(preset.permissions)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

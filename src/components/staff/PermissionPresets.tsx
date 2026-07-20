"use client"

import { Button } from "@/components/ui"
import { useTranslations } from "next-intl"

const PRESETS: { key: string; permissions: string[] }[] = [
  {
    key: "academicManager",
    permissions: ["MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS", "REVIEW_LESSONS", "APPROVE_GRADES"],
  },
  {
    key: "accountant",
    permissions: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"],
  },
  {
    key: "assistantDirector",
    permissions: ["MANAGE_STUDENTS", "MANAGE_TEACHERS", "VIEW_REPORTS"],
  },
  {
    key: "supervisor",
    permissions: ["VIEW_REPORTS"],
  },
]

interface PermissionPresetsProps {
  onSelect: (permissions: string[]) => void
}

export function PermissionPresets({ onSelect }: PermissionPresetsProps) {
  const t = useTranslations("permissionPresets")

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">{t("title")}</h4>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            variant="secondary"
            size="sm"
            onClick={() => onSelect(preset.permissions)}
          >
            {t(preset.key)}
          </Button>
        ))}
      </div>
    </div>
  )
}

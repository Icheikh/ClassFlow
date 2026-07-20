"use client"

import { PERMISSION_CATEGORIES } from "@/lib/permissions"
import { useTranslations } from "next-intl"

interface PermissionGridProps {
  selected: string[]
  onChange: (permissions: string[]) => void
}

export function PermissionGrid({ selected, onChange }: PermissionGridProps) {
  const tCategories = useTranslations("permissionCategories")
  const tPermissions = useTranslations("permissionLabels")

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
            {tCategories.has(category) ? tCategories(category) : category}
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
                {tPermissions.has(code) ? tPermissions(code) : code}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

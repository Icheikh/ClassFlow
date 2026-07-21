"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Card } from "@/components/ui"
import { TeacherRosterManager } from "@/features/teacher-attendance/components/TeacherRosterManager"

export default function SchoolTeacherAttendancePage() {
  const t = useTranslations("teacherAttendancePage")

  return (
    <div>
      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-blue-700">{t("bannerText")}</p>
          <Link href="/school/teaching-hours" className="text-sm font-medium text-blue-700 hover:underline">
            {t("openTeachingHours")}
          </Link>
        </div>
      </Card>

      <TeacherRosterManager />
    </div>
  )
}

"use client"

import Link from "next/link"
import { Card } from "@/components/ui"
import { TeacherRosterManager } from "@/features/teacher-attendance/components/TeacherRosterManager"

export default function SchoolTeacherAttendancePage() {
  return (
    <div>
      <Card padding="md" className="mb-6 bg-blue-50 border-blue-100">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-blue-700">
            ابدأ بتأكيد حضور الأساتذة لهذا اليوم، ثم انتقل إلى الساعات اليومية لحساب الأجور بدقة.
          </p>
          <Link href="/school/teaching-hours" className="text-sm font-medium text-blue-700 hover:underline">
            فتح الساعات اليومية
          </Link>
        </div>
      </Card>

      <TeacherRosterManager />
    </div>
  )
}

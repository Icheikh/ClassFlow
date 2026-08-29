"use client"

import Link from "next/link"
import { Calendar, ClipboardList, Lock, Users } from "lucide-react"
import { Badge, Card } from "@/components/ui"

type ClassroomStatsData = {
  classroom: { id: string }
  activeTerm: { id: string; name: string } | null
  stats: {
    totalStudents: number
    assessmentCount: number
    presentToday: number
    absentToday: number
  }
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info"

type PublicationStatus = {
  label: string
  variant: BadgeVariant
}

type TranslationFn = (key: string, values?: Record<string, unknown>) => string

type ClassroomStatsProps = {
  data: ClassroomStatsData
  publicationStatus: PublicationStatus
  t: TranslationFn
}

export function ClassroomStats({ data, publicationStatus, t }: ClassroomStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between text-gray-500">
          <span>{t("students")}</span>
          <Users className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold">{data.stats.totalStudents}</p>
        <Link
          href={`/school/students?classroomId=${data.classroom.id}`}
          className="text-sm text-blue-700 hover:underline"
        >
          {t("showFullList")}
        </Link>
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between text-gray-500">
          <span>{t("assessments")}</span>
          <ClipboardList className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold">{data.stats.assessmentCount}</p>
        <p className="text-sm text-gray-500">{t("currentTermAssessments")}</p>
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between text-gray-500">
          <span>{t("resultsStatus")}</span>
          <Lock className="h-5 w-5" />
        </div>
        <Badge variant={publicationStatus.variant} className="w-fit">
          {publicationStatus.label}
        </Badge>
        <p className="text-sm text-gray-500">
          {data.activeTerm ? t("currentTerm", { name: data.activeTerm.name }) : t("noActiveTerm")}
        </p>
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between text-gray-500">
          <span>{t("todayAttendance")}</span>
          <Calendar className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold">{data.stats.presentToday}</p>
        <p className="text-sm text-gray-500">{t("todayAbsence", { count: data.stats.absentToday })}</p>
      </Card>
    </div>
  )
}

export default ClassroomStats

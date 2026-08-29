"use client"

import Link from "next/link"
import { ArrowLeft, Eye, GraduationCap, Plus, Users } from "lucide-react"
import { Badge, Button } from "@/components/ui"

type ClassroomHeaderData = {
  classroom: {
    id: string
    name: string
    level: { name: string; stage: { name: string } }
    stream: { id: string; name: string } | null
  }
  activeTerm: { id: string; name: string; order: number } | null
}

type SubjectOption = {
  id: string
  name: string
  teacherName: string
}

type TranslationFn = (key: string, values?: Record<string, unknown>) => string

type ClassroomHeaderProps = {
  data: ClassroomHeaderData
  subjectOptions: SubjectOption[]
  activeTerm: { id: string; name: string; order: number } | null
  onAddAssessment: () => void
  t: TranslationFn
}

export function ClassroomHeader({
  data,
  subjectOptions,
  activeTerm,
  onAddAssessment,
  t,
}: ClassroomHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <Link
          href="/school/classrooms"
          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("backToClassrooms")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{data.classroom.name}</h1>
          <Badge variant="info">{data.classroom.level.stage.name}</Badge>
          <Badge>{data.classroom.level.name}</Badge>
          {data.classroom.stream && <Badge variant="warning">{data.classroom.stream.name}</Badge>}
        </div>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/school/students?classroomId=${data.classroom.id}`}>
          <Button variant="secondary">
            <Users className="h-4 w-4" /> {t("allStudents")}
          </Button>
        </Link>
        <Link href="/school/results">
          <Button variant="secondary">
            <GraduationCap className="h-4 w-4" /> {t("results")}
          </Button>
        </Link>
        {activeTerm && (
          <Link href={`/school/results?classroomId=${data.classroom.id}&termId=${activeTerm.id}`}>
            <Button variant="secondary">
              <Eye className="h-4 w-4" /> {t("classroomResultsPreview")}
            </Button>
          </Link>
        )}
        <Button
          onClick={onAddAssessment}
          disabled={subjectOptions.length === 0 || !activeTerm}
        >
          <Plus className="h-4 w-4" /> {t("addAssessmentOrExam")}
        </Button>
      </div>
    </div>
  )
}

export default ClassroomHeader

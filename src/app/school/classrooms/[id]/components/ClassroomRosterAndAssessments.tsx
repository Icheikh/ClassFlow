"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Eye,
  FilePenLine,
  GraduationCap,
  Trash2,
  UserSquare2,
  Plus,
} from "lucide-react"
import { Badge, Button, Card, Input, Modal, ConfirmModal } from "@/components/ui"
import { getDateLocale, getLocalizedSubjectName } from "@/lib/locale"

type TranslationFn = (key: string, values?: Record<string, unknown>) => string

type ClassroomResponse = {
  classroom: {
    id: string
    name: string
    capacity: number
    level: { id: string; name: string; stage: { name: string } }
    stream: { id: string; name: string } | null
  }
  enrollments: {
    id: string
    rollNumber?: number | null
    student: {
      id: string
      firstName: string
      lastName: string
      studentNumber: string | null
      phone: string | null
      isActive: boolean
    }
  }[]
  teacherAssignments: {
    id: string
    subject: { id: string; nameAr: string; nameFr?: string | null }
    teacher: { id: string; user: { name: string | null } }
  }[]
  recentLessons: {
    id: string
    title: string
    date: string
    subject: { nameAr: string; nameFr?: string | null }
    teacher: { user: { name: string | null } }
  }[]
  activeTerm: { id: string; name: string; order: number } | null
  resultPublication: {
    id: string
    status: string
    publishedAt: string | null
    lockedAt: string | null
  } | null
  assessments: {
    id: string
    title: string
    type: string
    date: string
    maxScore: number
    status: string
    subject: { id: string; nameAr: string; nameFr?: string | null }
    teacher: { user: { name: string | null } }
    scores: {
      id: string
      score: number
      student: {
        id: string
        firstName: string
        lastName: string
      }
    }[]
  }[]
  recentActivity: {
    id: string
    entityType: string
    action: string
    description: string
    createdAt: string
    actorUser: {
      id: string
      name: string | null
      email: string | null
    } | null
  }[]
  stats: {
    totalStudents: number
    totalTeachers: number
    presentToday: number
    absentToday: number
    assessmentCount: number
  }
}

type ClassroomResultOverview = {
  classroom: { id: string; name: string }
  term: { id: string; name: string }
  termCalculationNote: string
  termPolicyNote: string
  resultRule: { id: string; name: string; version: number }
  publicationStatus: string
  stats: { students: number; assessments: number; classAverage: number | null }
  readiness: {
    publishable: boolean
    studentsCount: number
    fullyComputedStudents: number
    assignedSubjectsCount: number
    readySubjectsCount: number
    missingCoefficientSubjects: { subjectId: string; subjectName: string }[]
    incompleteSubjects: {
      subjectId: string
      subjectName: string
      readyStudents: number
      studentsCount: number
      missingAssessmentTypes: string[]
    }[]
  }
  subjects: { id: string; nameAr: string; nameFr?: string | null }[]
  results: { studentId: string; studentName: string; average: number | null; rank: number | null }[]
}

type AssessmentForm = {
  id: string | null
  title: string
  subjectId: string
  assessmentType: string
  maxScore: string
  date: string
  scores: Record<string, string>
}

type SubjectOption = {
  id: string
  name: string
  teacherName: string
}

type AssessmentTypeOption = {
  value: string
  label: string
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info"

type PublicationStatus = {
  label: string
  variant: BadgeVariant
}

type ClassroomRosterAndAssessmentsProps = {
  data: ClassroomResponse
  resultOverview: ClassroomResultOverview | null
  resultOverviewLoading: boolean
  locale: string
  t: TranslationFn
  publicationStatus: PublicationStatus
  subjectOptions: SubjectOption[]
  assessmentTypeOptions: AssessmentTypeOption[]
  assessmentForm: AssessmentForm
  setAssessmentForm: React.Dispatch<React.SetStateAction<AssessmentForm>>
  assessmentModalOpen: boolean
  setAssessmentModalOpen: (open: boolean) => void
  savingAssessment: boolean
  onSaveAssessment: () => void
  deletingAssessmentId: string | null
  assessmentToDelete: string | null
  setAssessmentToDelete: (id: string | null) => void
  onConfirmDeleteAssessment: () => void
  expandedAssessmentId: string | null
  setExpandedAssessmentId: React.Dispatch<React.SetStateAction<string | null>>
  onEditAssessment: (id: string) => void
  onCreateAssessment: () => void
}

function formatDate(value: string | null | undefined, locale: string, fallback: string): string {
  if (!value) return fallback
  return new Intl.DateTimeFormat(getDateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function getAssessmentTypeLabel(type: string, t: TranslationFn): string {
  if (type === "TEST") return t("assessmentTypeTest")
  if (type === "EXAM_1") return t("assessmentTypeExam1")
  if (type === "EXAM_2") return t("assessmentTypeExam2")
  if (type === "EXAM_3") return t("assessmentTypeExam3")
  return type
}

function getAssessmentStatus(
  status: string | null | undefined,
  t: TranslationFn
): { label: string; variant: BadgeVariant } {
  if (status === "PUBLISHED") return { label: t("assessmentStatusPublished"), variant: "success" }
  return { label: t("assessmentStatusDraft"), variant: "default" }
}

function getActivityVariant(entityType: string): BadgeVariant {
  if (entityType === "ASSESSMENT_OVERRIDE") return "danger"
  if (entityType === "RESULT_PUBLICATION") return "warning"
  return "info"
}

export function ClassroomRosterAndAssessments({
  data,
  resultOverview,
  resultOverviewLoading,
  locale,
  t,
  publicationStatus,
  subjectOptions,
  assessmentTypeOptions,
  assessmentForm,
  setAssessmentForm,
  assessmentModalOpen,
  setAssessmentModalOpen,
  savingAssessment,
  onSaveAssessment,
  deletingAssessmentId,
  assessmentToDelete,
  setAssessmentToDelete,
  onConfirmDeleteAssessment,
  expandedAssessmentId,
  setExpandedAssessmentId,
  onEditAssessment,
  onCreateAssessment,
}: ClassroomRosterAndAssessmentsProps) {
  const tCommon = useTranslations("common")
  const tStatus = useTranslations("status")

  const topStudents = resultOverview?.results.filter((row) => row.average != null).slice(0, 3) ?? []

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{t("currentResultsPreviewTitle")}</h2>
              <p className="text-sm text-gray-500">{t("currentResultsPreviewSubtitle")}</p>
            </div>
            {resultOverview && (
              <Badge variant={resultOverview.readiness.publishable ? "success" : "warning"}>
                {resultOverview.readiness.publishable ? t("readyForApproval") : t("waitingCompletion")}
              </Badge>
            )}
          </div>

          {resultOverviewLoading ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
              {t("loadingResultsSummary")}
            </p>
          ) : !resultOverview ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
              {t("noResultsSummary")}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-blue-50 px-4 py-3">
                  <p className="text-sm text-blue-700">{t("classAverage")}</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {resultOverview.stats.classAverage?.toFixed(2) || "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 px-4 py-3">
                  <p className="text-sm text-green-700">{t("readySubjects")}</p>
                  <p className="text-2xl font-bold text-green-900">
                    {resultOverview.readiness.readySubjectsCount}/{resultOverview.readiness.assignedSubjectsCount}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-700">{t("completedStudents")}</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {resultOverview.readiness.fullyComputedStudents}/{resultOverview.readiness.studentsCount}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <p className="font-medium">
                  {resultOverview.resultRule.name} (v{resultOverview.resultRule.version})
                </p>
                <p className="mt-1 text-sm text-gray-500">{resultOverview.termCalculationNote}</p>
                <p className="mt-1 text-sm text-gray-500">{resultOverview.termPolicyNote}</p>
              </div>

              <div className="space-y-3">
                {resultOverview.subjects.map((subject) => {
                  const incomplete = resultOverview.readiness.incompleteSubjects.find(
                    (item) => item.subjectId === subject.id
                  )
                  const missingCoefficient = resultOverview.readiness.missingCoefficientSubjects.some(
                    (item) => item.subjectId === subject.id
                  )
                  const ready = !incomplete && !missingCoefficient

                  return (
                    <div key={subject.id} className="rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{getLocalizedSubjectName(subject, locale)}</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {ready
                              ? t("subjectComplete")
                              : incomplete
                                ? t("subjectCompletedCount", {
                                    readyStudents: incomplete.readyStudents,
                                    studentsCount: incomplete.studentsCount,
                                  })
                                : t("missingCoefficient")}
                          </p>
                          {!ready && incomplete && incomplete.missingAssessmentTypes.length > 0 && (
                            <p className="mt-1 text-xs text-amber-700">
                              {t("missingItems", { items: incomplete.missingAssessmentTypes.join("، ") })}
                            </p>
                          )}
                        </div>
                        <Badge variant={ready ? "success" : "warning"}>
                          {ready ? t("ready") : t("incomplete")}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t("topResultsTitle")}</h2>
            <p className="text-sm text-gray-500">{t("topResultsSubtitle")}</p>
          </div>

          {resultOverviewLoading ? (
            <p className="py-6 text-center text-gray-400">{t("loading")}</p>
          ) : topStudents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
              {t("noTopResults")}
            </p>
          ) : (
            <div className="space-y-3">
              {topStudents.map((student, index) => (
                <div key={student.studentId} className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{student.studentName}</p>
                      <p className="text-sm text-gray-500">{t("rank", { rank: student.rank || index + 1 })}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400">{t("average")}</p>
                      <p className="text-xl font-bold text-blue-700">{student.average?.toFixed(2) || "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.activeTerm && (
            <Link href={`/school/results?classroomId=${data.classroom.id}&termId=${data.activeTerm.id}`}>
              <Button fullWidth variant="secondary">
                <GraduationCap className="h-4 w-4" /> {t("openFullResultsBoard")}
              </Button>
            </Link>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t("studentListTitle")}</h2>
              <p className="text-sm text-gray-500">{t("studentListSubtitle")}</p>
            </div>
            <Link href={`/school/students?classroomId=${data.classroom.id}`}>
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4" /> {t("studentsPage")}
              </Button>
            </Link>
          </div>

          {data.enrollments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
              {t("noStudents")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.enrollments.map((enrollment) => (
                <Link key={enrollment.id} href={`/school/students/${enrollment.student.id}`}>
                  <div className="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {enrollment.student.firstName} {enrollment.student.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          #{enrollment.rollNumber ?? "?"} {enrollment.student.studentNumber ? `• ${enrollment.student.studentNumber}` : ""}
                        </p>
                      </div>
                      <Badge variant={enrollment.student.isActive ? "success" : "warning"}>
                        {enrollment.student.isActive ? tStatus("active") : tStatus("inactive")}
                      </Badge>
                    </div>
                    {enrollment.student.phone && (
                      <p className="mt-2 text-sm text-gray-500">{enrollment.student.phone}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{t("subjectsTitle")}</h2>
              <p className="text-sm text-gray-500">{t("subjectsSubtitle")}</p>
            </div>

            {data.teacherAssignments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-gray-500">
                {t("noSubjectAssignments")}
              </p>
            ) : (
              <div className="space-y-3">
                {data.teacherAssignments.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{getLocalizedSubjectName(assignment.subject, locale)}</p>
                        <p className="text-sm text-gray-500">{assignment.teacher.user.name || t("teacherUnspecified")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/teacher/grades?classroomId=${data.classroom.id}&subjectId=${assignment.subject.id}`}
                        >
                          <Button variant="ghost" size="sm">
                            <ClipboardList className="h-4 w-4" /> {t("gradeBook")}
                          </Button>
                        </Link>
                        <BookOpen className="h-5 w-5 text-gray-300" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{t("recentLessonsTitle")}</h2>
              <p className="text-sm text-gray-500">{t("recentLessonsSubtitle")}</p>
            </div>

            {data.recentLessons.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-gray-500">
                {t("noLessons")}
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentLessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <p className="font-semibold">{lesson.title}</p>
                    <p className="text-sm text-gray-500">{getLocalizedSubjectName(lesson.subject, locale)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{lesson.teacher.user.name || t("teacherUnspecified")}</span>
                      <span>{formatDate(lesson.date, locale, t("unspecified"))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("assessmentsTitle")}</h2>
            <p className="text-sm text-gray-500">{t("assessmentsSubtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={publicationStatus.variant}>
              {t("resultsStatusLabel", { status: publicationStatus.label })}
            </Badge>
            <Link href={`/school/classrooms/${data.classroom.id}/schedule`}>
              <Button variant="secondary">
                <Calendar className="h-4 w-4" /> {t("schedule")}
              </Button>
            </Link>
            <Button onClick={onCreateAssessment} disabled={subjectOptions.length === 0 || !data.activeTerm}>
              <Plus className="h-4 w-4" /> {t("addAssessment")}
            </Button>
          </div>
        </div>

        {data.assessments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-gray-500">
            {t("noAssessments")}
          </p>
        ) : (
          <div className="space-y-4">
            {data.assessments.map((assessment) => (
              <div key={assessment.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{assessment.title}</h3>
                      <Badge variant="info">{getAssessmentTypeLabel(assessment.type, t)}</Badge>
                      <Badge variant={getAssessmentStatus(assessment.status, t).variant}>
                        {getAssessmentStatus(assessment.status, t).label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                      <span>{getLocalizedSubjectName(assessment.subject, locale)}</span>
                      <span>{assessment.teacher.user.name || t("teacherUnspecified")}</span>
                      <span>{formatDate(assessment.date, locale, t("unspecified"))}</span>
                      <span>{t("maxScore", { value: assessment.maxScore })}</span>
                      <span>{t("entries", { count: assessment.scores.length, total: data.enrollments.length })}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onEditAssessment(assessment.id)}>
                      <FilePenLine className="h-4 w-4" /> {t("edit")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deletingAssessmentId === assessment.id}
                      onClick={() => setAssessmentToDelete(assessment.id)}
                    >
                      <Trash2 className="h-4 w-4" /> {t("delete")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedAssessmentId((current) => (current === assessment.id ? null : assessment.id))
                      }
                    >
                      <Eye className="h-4 w-4" /> {expandedAssessmentId === assessment.id ? t("hideScores") : t("showScores")}
                    </Button>
                  </div>
                </div>

                {expandedAssessmentId === assessment.id && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">{t("student")}</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">{t("score")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {data.enrollments.map((enrollment) => {
                          const score = assessment.scores.find((item) => item.student.id === enrollment.student.id)
                          return (
                            <tr key={enrollment.student.id}>
                              <td className="px-4 py-3">
                                {enrollment.student.firstName} {enrollment.student.lastName}
                              </td>
                              <td className="px-4 py-3">
                                {score ? score.score : <span className="text-gray-400">{t("notEntered")}</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{t("auditTitle")}</h2>
          <p className="text-sm text-gray-500">{t("auditSubtitle")}</p>
        </div>

        {data.recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
            {t("noAudit")}
          </p>
        ) : (
          <div className="space-y-3">
            {data.recentActivity.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getActivityVariant(activity.entityType)}>{activity.action}</Badge>
                      <span className="font-medium">{activity.description}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {activity.actorUser?.name || activity.actorUser?.email || t("unknownUser")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <UserSquare2 className="h-4 w-4" />
                    <span>{formatDate(activity.createdAt, locale, t("unspecified"))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={assessmentModalOpen}
        onClose={() => setAssessmentModalOpen(false)}
        title={assessmentForm.id ? t("editAssessment") : t("newAssessment")}
        className="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t("assessmentTitle")}
              value={assessmentForm.title}
              onChange={(event) => setAssessmentForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("assessmentTitlePlaceholder")}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t("subject")}</label>
              <select
                value={assessmentForm.subjectId}
                onChange={(event) => setAssessmentForm((current) => ({ ...current, subjectId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("selectSubject")}</option>
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} - {subject.teacherName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t("assessmentType")}</label>
              <select
                value={assessmentForm.assessmentType}
                onChange={(event) => setAssessmentForm((current) => ({ ...current, assessmentType: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assessmentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label={t("maxScoreLabel")}
              type="number"
              min="1"
              step="0.01"
              value={assessmentForm.maxScore}
              onChange={(event) => setAssessmentForm((current) => ({ ...current, maxScore: event.target.value }))}
            />

            <Input
              label={t("date")}
              type="date"
              value={assessmentForm.date}
              onChange={(event) => setAssessmentForm((current) => ({ ...current, date: event.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{t("studentScoresTitle")}</h3>
                <p className="text-sm text-gray-500">{t("studentScoresSubtitle")}</p>
              </div>
              <Badge variant="info">{t("studentCount", { count: data.enrollments.length })}</Badge>
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-gray-100">
              <div className="grid grid-cols-1 divide-y divide-gray-100 bg-white">
                {data.enrollments.map((enrollment) => (
                  <div key={enrollment.student.id} className="grid grid-cols-[1fr_140px] items-center gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium">
                        {enrollment.student.firstName} {enrollment.student.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{enrollment.student.studentNumber || t("noStudentNumber")}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={assessmentForm.maxScore || "20"}
                      step="0.01"
                      value={assessmentForm.scores[enrollment.student.id] ?? ""}
                      onChange={(event) =>
                        setAssessmentForm((current) => ({
                          ...current,
                          scores: {
                            ...current.scores,
                            [enrollment.student.id]: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setAssessmentModalOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button loading={savingAssessment} onClick={() => onSaveAssessment()}>
              {assessmentForm.id ? t("saveChanges") : t("createAssessment")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!assessmentToDelete}
        onClose={() => setAssessmentToDelete(null)}
        onConfirm={() => onConfirmDeleteAssessment()}
        title={t("deleteAssessmentTitle")}
        message={t("deleteAssessmentMessage")}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </>
  )
}

export default ClassroomRosterAndAssessments

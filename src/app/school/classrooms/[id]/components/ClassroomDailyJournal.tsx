"use client"

import { BookOpen, RefreshCcw, Users } from "lucide-react"
import { Badge, Button, Card, Input } from "@/components/ui"
import { getLocalizedSubjectName } from "@/lib/locale"

type ClassroomDailyJournalData = {
  date: string
  studentsCount: number
  summary: {
    totalSessions: number
    attendanceRecorded: number
    lessonsRecorded: number
    absentCount: number
  }
  sessions: {
    id: string
    startTime: string
    endTime: string
    subject: { id: string; nameAr: string; nameFr?: string | null }
    teacher: { id: string; user: { name: string | null } } | null
    attendance: {
      recorded: boolean
      totalRecords: number
      presentCount: number
      absentCount: number
      absentStudents: { id: string; number: string; name: string }[]
    }
    lessons: {
      recorded: boolean
      count: number
      items: {
        id: string
        title: string
        description: string | null
        homework: string | null
        notes: string | null
        duration: number | null
      }[]
    }
  }[]
}

type TranslationFn = (key: string, values?: Record<string, unknown>) => string

type ClassroomDailyJournalProps = {
  dailyJournal: ClassroomDailyJournalData | null
  dailyJournalLoading: boolean
  journalDate: string
  setJournalDate: (value: string) => void
  journalTab: "attendance" | "lessons"
  setJournalTab: (value: "attendance" | "lessons") => void
  onRefresh: () => void
  classroomId: string
  locale: string
  t: TranslationFn
}

export function ClassroomDailyJournal({
  dailyJournal,
  dailyJournalLoading,
  journalDate,
  setJournalDate,
  journalTab,
  setJournalTab,
  onRefresh,
  locale,
  t,
}: ClassroomDailyJournalProps) {
  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("dailyJournalTitle")}</h2>
          <p className="text-sm text-gray-500">{t("dailyJournalSubtitle")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={journalDate}
            onChange={(event) => setJournalDate(event.target.value)}
            aria-label={t("dailyJournalDate")}
          />
          <Button variant="secondary" onClick={onRefresh}>
            <RefreshCcw className="h-4 w-4" /> {t("refreshJournal")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">{t("journalSessions")}</p>
          <p className="text-2xl font-bold">{dailyJournal?.summary.totalSessions ?? "—"}</p>
        </div>
        <div className="rounded-xl bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{t("journalAttendanceRecorded")}</p>
          <p className="text-2xl font-bold text-green-900">
            {dailyJournal?.summary.attendanceRecorded ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-700">{t("journalLessonsRecorded")}</p>
          <p className="text-2xl font-bold text-blue-900">
            {dailyJournal?.summary.lessonsRecorded ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{t("journalAbsentCount")}</p>
          <p className="text-2xl font-bold text-red-900">{dailyJournal?.summary.absentCount ?? "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={journalTab === "attendance" ? "primary" : "secondary"}
          onClick={() => setJournalTab("attendance")}
        >
          <Users className="h-4 w-4" /> {t("attendanceJournal")}
        </Button>
        <Button
          variant={journalTab === "lessons" ? "primary" : "secondary"}
          onClick={() => setJournalTab("lessons")}
        >
          <BookOpen className="h-4 w-4" /> {t("lessonJournal")}
        </Button>
      </div>

      {dailyJournalLoading ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-gray-500">
          {t("dailyJournalLoading")}
        </p>
      ) : !dailyJournal || dailyJournal.sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-gray-500">
          {t("noJournalSessions")}
        </p>
      ) : (
        <div className="space-y-3">
          {dailyJournal.sessions.map((session) => {
            const subjectName = getLocalizedSubjectName(session.subject, locale)
            const teacherName = session.teacher?.user.name || t("teacherUnspecified")

            return (
              <div key={session.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">
                        {session.startTime} - {session.endTime}
                      </Badge>
                      <h3 className="font-semibold text-gray-950">{subjectName}</h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{teacherName}</p>
                  </div>
                  {journalTab === "attendance" ? (
                    <Badge variant={session.attendance.recorded ? "success" : "warning"}>
                      {session.attendance.recorded ? t("attendanceRecorded") : t("attendanceMissing")}
                    </Badge>
                  ) : (
                    <Badge variant={session.lessons.recorded ? "success" : "warning"}>
                      {session.lessons.recorded ? t("lessonRecorded") : t("lessonMissing")}
                    </Badge>
                  )}
                </div>

                {journalTab === "attendance" ? (
                  <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                    {!session.attendance.recorded ? (
                      <p className="text-sm text-amber-700">{t("attendanceNotRecordedHint")}</p>
                    ) : session.attendance.absentStudents.length === 0 ? (
                      <p className="text-sm text-green-700">{t("noAbsentStudents")}</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">
                          {t("absentStudentNumbers", { count: session.attendance.absentCount })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {session.attendance.absentStudents.map((student) => (
                            <span
                              key={student.id}
                              title={student.name}
                              className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-red-600 px-3 text-lg font-bold text-white shadow-sm"
                            >
                              {student.number}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {session.lessons.items.length === 0 ? (
                      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {t("lessonNotRecordedHint")}
                      </p>
                    ) : (
                      session.lessons.items.map((lesson) => (
                        <div key={lesson.id} className="rounded-xl bg-blue-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-blue-950">{lesson.title}</p>
                            {lesson.duration && (
                              <Badge variant="default">
                                {t("lessonDurationValue", { count: lesson.duration })}
                              </Badge>
                            )}
                          </div>
                          {lesson.description && (
                            <p className="mt-2 text-sm leading-6 text-blue-900">{lesson.description}</p>
                          )}
                          {lesson.homework && (
                            <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-blue-900">
                              <span className="font-medium">{t("homework")} </span>
                              {lesson.homework}
                            </p>
                          )}
                          {lesson.notes && <p className="mt-2 text-sm text-blue-800">{lesson.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default ClassroomDailyJournal

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { formatDateOnly, getWeekStartDate } from "@/lib/date"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!session || !user?.schoolId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT", "SCHOOL_ADMIN", "TEACHER"].includes(user?.role)
    if (!hasPermission(user, PERMISSIONS.VIEW_REPORTS) && !isLegacyRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const schoolId = user.schoolId
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const currentMonth = formatDateOnly(today).slice(0, 7)
    const weekStart = getWeekStartDate(today)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      include: {
        terms: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
    })
    const activeTerm = activeYear?.terms[0] || null

    const [
      school,
      students,
      teachers,
      classrooms,
      todayAbsences,
      pendingApprovals,
      overdueInvoices,
      todayLessons,
      classroomsWithAttendanceToday,
      classroomsWithLessonsToday,
      todaySchedules,
      todayScheduleAttendances,
      assignmentsWithoutRate,
      classroomsWithAssignments,
      studentsWithoutPrimaryParent,
      pendingInvoicesThisMonth,
      collectedThisMonth,
      openResults,
      rejectedCampaigns,
      teachingHoursRecordedThisWeek,
    ] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      }),
      prisma.student.count({ where: { schoolId, isActive: true } }),
      prisma.teacher.count({ where: { schoolId } }),
      prisma.classroom.count({ where: { schoolId } }),
      prisma.attendance.count({
        where: {
          schoolId,
          status: { in: ["ABSENT", "absent"] },
          date: { gte: today, lt: tomorrow },
        },
      }),
      prisma.notificationCampaign.count({
        where: { schoolId, status: "PENDING_APPROVAL" },
      }),
      prisma.invoice.count({
        where: {
          schoolId,
          status: { not: "PAID" },
          dueDate: { lt: today },
        },
      }),
      prisma.lesson.count({
        where: { schoolId, date: { gte: today, lt: tomorrow } },
      }),
      prisma.attendance.groupBy({
        by: ["classroomId"],
        where: { schoolId, date: { gte: today, lt: tomorrow } },
      }),
      prisma.lesson.groupBy({
        by: ["classroomId"],
        where: { schoolId, date: { gte: today, lt: tomorrow } },
      }),
      prisma.schedule.findMany({
        where: { schoolId, dayOfWeek: today.getDay(), teacherId: { not: null } },
        include: {
          teacher: { include: { user: { select: { name: true } } } },
          subject: { select: { nameAr: true, nameFr: true } },
          classroom: { include: { level: true, stream: true } },
          attendances: {
            where: { date: { gte: today, lt: tomorrow } },
            include: { confirmedByUser: { select: { name: true } } },
          },
        },
        orderBy: [
          { startTime: "asc" },
          { classroom: { name: "asc" } },
        ],
      }),
      prisma.scheduleAttendance.findMany({
        where: { schoolId, date: { gte: today, lt: tomorrow } },
        select: { scheduleId: true, status: true },
      }),
      prisma.teacherAssignment.count({
        where: {
          schoolId,
          isActive: true,
          academicYearId: activeYear?.id || "__none__",
          hourlyRate: null,
        },
      }),
      prisma.teacherAssignment.groupBy({
        by: ["classroomId"],
        where: {
          schoolId,
          isActive: true,
          academicYearId: activeYear?.id || "__none__",
        },
      }),
      prisma.student.count({
        where: {
          schoolId,
          isActive: true,
          studentParents: {
            none: { isPrimary: true },
          },
        },
      }),
      prisma.invoice.count({
        where: {
          schoolId,
          month: currentMonth,
          status: { not: "PAID" },
        },
      }),
      prisma.payment.aggregate({
        where: {
          schoolId,
          date: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.resultPublication.count({
        where: {
          schoolId,
          academicYearId: activeYear?.id || "__none__",
          termId: activeTerm?.id || "__none__",
          status: "OPEN",
        },
      }),
      prisma.notificationCampaign.count({
        where: { schoolId, status: "REJECTED" },
      }),
      prisma.teachingHourEntry.groupBy({
        by: ["teacherAssignmentId"],
        where: {
          schoolId,
          date: { gte: weekStart, lt: weekEnd },
        },
      }),
    ])

    const activeEnrollments = activeYear
      ? await prisma.enrollment.count({
          where: { schoolId, academicYearId: activeYear.id, status: "ACTIVE" },
        })
      : 0

    const totalScheduledSessions = todaySchedules.length
    const confirmedSessionsCount = todayScheduleAttendances.length
    const classroomsWithAttendanceCount = classroomsWithAttendanceToday.length
    const classroomsWithLessonsCount = classroomsWithLessonsToday.length
    const classroomsWithAssignmentsCount = classroomsWithAssignments.length
    const scheduledTeacherIds = new Set(todaySchedules.map((entry) => entry.teacherId).filter(Boolean))
    const attendanceScheduleIds = new Set(todayScheduleAttendances.map((entry) => entry.scheduleId))
    const teachersWithConfirmedSessions = new Set(
      todaySchedules
        .filter((entry) => attendanceScheduleIds.has(entry.id))
        .map((entry) => entry.teacherId)
        .filter(Boolean)
    )
    const classroomsWithConfirmedSessions = new Set(
      todaySchedules
        .filter((entry) => attendanceScheduleIds.has(entry.id))
        .map((entry) => entry.classroomId)
    )
    const teachersWithMissingSessionsCount = Math.max(0, scheduledTeacherIds.size - teachersWithConfirmedSessions.size)
    const classroomsWithScheduleTodayCount = new Set(todaySchedules.map((entry) => entry.classroomId)).size
    const classroomsMissingSessionConfirmation = Math.max(0, classroomsWithScheduleTodayCount - classroomsWithConfirmedSessions.size)
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(":").map(Number)
      return hours * 60 + (minutes || 0)
    }
    const dashboardSessions = todaySchedules.map((schedule) => {
      const attendance = schedule.attendances[0] || null
      const startMinutes = toMinutes(schedule.startTime)
      const endMinutes = toMinutes(schedule.endTime)
      const timeState = currentMinutes < startMinutes
        ? "upcoming"
        : currentMinutes > endMinutes
          ? "finished"
          : "current"

      return {
        scheduleId: schedule.id,
        teacherName: schedule.teacher?.user.name || "",
        subjectName: schedule.subject.nameAr,
        subjectNameFr: schedule.subject.nameFr,
        classroomName: schedule.classroom.name,
        levelName: schedule.classroom.level.name,
        streamName: schedule.classroom.stream?.name || null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        status: attendance?.status || null,
        confirmedBy: attendance?.confirmedByUser.name || null,
        timeState,
      }
    })
    const pendingSessions = dashboardSessions.filter((session) => !session.status)
    const issueSessions = dashboardSessions.filter((session) => session.status === "ABSENT" || session.status === "LATE")

    return NextResponse.json({
      schoolName: school?.name || null,
      today: today.toISOString(),
      activeYearName: activeYear?.name || null,
      activeTermName: activeTerm?.name || null,
      stats: {
        students,
        teachers,
        classrooms,
        todayAbsences,
        activeEnrollments,
        pendingApprovals,
        overdueInvoices,
        todayLessons,
      },
      attentionItems: [
        {
          key: "pendingApprovals",
          title: "pendingApprovalsTitle",
          description: "pendingApprovalsDescription",
          count: pendingApprovals,
          href: "/school/notifications",
          tone: pendingApprovals > 0 ? "danger" : "success",
        },
        {
          key: "teachersMissingAttendance",
          title: "teachersMissingAttendanceTitle",
          description: "teachersMissingAttendanceDescription",
          count: teachersWithMissingSessionsCount,
          href: "/school/teacher-attendance",
          tone: teachersWithMissingSessionsCount > 0 ? "warning" : "success",
        },
        {
          key: "classroomsMissingAttendance",
          title: "classroomsMissingAttendanceTitle",
          description: "classroomsMissingAttendanceDescription",
          count: classroomsMissingSessionConfirmation,
          href: "/school/teacher-attendance",
          tone: classroomsMissingSessionConfirmation > 0 ? "warning" : "success",
        },
        {
          key: "overdueInvoices",
          title: "overdueInvoicesTitle",
          description: "overdueInvoicesDescription",
          count: overdueInvoices,
          href: "/school/invoices?status=PENDING",
          tone: overdueInvoices > 0 ? "danger" : "success",
        },
        {
          key: "openResults",
          title: "openResultsTitle",
          description: "openResultsDescription",
          count: openResults,
          href: "/school/results",
          tone: openResults > 0 ? "info" : "success",
        },
      ],
      dailyChecklist: [
        {
          key: "teacherAttendance",
          title: "teacherAttendanceChecklistTitle",
          description: "teacherAttendanceChecklistDescription",
          done: confirmedSessionsCount,
          total: totalScheduledSessions || teachers,
          href: "/school/teacher-attendance",
        },
        {
          key: "studentAttendance",
          title: "studentAttendanceChecklistTitle",
          description: "studentAttendanceChecklistDescription",
          done: classroomsWithAttendanceCount,
          total: classrooms,
          href: "/school/teacher-attendance",
        },
        {
          key: "lessons",
          title: "lessonsChecklistTitle",
          description: "lessonsChecklistDescription",
          done: classroomsWithLessonsCount,
          total: classrooms,
          href: "/school/teaching-hours",
        },
      ],
      dailyOperations: {
        summary: {
          total: totalScheduledSessions,
          confirmed: confirmedSessionsCount,
          pending: Math.max(0, totalScheduledSessions - confirmedSessionsCount),
          present: todayScheduleAttendances.filter((attendance) => attendance.status === "PRESENT").length,
          absent: todayScheduleAttendances.filter((attendance) => attendance.status === "ABSENT").length,
          late: todayScheduleAttendances.filter((attendance) => attendance.status === "LATE").length,
          excused: todayScheduleAttendances.filter((attendance) => attendance.status === "EXCUSED").length,
        },
        currentSessions: dashboardSessions.filter((session) => session.timeState === "current").slice(0, 6),
        pendingSessions: pendingSessions.slice(0, 8),
        issueSessions: issueSessions.slice(0, 8),
      },
      monthlySnapshot: [
        {
          key: "pendingInvoicesThisMonth",
          label: "pendingInvoicesThisMonth",
          value: pendingInvoicesThisMonth,
          href: "/school/invoices",
        },
        {
          key: "collectedThisMonth",
          label: "collectedThisMonth",
          value: Math.round(collectedThisMonth._sum.amount || 0),
          href: "/school/fees",
        },
        {
          key: "rejectedCampaigns",
          label: "rejectedCampaigns",
          value: rejectedCampaigns,
          href: "/school/notifications",
        },
        {
          key: "teachingHoursRecordedThisWeek",
          label: "teachingHoursRecordedThisWeek",
          value: teachingHoursRecordedThisWeek.length,
          href: "/school/teaching-hours",
        },
      ],
      healthChecks: [
        {
          key: "activeYear",
          title: "activeYearHealthTitle",
          description: activeYear ? "activeYearHealthOk" : "activeYearHealthMissing",
          count: activeYear ? 0 : 1,
          href: "/school/academic-years",
          status: activeYear ? "good" : "danger",
        },
        {
          key: "activeTerm",
          title: "activeTermHealthTitle",
          description: activeTerm ? "activeTermHealthOk" : "activeTermHealthMissing",
          count: activeTerm ? 0 : 1,
          href: "/school/academic-years",
          status: activeTerm ? "good" : "danger",
        },
        {
          key: "assignmentsWithoutRate",
          title: "assignmentsWithoutRateHealthTitle",
          description: "assignmentsWithoutRateHealthDescription",
          count: assignmentsWithoutRate,
          href: "/school/payroll",
          status: assignmentsWithoutRate > 0 ? "warning" : "good",
        },
        {
          key: "classroomsWithoutAssignments",
          title: "classroomsWithoutAssignmentsHealthTitle",
          description: "classroomsWithoutAssignmentsHealthDescription",
          count: Math.max(0, classrooms - classroomsWithAssignmentsCount),
          href: "/school/teachers",
          status: classroomsWithAssignmentsCount < classrooms ? "warning" : "good",
        },
        {
          key: "studentsWithoutPrimaryParent",
          title: "studentsWithoutParentHealthTitle",
          description: "studentsWithoutParentHealthDescription",
          count: studentsWithoutPrimaryParent,
          href: "/school/students",
          status: studentsWithoutPrimaryParent > 0 ? "warning" : "good",
        },
      ],
    })
  } catch (error) {
    console.error("GET /api/dashboard/stats failed", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dashboard" },
      { status: 500 }
    )
  }
}

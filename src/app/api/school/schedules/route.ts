import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"

type SchedulePayload = {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  classroomId: string
  subjectId: string
  teacherId?: string | null
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function canManageSchedules(user: any) {
  const isLegacyRole = ["SUPERVISOR", "ACCOUNTANT"].includes(user?.role)
  return hasPermission(user, PERMISSIONS.MANAGE_CLASSROOMS) || isLegacyRole
}

function normalizePayload(body: any): SchedulePayload {
  return {
    id: typeof body.id === "string" ? body.id : undefined,
    dayOfWeek: Number(body.dayOfWeek),
    startTime: String(body.startTime || ""),
    endTime: String(body.endTime || ""),
    classroomId: String(body.classroomId || ""),
    subjectId: String(body.subjectId || ""),
    teacherId: body.teacherId ? String(body.teacherId) : null,
  }
}

function validateBasicPayload(payload: SchedulePayload) {
  if (!Number.isInteger(payload.dayOfWeek) || payload.dayOfWeek < 0 || payload.dayOfWeek > 6) {
    return "اليوم غير صحيح"
  }
  if (!TIME_PATTERN.test(payload.startTime) || !TIME_PATTERN.test(payload.endTime)) {
    return "صيغة الوقت غير صحيحة"
  }
  if (payload.startTime >= payload.endTime) {
    return "وقت نهاية الحصة يجب أن يكون بعد وقت البداية"
  }
  if (!payload.classroomId || !payload.subjectId) {
    return "القسم والمادة مطلوبان"
  }
  return null
}

async function validateSchedulePayload(payload: SchedulePayload, schoolId: string) {
  const basicError = validateBasicPayload(payload)
  if (basicError) return basicError

  const [classroom, subject, teacher] = await Promise.all([
    prisma.classroom.findFirst({ where: { id: payload.classroomId, schoolId }, select: { id: true, name: true } }),
    prisma.subject.findFirst({ where: { id: payload.subjectId, schoolId }, select: { id: true, nameAr: true } }),
    payload.teacherId
      ? prisma.teacher.findFirst({
          where: { id: payload.teacherId, schoolId },
          select: { id: true, user: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ])

  if (!classroom) return "القسم غير موجود"
  if (!subject) return "المادة غير موجودة"
  if (payload.teacherId && !teacher) return "الأستاذ غير موجود"

  if (payload.teacherId) {
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true },
    })
    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        schoolId,
        teacherId: payload.teacherId,
        classroomId: payload.classroomId,
        subjectId: payload.subjectId,
        isActive: true,
        ...(activeYear && { academicYearId: activeYear.id }),
      },
      select: { id: true },
    })
    if (!assignment) {
      return "لا يمكن إسناد هذه الحصة لهذا الأستاذ لأنه غير مكلف بهذه المادة في هذا القسم"
    }
  }

  const overlapping = await prisma.schedule.findFirst({
    where: {
      schoolId,
      dayOfWeek: payload.dayOfWeek,
      startTime: { lt: payload.endTime },
      endTime: { gt: payload.startTime },
      ...(payload.id && { id: { not: payload.id } }),
      OR: [
        { classroomId: payload.classroomId },
        ...(payload.teacherId ? [{ teacherId: payload.teacherId }] : []),
      ],
    },
    include: {
      classroom: { select: { name: true } },
      teacher: { select: { user: { select: { name: true } } } },
    },
  })

  if (overlapping?.classroomId === payload.classroomId) {
    return `القسم لديه حصة أخرى في نفس الوقت (${overlapping.startTime} - ${overlapping.endTime})`
  }
  if (payload.teacherId && overlapping?.teacherId === payload.teacherId) {
    return `الأستاذ ${overlapping.teacher?.user.name || ""} لديه حصة أخرى في نفس الوقت مع قسم ${overlapping.classroom.name}`
  }

  return null
}

async function upsertSchedule(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageSchedules(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const payload = normalizePayload(await req.json())
  const validationError = await validateSchedulePayload(payload, user.schoolId)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  if (payload.id) {
    const existing = await prisma.schedule.findFirst({ where: { id: payload.id, schoolId: user.schoolId } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    const updated = await prisma.schedule.update({
      where: { id: payload.id },
      data: {
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        endTime: payload.endTime,
        classroomId: payload.classroomId,
        subjectId: payload.subjectId,
        teacherId: payload.teacherId || null,
      },
    })
    return NextResponse.json(updated)
  }

  const item = await prisma.schedule.create({
    data: {
      schoolId: user.schoolId,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      classroomId: payload.classroomId,
      subjectId: payload.subjectId,
      teacherId: payload.teacherId || null,
    },
  })
  return NextResponse.json(item)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classroomId = searchParams.get("classroomId")
  const teacherId = searchParams.get("teacherId")

  const where: any = { schoolId: user.schoolId }
  if (classroomId) where.classroomId = classroomId
  if (teacherId) where.teacherId = teacherId

  const items = await prisma.schedule.findMany({
    where,
    include: {
      classroom: { select: { id: true, name: true, level: { select: { name: true } } } },
      subject: { select: { id: true, nameAr: true, nameFr: true } },
      teacher: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  return upsertSchedule(req)
}

export async function PUT(req: NextRequest) {
  return upsertSchedule(req)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageSchedules(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 })

  const existing = await prisma.schedule.findFirst({ where: { id, schoolId: user.schoolId } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  await prisma.schedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

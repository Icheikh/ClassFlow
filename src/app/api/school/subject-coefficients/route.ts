import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { createResultAuditLog } from "@/lib/result-rules"

function canManageCoefficients(user: any) {
  return hasPermission(user, PERMISSIONS.MANAGE_COEFFICIENTS)
}

async function getActiveYear(schoolId: string) {
  return prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true, name: true },
  })
}

async function resolveScope(options: {
  schoolId: string
  levelId?: string
  streamId?: string | null
  classroomId?: string | null
}) {
  let resolvedLevelId = options.levelId || null
  let resolvedStreamId = options.streamId || null

  if (options.classroomId) {
    const classroom = await prisma.classroom.findFirst({
      where: { id: options.classroomId, schoolId: options.schoolId },
      select: {
        id: true,
        name: true,
        levelId: true,
        streamId: true,
      },
    })

    if (!classroom) {
      return { error: "القسم غير موجود" as const }
    }

    return {
      levelId: classroom.levelId,
      streamId: classroom.streamId,
      classroomId: classroom.id,
      classroomName: classroom.name,
    }
  }

  if (!resolvedLevelId) {
    return { error: "المستوى مطلوب" as const }
  }

  return {
    levelId: resolvedLevelId,
    streamId: resolvedStreamId,
    classroomId: null,
    classroomName: null,
  }
}

function buildDescription(scope: {
  subjectName: string
  levelName: string
  stageName: string
  streamName: string | null
  classroomName: string | null
}) {
  if (scope.classroomName) {
    return `${scope.subjectName} - قسم ${scope.classroomName}`
  }

  if (scope.streamName) {
    return `${scope.subjectName} - ${scope.stageName} ${scope.levelName} - ${scope.streamName}`
  }

  return `${scope.subjectName} - ${scope.stageName} ${scope.levelName}`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const activeYear = await getActiveYear(user.schoolId)
  if (!activeYear) {
    return NextResponse.json({
      academicYear: null,
      items: [],
    })
  }

  const items = await prisma.subjectCoefficient.findMany({
    where: {
      schoolId: user.schoolId,
      academicYearId: activeYear.id,
    },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: { include: { level: { include: { stage: true } }, stream: true } },
    },
    orderBy: [
      { level: { order: "asc" } },
      { stream: { code: "asc" } },
      { classroom: { name: "asc" } },
      { subject: { nameAr: "asc" } },
    ],
  })

  return NextResponse.json({
    academicYear: activeYear,
    items,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageCoefficients(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { subjectId, levelId, streamId, classroomId, coefficient } = body

  const activeYear = await getActiveYear(user.schoolId)
  if (!activeYear) {
    return NextResponse.json({ error: "لا توجد سنة دراسية نشطة" }, { status: 400 })
  }

  const scope = await resolveScope({
    schoolId: user.schoolId,
    levelId,
    streamId,
    classroomId,
  })
  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: 404 })
  }

  if (!subjectId || coefficient == null) {
    return NextResponse.json({ error: "المادة والضارب مطلوبة" }, { status: 400 })
  }

  const parsedCoefficient = Number.parseFloat(String(coefficient))
  if (!Number.isFinite(parsedCoefficient) || parsedCoefficient <= 0) {
    return NextResponse.json({ error: "الضارب يجب أن يكون رقماً أكبر من صفر" }, { status: 400 })
  }

  const existing = await prisma.subjectCoefficient.findFirst({
    where: scope.classroomId
      ? {
          schoolId: user.schoolId,
          academicYearId: activeYear.id,
          subjectId,
          classroomId: scope.classroomId,
        }
      : {
          schoolId: user.schoolId,
          academicYearId: activeYear.id,
          subjectId,
          levelId: scope.levelId,
          streamId: scope.streamId,
          classroomId: null,
        },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: true,
    },
  })

  const resolvedEntities = await prisma.subjectCoefficient.findFirst({
    where: {
      schoolId: user.schoolId,
      academicYearId: activeYear.id,
      subjectId,
      levelId: scope.levelId,
      streamId: scope.streamId,
      classroomId: scope.classroomId,
    },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: true,
    },
  })

  const subject = resolvedEntities?.subject || await prisma.subject.findFirst({
    where: { id: subjectId, schoolId: user.schoolId },
    select: { id: true, nameAr: true },
  })
  const level = resolvedEntities?.level || await prisma.level.findFirst({
    where: { id: scope.levelId, schoolId: user.schoolId },
    include: { stage: true },
  })
  const stream = scope.streamId
    ? resolvedEntities?.stream || await prisma.stream.findFirst({
        where: { id: scope.streamId, schoolId: user.schoolId },
        select: { id: true, name: true },
      })
    : null

  if (!subject || !level) {
    return NextResponse.json({ error: "بيانات المادة أو المستوى غير صالحة" }, { status: 400 })
  }

  if (existing) {
    const updated = await prisma.subjectCoefficient.update({
      where: { id: existing.id },
      data: { coefficient: parsedCoefficient },
      include: {
        subject: true,
        level: { include: { stage: true } },
        stream: true,
        classroom: { include: { level: { include: { stage: true } }, stream: true } },
      },
    })

    await createResultAuditLog({
      prisma,
      schoolId: user.schoolId,
      actorUserId: user.id,
      entityType: "SUBJECT_COEFFICIENT",
      entityId: updated.id,
      action: "UPDATE",
      description: `تحديث ضارب ${buildDescription({
        subjectName: updated.subject.nameAr,
        levelName: updated.level.name,
        stageName: updated.level.stage.name,
        streamName: updated.stream?.name || null,
        classroomName: updated.classroom?.name || null,
      })}`,
      before: existing,
      after: updated,
    })

    return NextResponse.json(updated)
  }

  const created = await prisma.subjectCoefficient.create({
    data: {
      schoolId: user.schoolId,
      academicYearId: activeYear.id,
      subjectId,
      levelId: scope.levelId,
      streamId: scope.streamId,
      classroomId: scope.classroomId,
      coefficient: parsedCoefficient,
    },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: { include: { level: { include: { stage: true } }, stream: true } },
    },
  })

  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: "SUBJECT_COEFFICIENT",
    entityId: created.id,
    action: "CREATE",
    description: `إضافة ضارب ${buildDescription({
      subjectName: created.subject.nameAr,
      levelName: created.level.name,
      stageName: created.level.stage.name,
      streamName: created.stream?.name || null,
      classroomName: created.classroom?.name || null,
    })}`,
    before: null,
    after: created,
  })

  return NextResponse.json(created)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!canManageCoefficients(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { id, subjectId, levelId, streamId, classroomId, coefficient } = body

  if (!id) return NextResponse.json({ error: "المعرف مطلوب" }, { status: 400 })

  const current = await prisma.subjectCoefficient.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: { include: { level: { include: { stage: true } }, stream: true } },
    },
  })
  if (!current) return NextResponse.json({ error: "الضارب غير موجود" }, { status: 404 })

  const scope = await resolveScope({
    schoolId: user.schoolId,
    levelId,
    streamId,
    classroomId,
  })
  if ("error" in scope) {
    return NextResponse.json({ error: scope.error }, { status: 404 })
  }

  if (!subjectId || coefficient == null) {
    return NextResponse.json({ error: "المادة والضارب مطلوبة" }, { status: 400 })
  }

  const parsedCoefficient = Number.parseFloat(String(coefficient))
  if (!Number.isFinite(parsedCoefficient) || parsedCoefficient <= 0) {
    return NextResponse.json({ error: "الضارب يجب أن يكون رقماً أكبر من صفر" }, { status: 400 })
  }

  const conflictingRule = await prisma.subjectCoefficient.findFirst({
    where: scope.classroomId
      ? {
          schoolId: user.schoolId,
          academicYearId: current.academicYearId,
          subjectId,
          classroomId: scope.classroomId,
          id: { not: id },
        }
      : {
          schoolId: user.schoolId,
          academicYearId: current.academicYearId,
          subjectId,
          levelId: scope.levelId,
          streamId: scope.streamId,
          classroomId: null,
          id: { not: id },
        },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: { include: { level: { include: { stage: true } }, stream: true } },
    },
  })

  if (conflictingRule) {
    const updated = await prisma.$transaction(async (tx) => {
      const merged = await tx.subjectCoefficient.update({
        where: { id: conflictingRule.id },
        data: {
          subjectId,
          levelId: scope.levelId,
          streamId: scope.streamId,
          classroomId: scope.classroomId,
          coefficient: parsedCoefficient,
        },
        include: {
          subject: true,
          level: { include: { stage: true } },
          stream: true,
          classroom: { include: { level: { include: { stage: true } }, stream: true } },
        },
      })

      await tx.subjectCoefficient.delete({ where: { id } })
      return merged
    })

    await createResultAuditLog({
      prisma,
      schoolId: user.schoolId,
      actorUserId: user.id,
      entityType: "SUBJECT_COEFFICIENT",
      entityId: updated.id,
      action: "MERGE_UPDATE",
      description: `دمج ضارب مكرر وتحديثه إلى ${buildDescription({
        subjectName: updated.subject.nameAr,
        levelName: updated.level.name,
        stageName: updated.level.stage.name,
        streamName: updated.stream?.name || null,
        classroomName: updated.classroom?.name || null,
      })}`,
      before: current,
      after: updated,
    })

    return NextResponse.json(updated)
  }

  const updated = await prisma.subjectCoefficient.update({
    where: { id },
    data: {
      subjectId,
      levelId: scope.levelId,
      streamId: scope.streamId,
      classroomId: scope.classroomId,
      coefficient: parsedCoefficient,
    },
    include: {
      subject: true,
      level: { include: { stage: true } },
      stream: true,
      classroom: { include: { level: { include: { stage: true } }, stream: true } },
    },
  })

  await createResultAuditLog({
    prisma,
    schoolId: user.schoolId,
    actorUserId: user.id,
    entityType: "SUBJECT_COEFFICIENT",
    entityId: updated.id,
    action: "UPDATE",
    description: `تعديل ضارب ${buildDescription({
      subjectName: updated.subject.nameAr,
      levelName: updated.level.name,
      stageName: updated.level.stage.name,
      streamName: updated.stream?.name || null,
      classroomName: updated.classroom?.name || null,
    })}`,
    before: current,
    after: updated,
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageCoefficients(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const existing = await prisma.subjectCoefficient.findFirst({
      where: { id, schoolId: user.schoolId },
      include: {
        subject: true,
        level: { include: { stage: true } },
        stream: true,
        classroom: { include: { level: { include: { stage: true } }, stream: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    await prisma.subjectCoefficient.delete({ where: { id } })

    await createResultAuditLog({
      prisma,
      schoolId: user.schoolId,
      actorUserId: user.id,
      entityType: "SUBJECT_COEFFICIENT",
      entityId: id,
      action: "DELETE",
      description: `حذف ضارب ${buildDescription({
        subjectName: existing.subject.nameAr,
        levelName: existing.level.name,
        stageName: existing.level.stage.name,
        streamName: existing.stream?.name || null,
        classroomName: existing.classroom?.name || null,
      })}`,
      before: existing,
      after: null,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "فشل الحذف" }, { status: 400 })
  }
}

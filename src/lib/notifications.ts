import { prisma } from "@/lib/prisma"

type AudienceType =
  | "ALL_PARENTS"
  | "CLASSROOM"
  | "LEVEL"
  | "STREAM"
  | "STUDENTS"
  | "UNPAID_FEES"

type CampaignFilters = {
  classroomId?: string | null
  levelId?: string | null
  streamId?: string | null
  studentIds?: string[]
  month?: string | null
}

type CampaignExclusions = {
  studentIds?: string[]
  parentUserIds?: string[]
}

export type NotificationAudienceInput = {
  audienceType: AudienceType
  filters?: CampaignFilters
  exclusions?: CampaignExclusions
}

export type ResolvedRecipient = {
  userId: string
  parentId: string
  studentId: string
  phone: string | null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

export function normalizeAudienceInput(payload: any): NotificationAudienceInput {
  return {
    audienceType: typeof payload?.audienceType === "string" ? payload.audienceType : "ALL_PARENTS",
    filters: {
      classroomId: typeof payload?.filters?.classroomId === "string" ? payload.filters.classroomId : null,
      levelId: typeof payload?.filters?.levelId === "string" ? payload.filters.levelId : null,
      streamId: typeof payload?.filters?.streamId === "string" ? payload.filters.streamId : null,
      month: typeof payload?.filters?.month === "string" ? payload.filters.month : null,
      studentIds: toStringArray(payload?.filters?.studentIds),
    },
    exclusions: {
      studentIds: toStringArray(payload?.exclusions?.studentIds),
      parentUserIds: toStringArray(payload?.exclusions?.parentUserIds),
    },
  }
}

export async function resolveNotificationRecipients(
  schoolId: string,
  audience: NotificationAudienceInput
): Promise<ResolvedRecipient[]> {
  const filters = audience.filters || {}
  const exclusions = audience.exclusions || {}

  const where: any = {
    schoolId,
    receiveNotifications: true,
    student: { isActive: true },
  }

  if (audience.audienceType === "CLASSROOM" && filters.classroomId) {
    where.student = {
      ...where.student,
      enrollments: { some: { classroomId: filters.classroomId, status: "ACTIVE" } },
    }
  }

  if (audience.audienceType === "LEVEL" && filters.levelId) {
    where.student = {
      ...where.student,
      enrollments: { some: { classroom: { levelId: filters.levelId }, status: "ACTIVE" } },
    }
  }

  if (audience.audienceType === "STREAM" && filters.streamId) {
    where.student = {
      ...where.student,
      enrollments: { some: { classroom: { streamId: filters.streamId }, status: "ACTIVE" } },
    }
  }

  if (audience.audienceType === "STUDENTS" && filters.studentIds?.length) {
    where.studentId = { in: filters.studentIds }
  }

  if (audience.audienceType === "UNPAID_FEES" && filters.month) {
    where.student = {
      ...where.student,
      invoices: { some: { month: filters.month, status: { in: ["PENDING", "PARTIAL"] } } },
    }
  }

  if (exclusions.studentIds?.length) {
    where.studentId = where.studentId
      ? { ...where.studentId, notIn: exclusions.studentIds }
      : { notIn: exclusions.studentIds }
  }

  if (exclusions.parentUserIds?.length) {
    where.parent = {
      ...where.parent,
      userId: { notIn: exclusions.parentUserIds },
    }
  }

  const links = await prisma.studentParent.findMany({
    where,
    include: {
      parent: {
        include: {
          user: true,
        },
      },
    },
  })

  const uniqueRecipients = new Map<string, ResolvedRecipient>()
  for (const link of links) {
    const key = `${link.parent.userId}:${link.studentId}`
    if (uniqueRecipients.has(key)) continue

    uniqueRecipients.set(key, {
      userId: link.parent.userId,
      parentId: link.parentId,
      studentId: link.studentId,
      phone: link.parent.phone || link.parent.user.phone || null,
    })
  }

  return Array.from(uniqueRecipients.values())
}

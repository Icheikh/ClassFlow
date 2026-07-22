import { prisma } from "@/lib/prisma"

const MANAGER_ROLES = ["SCHOOL_ADMIN", "SUPERVISOR"]
const OPERATIONAL_NOTIFICATION_PERMISSIONS = [
  "SEND_NOTIFICATIONS",
  "MANAGE_STUDENTS",
  "REVIEW_LESSONS",
  "APPROVE_GRADES",
]

type ManagerNotificationInput = {
  schoolId: string
  title: string
  message: string
  type: string
  entityType?: string | null
  entityId?: string | null
  actionUrl?: string | null
  metadata?: Record<string, unknown> | null
}

export function serializeNotificationMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return null
  return JSON.stringify(metadata)
}

export function parseNotificationMetadata(value?: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function notifySchoolManagers(input: ManagerNotificationInput) {
  const managers = await prisma.user.findMany({
    where: {
      schoolId: input.schoolId,
      isActive: true,
      OR: [
        { role: { in: MANAGER_ROLES } },
        {
          userPermissions: {
            some: {
              permission: {
                code: { in: OPERATIONAL_NOTIFICATION_PERMISSIONS },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  })

  if (managers.length === 0) return { count: 0 }

  const metadata = serializeNotificationMetadata(input.metadata)
  let count = 0

  for (const manager of managers) {
    const existing = input.entityType && input.entityId
      ? await prisma.notification.findFirst({
          where: {
            schoolId: input.schoolId,
            userId: manager.id,
            entityType: input.entityType,
            entityId: input.entityId,
            status: "PENDING",
          },
          select: { id: true },
        })
      : null

    if (existing) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          message: input.message,
          type: input.type,
          actionUrl: input.actionUrl || null,
          metadata,
          read: false,
        },
      })
    } else {
      await prisma.notification.create({
        data: {
          schoolId: input.schoolId,
          userId: manager.id,
          title: input.title,
          message: input.message,
          type: input.type,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          actionUrl: input.actionUrl || null,
          metadata,
        },
      })
    }
    count += 1
  }

  return { count }
}

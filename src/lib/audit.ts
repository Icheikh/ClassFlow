import { prisma } from "./prisma"

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "APPROVE" | "LOCK" | "UNLOCK" | "PAY" | "REOPEN"

type AuditLogOptions = {
  schoolId: string
  actorUserId?: string | null
  entityType: string
  entityId?: string | null
  action: AuditAction
  description?: string
  before?: unknown
  after?: unknown
  ipAddress?: string | null
}

/**
 * General-purpose audit logger.
 * Use for: payments, user management, school settings, fee changes, etc.
 * For result-specific audits, continue using createResultAuditLog.
 */
export async function createAuditLog(options: AuditLogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: options.schoolId,
        actorUserId: options.actorUserId || null,
        entityType: options.entityType,
        entityId: options.entityId || null,
        action: options.action,
        description: options.description || null,
        beforeJson: options.before == null ? null : JSON.stringify(options.before),
        afterJson: options.after == null ? null : JSON.stringify(options.after),
        ipAddress: options.ipAddress || null,
      },
    })
  } catch (error) {
    // Audit log failures should never block the main operation
    console.error("[audit] Failed to create audit log:", error)
  }
}

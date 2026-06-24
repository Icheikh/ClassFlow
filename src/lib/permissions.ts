import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./prisma"
import { NextResponse } from "next/server"

export const PERMISSIONS = {
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_STUDENTS: "MANAGE_STUDENTS",
  MANAGE_TEACHERS: "MANAGE_TEACHERS",
  MANAGE_SUBJECTS: "MANAGE_SUBJECTS",
  MANAGE_COEFFICIENTS: "MANAGE_COEFFICIENTS",
  MANAGE_ACADEMIC_YEARS: "MANAGE_ACADEMIC_YEARS",
  MANAGE_CLASSROOMS: "MANAGE_CLASSROOMS",
  REVIEW_LESSONS: "REVIEW_LESSONS",
  APPROVE_GRADES: "APPROVE_GRADES",
  LOCK_GRADES: "LOCK_GRADES",
  MANAGE_FEES: "MANAGE_FEES",
  RECORD_PAYMENTS: "RECORD_PAYMENTS",
  VIEW_FINANCE_REPORTS: "VIEW_FINANCE_REPORTS",
  VIEW_REPORTS: "VIEW_REPORTS",
  SEND_NOTIFICATIONS: "SEND_NOTIFICATIONS",
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const PERMISSION_CATEGORIES: Record<string, PermissionCode[]> = {
  USERS: ["MANAGE_USERS"],
  STUDENTS: ["MANAGE_STUDENTS"],
  TEACHERS: ["MANAGE_TEACHERS", "MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS"],
  ACADEMIC: ["MANAGE_ACADEMIC_YEARS", "MANAGE_CLASSROOMS"],
  GRADES: ["REVIEW_LESSONS", "APPROVE_GRADES", "LOCK_GRADES"],
  FINANCE: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"],
  REPORTS: ["VIEW_REPORTS"],
  NOTIFICATIONS: ["SEND_NOTIFICATIONS"],
}

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS)

export function hasPermission(
  user: { role: string; permissions?: string[] } | null | undefined,
  permission: string
): boolean {
  if (!user) return false
  if (user.role === "SUPER_ADMIN") return false
  if (user.role === "SCHOOL_ADMIN") return true
  if (!user.permissions) return false
  return user.permissions.includes(permission)
}

export function hasAnyPermission(
  user: { role: string; permissions?: string[] } | null | undefined,
  permissions: string[]
): boolean {
  return permissions.some((p) => hasPermission(user, p))
}

export function hasAllPermissions(
  user: { role: string; permissions?: string[] } | null | undefined,
  permissions: string[]
): boolean {
  return permissions.every((p) => hasPermission(user, p))
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const records = await prisma.userPermission.findMany({
    where: { userId },
    include: { permission: true },
  })
  return records.map((r) => r.permission.code)
}

export async function authorize(
  session: any,
  options: {
    requiredRole?: string
    requiredPermission?: string
    schoolIdRequired?: boolean
  } = {}
) {
  const user = session?.user as any

  if (!session) {
    return { authorized: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (options.schoolIdRequired && !user?.schoolId) {
    return { authorized: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (options.requiredRole && user?.role !== options.requiredRole) {
    return { authorized: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  if (options.requiredPermission && !hasPermission(user, options.requiredPermission)) {
    return { authorized: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { authorized: true as const, user }
}

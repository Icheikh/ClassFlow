import { useSession } from "next-auth/react"

export function useCurrentUser() {
  const { data: session } = useSession()
  const user = session?.user as any
  const permissions: string[] = user?.permissions ?? []

  function hasPermission(permission: string): boolean {
    if (!user) return false
    if (user.role === "SCHOOL_ADMIN") return true
    return permissions.includes(permission)
  }

  function hasAnyPermission(perms: string[]): boolean {
    return perms.some((p) => hasPermission(p))
  }

  return {
    id: user?.id ?? "",
    email: user?.email ?? "",
    name: user?.name ?? "",
    role: user?.role ?? "",
    schoolId: user?.schoolId ?? "",
    school: user?.school ?? null,
    permissions,
    hasPermission,
    hasAnyPermission,
    isTeacher: user?.role === "TEACHER",
    isAdmin: user?.role === "SCHOOL_ADMIN",
    isSuperAdmin: user?.role === "SUPER_ADMIN",
    isStaff: user?.role === "STAFF",
    isSupervisor: user?.role === "SUPERVISOR",
    isAccountant: user?.role === "ACCOUNTANT",
    isParent: user?.role === "PARENT",
  }
}
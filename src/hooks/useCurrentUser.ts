import { useSession } from "next-auth/react"

export function useCurrentUser() {
  const { data: session } = useSession()
  const user = session?.user as any

  return {
    id: user?.id ?? "",
    email: user?.email ?? "",
    name: user?.name ?? "",
    role: user?.role ?? "",
    schoolId: user?.schoolId ?? "",
    school: user?.school ?? null,
    isTeacher: user?.role === "TEACHER",
    isAdmin: user?.role === "SCHOOL_ADMIN",
    isSuperAdmin: user?.role === "SUPER_ADMIN",
    isSupervisor: user?.role === "SUPERVISOR",
    isAccountant: user?.role === "ACCOUNTANT",
    isParent: user?.role === "PARENT",
  }
}